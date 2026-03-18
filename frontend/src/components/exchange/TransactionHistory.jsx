import { useTransactions } from '../../hooks/useExchange';

function formatSats(sats) {
  const btc = Number(sats) / 100_000_000;
  return `${btc.toFixed(8)}`;
}

function formatTime(iso) {
  return new Date(iso).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const typeColors = {
  DEPOSIT: 'text-green-400',
  WITHDRAWAL: 'text-orange-400',
  TRADE: 'text-blue-400',
};

const statusColors = {
  PENDING: 'text-yellow-400',
  CONFIRMED: 'text-green-400',
  FAILED: 'text-red-400',
};

export default function TransactionHistory({ userId }) {
  const { data, isLoading } = useTransactions(userId);

  if (isLoading) {
    return <div className="text-gray-500 text-sm p-4">Loading transactions...</div>;
  }

  const txns = data?.data || [];

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-gray-300 mb-2">Transaction History</h3>

      {txns.length === 0 ? (
        <div className="text-gray-600 text-xs text-center py-8">No transactions yet</div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700">
                <th className="text-left py-1.5 font-medium">Type</th>
                <th className="text-right py-1.5 font-medium">Amount</th>
                <th className="text-left py-1.5 font-medium">Tx Hash</th>
                <th className="text-right py-1.5 font-medium">Status</th>
                <th className="text-right py-1.5 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((tx) => (
                <tr key={tx.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className={`py-1.5 font-medium ${typeColors[tx.type] || 'text-gray-400'}`}>
                    {tx.type}
                  </td>
                  <td className="py-1.5 text-right font-mono text-white">
                    {formatSats(tx.amount)} BTC
                  </td>
                  <td className="py-1.5 text-gray-500 font-mono truncate max-w-[120px]">
                    {tx.tx_hash ? `${tx.tx_hash.slice(0, 10)}...` : '—'}
                  </td>
                  <td className={`py-1.5 text-right ${statusColors[tx.status] || 'text-gray-400'}`}>
                    {tx.status}
                  </td>
                  <td className="py-1.5 text-right text-gray-500">
                    {formatTime(tx.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
