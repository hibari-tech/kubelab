import { useState } from 'react';
import { createUser } from '../services/exchangeApi';
import { toast } from 'sonner';
import TradingDashboard from '../components/exchange/TradingDashboard';
import WalletPanel from '../components/exchange/WalletPanel';
import TransactionHistory from '../components/exchange/TransactionHistory';
import PriceTicker from '../components/exchange/PriceTicker';
import CryptoNodeStatus from '../components/exchange/CryptoNodeStatus';
import { useCryptoStatus } from '../hooks/useExchange';

const TABS = ['Trading', 'Wallet', 'History'];

export default function ExchangePage() {
  const [tab, setTab] = useState('Trading');
  const [userId, setUserId] = useState(() => {
    try { return localStorage.getItem('kubelab_exchange_userId') || ''; } catch { return ''; }
  });
  const [username, setUsername] = useState('');
  const [registering, setRegistering] = useState(false);
  const { data: cryptoData } = useCryptoStatus();
  const mockMode = cryptoData?.data?.mockMode;

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    setRegistering(true);
    try {
      const res = await createUser(username.trim());
      const id = res.data.data.id;
      setUserId(id);
      try { localStorage.setItem('kubelab_exchange_userId', id); } catch {}
      toast.success(`Registered as ${username}`);
      setUsername('');
    } catch (err) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Top bar */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <PriceTicker />
        <CryptoNodeStatus />
      </div>

      {mockMode && (
        <div className="bg-amber-900/30 border-b border-amber-700 px-4 py-2 text-center text-xs text-amber-300">
          Mock Mode — no real crypto nodes connected. Order matching works with fake balances.
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        {/* User registration / info */}
        {!userId ? (
          <form onSubmit={handleRegister} className="flex items-center gap-3">
            <label className="text-sm text-gray-400">Register to trade:</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={registering}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm text-white transition-colors"
            >
              {registering ? '...' : 'Register'}
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">User:</span>
            <span className="text-white font-mono">{userId.slice(0, 8)}...</span>
            <button
              onClick={() => {
                setUserId('');
                try { localStorage.removeItem('kubelab_exchange_userId'); } catch {}
              }}
              className="text-xs text-gray-500 hover:text-gray-300 ml-2"
            >
              Switch user
            </button>
          </div>
        )}

        {/* Tab navigation */}
        <div className="flex gap-1 border-b border-gray-700">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm transition-colors ${
                tab === t
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'Trading' && (
          <TradingDashboard userId={userId} onOrderPlaced={() => {}} />
        )}
        {tab === 'Wallet' && (
          <div className="bg-gray-800 rounded-xl p-4 max-w-md">
            {userId ? (
              <WalletPanel userId={userId} />
            ) : (
              <div className="text-gray-500 text-sm">Register a user to view wallet</div>
            )}
          </div>
        )}
        {tab === 'History' && (
          <div className="bg-gray-800 rounded-xl p-4">
            {userId ? (
              <TransactionHistory userId={userId} />
            ) : (
              <div className="text-gray-500 text-sm">Register a user to view transaction history</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
