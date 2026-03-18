import { useTicker } from '../../hooks/useExchange';

function formatSats(sats) {
  if (!sats) return '—';
  const btc = Number(sats) / 100_000_000;
  return btc.toFixed(8);
}

export default function PriceTicker() {
  const { data, isLoading } = useTicker();
  const d = data?.data;

  if (isLoading || !d) {
    return (
      <div className="flex items-center gap-6 text-sm text-gray-400">
        <span>Loading ticker...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6 text-sm">
      <div>
        <span className="text-gray-500">Last: </span>
        <span className="text-white font-mono font-bold">{formatSats(d.lastPrice)}</span>
        <span className="text-gray-500 ml-1">BTC</span>
      </div>
      <div>
        <span className="text-green-400">Bid: </span>
        <span className="text-white font-mono">{formatSats(d.bestBid)}</span>
      </div>
      <div>
        <span className="text-red-400">Ask: </span>
        <span className="text-white font-mono">{formatSats(d.bestAsk)}</span>
      </div>
      <div>
        <span className="text-gray-500">Spread: </span>
        <span className="text-white font-mono">{d.spread ? formatSats(d.spread) : '—'}</span>
      </div>
      <div>
        <span className="text-gray-500">24h Vol: </span>
        <span className="text-white font-mono">{formatSats(d.volume24h)}</span>
      </div>
    </div>
  );
}
