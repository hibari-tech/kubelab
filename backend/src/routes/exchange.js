/**
 * Exchange API routes.
 */

const express = require('express');
const router = express.Router();
const logger = require('../middleware/logger');
const { query } = require('../db/pool');
const engine = require('../utils/matching-engine');

// POST /api/exchange/users
router.post('/users', async (req, res) => {
  const { username, displayName } = req.body;
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ success: false, error: 'username is required' });
  }

  try {
    const result = await query(
      `INSERT INTO exchange_users (username, display_name) VALUES ($1, $2)
       ON CONFLICT (username) DO NOTHING
       RETURNING id, username, display_name, created_at`,
      [username.trim(), displayName || null]
    );

    if (result.rows.length === 0) {
      const existing = await query(`SELECT id, username, display_name FROM exchange_users WHERE username = $1`, [username.trim()]);
      return res.json({ success: true, data: existing.rows[0] });
    }

    // Create initial balance
    await query(
      `INSERT INTO exchange_balances (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [result.rows[0].id]
    );
    await query(
      `INSERT INTO exchange_wallets (user_id, currency) VALUES ($1, 'BTC') ON CONFLICT DO NOTHING`,
      [result.rows[0].id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('Failed to create user', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

// GET /api/exchange/users/:id
router.get('/users/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.display_name, b.available, b.locked
       FROM exchange_users u
       LEFT JOIN exchange_balances b ON b.user_id = u.id
       WHERE u.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('Failed to get user', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

// GET /api/exchange/wallet?userId=
router.get('/wallet', async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId query parameter required' });
  }

  try {
    const balance = await query(
      `SELECT available, locked FROM exchange_balances WHERE user_id = $1`,
      [userId]
    );
    const wallets = await query(
      `SELECT currency, address FROM exchange_wallets WHERE user_id = $1`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        balance: balance.rows[0] || { available: '0', locked: '0' },
        wallets: wallets.rows,
      },
    });
  } catch (err) {
    logger.error('Failed to get wallet', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to get wallet' });
  }
});

// POST /api/exchange/orders
router.post('/orders', async (req, res) => {
  const { userId, side, type, price, amount } = req.body;

  if (!userId || !side || !type || !amount) {
    return res.status(400).json({ success: false, error: 'userId, side, type, and amount are required' });
  }
  if (!['BUY', 'SELL'].includes(side)) {
    return res.status(400).json({ success: false, error: 'side must be BUY or SELL' });
  }
  if (!['LIMIT', 'MARKET'].includes(type)) {
    return res.status(400).json({ success: false, error: 'type must be LIMIT or MARKET' });
  }
  if (BigInt(amount) <= 0) {
    return res.status(400).json({ success: false, error: 'amount must be positive (satoshis)' });
  }
  if (type === 'LIMIT' && (!price || BigInt(price) <= 0)) {
    return res.status(400).json({ success: false, error: 'price is required for LIMIT orders (satoshis)' });
  }

  const orderPrice = type === 'MARKET' ? (side === 'BUY' ? '999999999999' : '1') : price;

  try {
    const result = await query(
      `INSERT INTO exchange_orders (user_id, side, type, price, amount)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, side, type, price, amount, status, created_at`,
      [userId, side, type, orderPrice, amount]
    );

    const order = result.rows[0];
    const matchResult = await engine.placeOrder(order);

    res.status(201).json({
      success: true,
      data: {
        ...order,
        status: matchResult.status,
        fills: matchResult.fills,
      },
    });
  } catch (err) {
    if (err.message === 'Insufficient balance') {
      return res.status(422).json({ success: false, error: 'Insufficient balance' });
    }
    logger.error('Failed to place order', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to place order' });
  }
});

// GET /api/exchange/orders?userId=&status=
router.get('/orders', async (req, res) => {
  const { userId, status } = req.query;
  try {
    let sql = `SELECT id, user_id, side, type, price, amount, amount_filled, status, created_at, updated_at
               FROM exchange_orders WHERE 1=1`;
    const params = [];
    if (userId) { params.push(userId); sql += ` AND user_id = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND status = $${params.length}`; }
    sql += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Failed to get orders', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to get orders' });
  }
});

// DELETE /api/exchange/orders/:id
router.delete('/orders/:id', async (req, res) => {
  try {
    // Cancel in matching engine
    const cancelled = engine.cancelOrder(req.params.id);
    if (!cancelled) {
      return res.status(404).json({ success: false, error: 'Order not found in book or already filled' });
    }

    await query(
      `UPDATE exchange_orders SET status = 'CANCELLED', updated_at = now() WHERE id = $1`,
      [req.params.id]
    );

    res.json({ success: true, message: 'Order cancelled' });
  } catch (err) {
    logger.error('Failed to cancel order', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to cancel order' });
  }
});

// GET /api/exchange/orderbook?depth=20
router.get('/orderbook', async (req, res) => {
  const depth = parseInt(req.query.depth, 10) || 20;
  const book = engine.getOrderBook(depth);
  res.json({ success: true, data: book });
});

// GET /api/exchange/trades?limit=50&userId=
router.get('/trades', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const { userId } = req.query;

  try {
    let sql = `SELECT t.id, t.maker_order_id, t.taker_order_id, t.price, t.amount, t.created_at
               FROM exchange_trades t WHERE 1=1`;
    const params = [];
    if (userId) {
      params.push(userId);
      sql += ` AND (t.maker_order_id IN (SELECT id FROM exchange_orders WHERE user_id = $1)
                OR t.taker_order_id IN (SELECT id FROM exchange_orders WHERE user_id = $1))`;
    }
    params.push(limit);
    sql += ` ORDER BY t.created_at DESC LIMIT $${params.length}`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Failed to get trades', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to get trades' });
  }
});

// POST /api/exchange/deposits
router.post('/deposits', async (req, res) => {
  const { userId, txHash, amount } = req.body;
  if (!userId || !txHash || !amount) {
    return res.status(400).json({ success: false, error: 'userId, txHash, and amount are required' });
  }

  try {
    await query(
      `INSERT INTO exchange_transactions (user_id, type, amount, tx_hash, status)
       VALUES ($1, 'DEPOSIT', $2, $3, 'PENDING')`,
      [userId, amount, txHash]
    );

    // Credit balance
    await query(
      `UPDATE exchange_balances SET available = available + $1, updated_at = now()
       WHERE user_id = $2`,
      [amount, userId]
    );

    res.status(201).json({ success: true, message: 'Deposit recorded' });
  } catch (err) {
    logger.error('Failed to record deposit', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to record deposit' });
  }
});

// POST /api/exchange/withdrawals
router.post('/withdrawals', async (req, res) => {
  const { userId, address, amount } = req.body;
  if (!userId || !address || !amount) {
    return res.status(400).json({ success: false, error: 'userId, address, and amount are required' });
  }

  try {
    // Debit balance
    const result = await query(
      `UPDATE exchange_balances SET available = available - $1, updated_at = now()
       WHERE user_id = $2 AND available >= $1 RETURNING id`,
      [amount, userId]
    );

    if (result.rowCount === 0) {
      return res.status(422).json({ success: false, error: 'Insufficient balance' });
    }

    await query(
      `INSERT INTO exchange_transactions (user_id, type, amount, status)
       VALUES ($1, 'WITHDRAWAL', $2, 'PENDING')`,
      [userId, amount]
    );

    res.status(201).json({ success: true, message: 'Withdrawal requested' });
  } catch (err) {
    logger.error('Failed to process withdrawal', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to process withdrawal' });
  }
});

// GET /api/exchange/transactions?userId=
router.get('/transactions', async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId query parameter required' });
  }

  try {
    const result = await query(
      `SELECT id, type, amount, tx_hash, status, created_at
       FROM exchange_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Failed to get transactions', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to get transactions' });
  }
});

// GET /api/exchange/ticker
router.get('/ticker', async (req, res) => {
  try {
    const book = engine.getOrderBook(1);
    const bestBid = book.bids[0]?.price || null;
    const bestAsk = book.asks[0]?.price || null;

    const lastTrade = await query(
      `SELECT price, amount FROM exchange_trades ORDER BY created_at DESC LIMIT 1`
    );
    const lastPrice = lastTrade.rows[0]?.price || null;

    const volume24h = await query(
      `SELECT COALESCE(SUM(price * amount), 0) AS volume
       FROM exchange_trades WHERE created_at > now() - interval '24 hours'`
    );

    res.json({
      success: true,
      data: {
        bestBid,
        bestAsk,
        spread: bestBid && bestAsk ? (BigInt(bestAsk) - BigInt(bestBid)).toString() : null,
        lastPrice,
        volume24h: volume24h.rows[0].volume,
      },
    });
  } catch (err) {
    logger.error('Failed to get ticker', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to get ticker' });
  }
});

module.exports = router;
