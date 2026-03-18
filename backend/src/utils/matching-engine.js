/**
 * In-memory order matching engine with price-time priority.
 *
 * Bids sorted DESC (highest first), asks sorted ASC (lowest first).
 * Matching: when a new order crosses the spread, it fills against resting orders.
 * All fills are persisted to PostgreSQL in a transaction.
 *
 * Singleton module — one instance per process (MVP: single backend replica).
 */

const { query, getClient } = require('../db/pool');
const { exchangeOrderCounter, exchangeTradeCounter, exchangeOrderbookDepth } = require('./metrics');
const logger = require('../middleware/logger');

// Sorted order book: Map<priceString, Array<{orderId, userId, amount, timestamp}>>
const bids = new Map(); // price DESC
const asks = new Map(); // price ASC

function insertOrder(book, price, order) {
  const key = price.toString();
  if (!book.has(key)) book.set(key, []);
  book.get(key).push(order);
}

function matchOrder(incoming) {
  const fills = [];
  const opposite = incoming.side === 'BUY' ? asks : bids;
  const incomingPrice = incoming.price;

  const keys = [...opposite.keys()];
  for (const priceKey of keys) {
    const price = BigInt(priceKey);
    const crosses = incoming.side === 'BUY' ? price <= incomingPrice : price >= incomingPrice;
    if (!crosses) break;

    const queue = opposite.get(priceKey);
    while (queue.length > 0 && incoming.amount > 0) {
      const resting = queue[0];
      const fillAmount = resting.amount < incoming.amount ? resting.amount : incoming.amount;

      fills.push({
        makerOrderId: resting.orderId,
        takerOrderId: incoming.orderId,
        price,
        amount: fillAmount,
      });

      resting.amount -= fillAmount;
      incoming.amount -= fillAmount;

      if (resting.amount === 0) queue.shift();
    }
    if (queue.length === 0) opposite.delete(priceKey);
  }
  return fills;
}

