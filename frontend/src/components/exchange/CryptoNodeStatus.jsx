import { useCryptoStatus } from '../../hooks/useExchange';

export default function CryptoNodeStatus() {
  const { data, isLoading } = useCryptoStatus();
  const d = data?.data;

  if (isLoading || !d) return null;

  return (
    <div className="flex items-center gap-4 text-xs">
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${d.bitcoin?.status === 'healthy' ? 'bg-green-400' : 'bg-red-400'}`} />
        <span className="text-gray-400">BTC</span>
        {d.bitcoin?.blocks && <span className="text-gray-500 font-mono">#{d.bitcoin.blocks.toLocaleString()}</span>}
      </div>
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${d.lightning?.status === 'healthy' ? 'bg-green-400' : 'bg-red-400'}`} />
        <span className="text-gray-400">LND</span>
        {d.lightning?.alias && <span className="text-gray-500">{d.lightning.alias}</span>}
      </div>
      {d.mockMode && (
        <span className="text-amber-400 ml-2">Mock Mode</span>
      )}
    </div>
  );
}
