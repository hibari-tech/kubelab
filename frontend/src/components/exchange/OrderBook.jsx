import { useOrderBook } from '../../hooks/useExchange';

function formatSats(sats) {
  const btc = Number(sats) / 100_000_000;
  return btc.toFixed(8);
}

function formatAmount(sats) {
  return Number(sats).toLocaleString();
}

function DepthBar({ side, index, total }) {
  if (side === 'bid') {
    const pct = (index + 1) / total * 100;
    return <div className="absolute right-0 top-0 bottom-0 bg-green-500/10" style={{ width: `${pct}%` }} />;
  }
  const pct = (index + 1) / total * 100;
  return <div className="absolute right-0 top-0 bottom-0 bg-red-500/10" style={{ width: `${pct}%` }} />;
}

export default function OrderBook() {
  const { data, isLoading } = useOrderBook();

  if (isLoading || !data?.data) {
    return <div className="text-gray-500 text-sm p-4">Loading order book...</div>;
  }

  const { bids, asks } = data.data;
  const maxRows = Math.max(bids.length, asks.length, 1);
  const spread = bids.length > 0 && asks.length > 0
    ? (Number(asks[0].price) - Number(bids[0].price)).toLocaleString()
    : '—';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-300">Order Book</h3>
        <span className="text-xs text-gray-500">Spread: {spread} sats</span>
      </div>

      {/* Header */}
      <div className="grid grid-cols-3 text-xs text-gray-500 pb-1 border-b border-gray-700">
        <span>Price (BTC)</span>
        <span className="text-right">Amount (sats)</span>
        <span className="text-right">Orders</span>
      </div>

      {/* Asks (reversed so lowest is at bottom) */}
      <div className="flex-1 overflow-y-auto">
        {[...asks].reverse().map((a, i) => (
          <div key={`ask-${i}`} className="relative grid grid-cols-3 text-xs py-0.5 hover:bg-gray-800/50">
            <DepthBar side="ask" index={asks.length - 1 - i} total={asks.length} />
            <span className="text-red-400 font-mono">{formatSats(a.price)}</span>
            <span className="text-right text-gray-300 font-mono">{formatAmount(a.amount)}</span>
            <span className="text-right text-gray-500">{a.count}</span>
          </div>
        ))}

        {/* Spread row */}
        <div className="grid grid-cols-3 text-xs py-1 border-y border-gray-700 bg-gray-800/30">
          <span className="text-white font-mono font-bold">
            {bids.length > 0 ? formatSats(bids[0].price) : '—'}
          </span>
          <span className="text-right text-gray-400">Spread</span>
          <span className="text-right text-white font-mono font-bold">
            {asks.length > 0 ? formatSats(asks[0].price) : '—'}
          </span>
        </div>

        {/* Bids */}
        {bids.map((b, i) => (
          <div key={`bid-${i}`} className="relative grid grid-cols-3 text-xs py-0.5 hover:bg-gray-800/50">
            <DepthBar side="bid" index={i} total={bids.length} />
            <span className="text-green-400 font-mono">{formatSats(b.price)}</span>
            <span className="text-right text-gray-300 font-mono">{formatAmount(b.amount)}</span>
            <span className="text-right text-gray-500">{b.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