async function persistFills(fills, incoming) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    for (const fill of fills) {
      // Insert trade record
      await client.query(
        `INSERT INTO exchange_trades (maker_order_id, taker_order_id, price, amount)
         VALUES ($1, $2, $3, $4)`,
        [fill.makerOrderId, fill.takerOrderId, fill.price.toString(), fill.amount.toString()]
      );

      // Update maker order
      const makerResult = await client.query(
        `UPDATE exchange_orders SET amount_filled = amount_filled + $1, status = $2, updated_at = now()
         WHERE id = $3 RETURNING user_id, amount, amount_filled`,
        [fill.amount.toString(), 'FILLED', fill.makerOrderId]
      );
      const maker = makerResult.rows[0];
      if (BigInt(maker.amount) === BigInt(maker.amount_filled)) {
        await client.query(
          `UPDATE exchange_orders SET status = 'FILLED' WHERE id = $1`,
          [fill.makerOrderId]
        );
      } else {
        await client.query(
          `UPDATE exchange_orders SET status = 'PARTIALLY_FILLED' WHERE id = $1`,
          [fill.makerOrderId]
        );
      }

      // Update taker order
      const takerResult = await client.query(
        `UPDATE exchange_orders SET amount_filled = amount_filled + $1, status = $2, updated_at = now()
         WHERE id = $3 RETURNING user_id, amount, amount_filled`,
        [fill.amount.toString(), 'FILLED', incoming.orderId]
      );
      const taker = takerResult.rows[0];
      if (BigInt(taker.amount) === BigInt(taker.amount_filled)) {
        await client.query(
          `UPDATE exchange_orders SET status = 'FILLED' WHERE id = $1`,
          [incoming.orderId]
        );
      } else {
        await client.query(
          `UPDATE exchange_orders SET status = 'PARTIALLY_FILLED' WHERE id = $1`,
          [incoming.orderId]
        );
      }

      // Update balances: BUY taker gets BTC, SELL maker gets BTC
      // BUY taker pays satoshis, SELL maker receives satoshis
      const totalCost = fill.price * fill.amount;
      if (incoming.side === 'BUY') {
        // Taker buys BTC from maker
        await client.query(
          `UPDATE exchange_balances SET available = available + $1, locked = locked - $1, updated_at = now()
           WHERE user_id = $2`,
          [fill.amount.toString(), incoming.userId]
        );
        await client.query(
          `UPDATE exchange_balances SET available = available + $1, locked = locked - $1, updated_at = now()
           WHERE user_id = $2`,
          [totalCost.toString(), maker.user_id]
        );
        await client.query(
          `UPDATE exchange_balances SET available = available + $1, updated_at = now()
           WHERE user_id = $2`,
          [totalCost.toString(), incoming.userId]
        );
        await client.query(
          `UPDATE exchange_balances SET available = available - $1, updated_at = now()
           WHERE user_id = $2`,
          [fill.amount.toString(), maker.user_id]
        );
      } else {
        // Taker sells BTC to maker
        await client.query(
          `UPDATE exchange_balances SET available = available + $1, locked = locked - $1, updated_at = now()
           WHERE user_id = $2`,
          [totalCost.toString(), incoming.userId]
        );
        await client.query(
          `UPDATE exchange_balances SET available = available + $1, locked = locked - $1, updated_at = now()
           WHERE user_id = $2`,
          [fill.amount.toString(), maker.user_id]
        );
        await client.query(
          `UPDATE exchange_balances SET available = available + $1, updated_at = now()
           WHERE user_id = $2`,
          [fill.amount.toString(), incoming.userId]
        );
        await client.query(
          `UPDATE exchange_balances SET available = available - $1, updated_at = now()
           WHERE user_id = $2`,
          [totalCost.toString(), maker.user_id]
        );
      }

      exchangeTradeCounter.inc();
    }

    // Insert transaction records for both parties
    for (const fill of fills) {
      await client.query(
        `INSERT INTO exchange_transactions (user_id, type, amount, status)
         VALUES ($1, 'TRADE', $2, 'CONFIRMED')`,
        [incoming.userId, fill.amount.toString()]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function placeOrder(order) {
  const incoming = {
    orderId: order.id,
    userId: order.user_id,
    side: order.side,
    type: order.type,
    price: BigInt(order.price),
    amount: BigInt(order.amount),
    timestamp: Date.now(),
  };

  // Lock balance for the order
  const client = await getClient();
  try {
    await client.query('BEGIN');
    if (incoming.side === 'BUY') {
      const totalCost = incoming.price * incoming.amount;
      await client.query(
        `UPDATE exchange_balances SET available = available - $1, locked = locked + $1, updated_at = now()
         WHERE user_id = $2 AND available >= $1`,
        [totalCost.toString(), incoming.userId]
      );
    } else {
      await client.query(
        `UPDATE exchange_balances SET available = available - $1, locked = locked + $1, updated_at = now()
         WHERE user_id = $2 AND available >= $1`,
        [incoming.amount.toString(), incoming.userId]
      );
    }
    const { rowCount } = await client.query('COMMIT');
    if (rowCount === 0) {
      throw new Error('Insufficient balance');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    throw err;
  }
  client.release();

  // Match against opposite side
  const fills = matchOrder(incoming);

  // Persist fills
  if (fills.length > 0) {
    await persistFills(fills, incoming);
  }

  // If order has remaining amount, add to book
  let status = 'OPEN';
  if (incoming.amount === 0n) {
    status = 'FILLED';
  } else if (fills.length > 0) {
    status = 'PARTIALLY_FILLED';
  }

  if (status !== 'FILLED' && incoming.type === 'LIMIT') {
    const book = incoming.side === 'BUY' ? bids : asks;
    insertOrder(book, incoming.price, {
      orderId: incoming.orderId,
      userId: incoming.userId,
      amount: incoming.amount,
      timestamp: incoming.timestamp,
    });
  }

  // Update DB status
  if (status === 'FILLED' || status === 'PARTIALLY_FILLED') {
    await query(
      `UPDATE exchange_orders SET status = $1, amount_filled = amount + $2, updated_at = now() WHERE id = $3`,
      [status, (0n - incoming.amount).toString(), incoming.orderId]
    );
  }

  exchangeOrderCounter.inc({ side: incoming.side, type: incoming.type, status });
  updateDepthGauge();

  return {
    status,
    fills: fills.map(f => ({
      price: f.price.toString(),
      amount: f.amount.toString(),
      makerOrderId: f.makerOrderId,
    })),
  };
}

function cancelOrder(orderId) {
  // Remove from both books
  for (const [priceKey, queue] of bids) {
    const idx = queue.findIndex(o => o.orderId === orderId);
    if (idx !== -1) {
      const removed = queue.splice(idx, 1)[0];
      if (queue.length === 0) bids.delete(priceKey);
      return unlockBalance(orderId, removed.amount, 'BUY');
    }
  }
  for (const [priceKey, queue] of asks) {
    const idx = queue.findIndex(o => o.orderId === orderId);
    if (idx !== -1) {
      const removed = queue.splice(idx, 1)[0];
      if (queue.length === 0) asks.delete(priceKey);
      return unlockBalance(orderId, removed.amount, 'SELL');
    }
  }
  return null;
}

async function unlockBalance(orderId, amount, side) {
  if (side === 'BUY') {
    // We don't know the price here, query from DB
    const result = await query(
      `SELECT price, amount - amount_filled AS remaining FROM exchange_orders WHERE id = $1`,
      [orderId]
    );
    if (result.rows.length > 0) {
      const { price, remaining } = result.rows[0];
      const unlockAmount = BigInt(price) * BigInt(remaining);
      await query(
        `UPDATE exchange_balances SET available = available + $1, locked = locked - $1, updated_at = now()
         WHERE user_id = (SELECT user_id FROM exchange_orders WHERE id = $2)`,
        [unlockAmount.toString(), orderId]
      );
    }
  } else {
    await query(
      `UPDATE exchange_balances SET available = available + $1, locked = locked - $1, updated_at = now()
       WHERE user_id = (SELECT user_id FROM exchange_orders WHERE id = $2)`,
      [amount.toString(), orderId]
    );
  }
}

function getOrderBook(depth = 20) {
  const bidEntries = [];
  for (const [priceKey, queue] of bids) {
    bidEntries.push({ price: BigInt(priceKey), orders: [...queue] });
  }
  bidEntries.sort((a, b) => b.price - a.price);

  const askEntries = [];
  for (const [priceKey, queue] of asks) {
    askEntries.push({ price: BigInt(priceKey), orders: [...queue] });
  }
  askEntries.sort((a, b) => a.price - b.price);

  const formatSide = (entries) =>
    entries.slice(0, depth).map(e => ({
      price: e.price.toString(),
      amount: e.orders.reduce((sum, o) => sum + o.amount, 0n).toString(),
      count: e.orders.length,
    }));

  return {
    bids: formatSide(bidEntries),
    asks: formatSide(askEntries),
  };
}

function updateDepthGauge() {
  let bidCount = 0, askCount = 0;
  for (const queue of bids.values()) bidCount += queue.length;
  for (const queue of asks.values()) askCount += queue.length;
  exchangeOrderbookDepth.set({ side: 'bid' }, bidCount);
  exchangeOrderbookDepth.set({ side: 'ask' }, askCount);
}

async function recoverOrderBook() {
  const result = await query(
    `SELECT id, user_id, side, type, price, amount - amount_filled AS remaining
     FROM exchange_orders
     WHERE status IN ('OPEN', 'PARTIALLY_FILLED')
     ORDER BY created_at ASC`
  );

  for (const row of result.rows) {
    const book = row.side === 'BUY' ? bids : asks;
    insertOrder(book, BigInt(row.price), {
      orderId: row.id,
      userId: row.user_id,
      amount: BigInt(row.remaining),
      timestamp: new Date(row.created_at).getTime(),
    });
  }

  updateDepthGauge();
  logger.info('Order book recovered', { orders: result.rowCount });
}

module.exports = {
  placeOrder,
  cancelOrder,
  getOrderBook,
  recoverOrderBook,
};
