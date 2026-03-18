import { useState } from 'react';
import { useWallet, useMyOrders } from '../../hooks/useExchange';
import { requestWithdrawal } from '../../services/exchangeApi';
import { cancelOrder } from '../../services/exchangeApi';
import { toast } from 'sonner';

function formatSats(sats) {
  if (!sats) return '0';
  const btc = Number(sats) / 100_000_000;
  return `${btc.toFixed(8)} BTC`;
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function WalletPanel({ userId }) {
  const { data, refetch } = useWallet(userId);
  const { data: ordersData, refetch: refetchOrders } = useMyOrders(userId, 'OPEN');
  const [withdrawAddr, setWithdrawAddr] = useState('');
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const balance = data?.data?.balance || { available: '0', locked: '0' };
  const openOrders = ordersData?.data || [];

  const handleWithdraw = async (e) => {
    e.preventDefault();
    if (!withdrawAddr || !withdrawAmt) return;
    setWithdrawing(true);
    try {
      await requestWithdrawal(userId, withdrawAddr, withdrawAmt);
      toast.success('Withdrawal requested');
      setWithdrawAddr('');
      setWithdrawAmt('');
      refetch();
    } catch (err) {
      toast.error(err.message || 'Withdrawal failed');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleCancel = async (orderId) => {
    try {
      await cancelOrder(orderId);
      toast.success('Order cancelled');
      refetchOrders();
      refetch();
    } catch (err) {
      toast.error(err.message || 'Cancel failed');
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-300">Wallet</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500">Available</div>
          <div className="text-white font-mono text-lg font-bold">{formatSats(balance.available)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500">Locked</div>
          <div className="text-gray-400 font-mono text-lg">{formatSats(balance.locked)}</div>
        </div>
      </div>

      {/* Open Orders */}
      {openOrders.length > 0 && (
        <div>
          <h4 className="text-xs text-gray-500 mb-2">Open Orders ({openOrders.length})</h4>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {openOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className={o.side === 'BUY' ? 'text-green-400' : 'text-red-400'}>{o.side}</span>
                  <span className="text-gray-400">{o.type}</span>
                  <span className="text-gray-300 font-mono">{Number(o.price).toLocaleString()} sats</span>
                  <span className="text-gray-500">x</span>
                  <span className="text-gray-300 font-mono">{Number(o.amount).toLocaleString()}</span>
                </div>
                <button
                  onClick={() => handleCancel(o.id)}
                  className="text-gray-500 hover:text-red-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Withdrawal form */}
      <form onSubmit={handleWithdraw} className="space-y-2">
        <h4 className="text-xs text-gray-500">Withdraw</h4>
        <input
          type="text"
          value={withdrawAddr}
          onChange={(e) => setWithdrawAddr(e.target.value)}
          placeholder="tb1q... address"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
        />
        <input
          type="number"
          value={withdrawAmt}
          onChange={(e) => setWithdrawAmt(e.target.value)}
          placeholder="Amount (satoshis)"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={withdrawing}
          className="w-full py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-xs text-white transition-colors"
        >
          {withdrawing ? 'Processing...' : 'Request Withdrawal'}
        </button>
      </form>
    </div>
  );
}
