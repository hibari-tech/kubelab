import { useAllTrades } from '../../hooks/useExchange';

function formatSats(sats) {
  const btc = Number(sats) / 100_000_000;
  return btc.toFixed(8);
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function RecentTrades() {
  const { data, isLoading } = useAllTrades();

  if (isLoading || !data?.data) {
    return <div className="text-gray-500 text-sm p-4">Loading trades...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-gray-300 mb-2">Recent Trades</h3>

      <div className="grid grid-cols-3 text-xs text-gray-500 pb-1 border-b border-gray-700">
        <span>Price (BTC)</span>
        <span className="text-right">Amount (sats)</span>
        <span className="text-right">Time</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {data.data.map((trade) => (
          <div key={trade.id} className="grid grid-cols-3 text-xs py-0.5 hover:bg-gray-800/50">
            <span className="text-white font-mono">{formatSats(trade.price)}</span>
            <span className="text-right text-gray-300 font-mono">{Number(trade.amount).toLocaleString()}</span>
            <span className="text-right text-gray-500">{formatTime(trade.created_at)}</span>
          </div>
        ))}
        {data.data.length === 0 && (
          <div className="text-gray-600 text-xs text-center py-4">No trades yet</div>
        )}
      </div>
    </div>
  );
}
