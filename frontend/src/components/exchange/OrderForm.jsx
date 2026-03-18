import { useState } from 'react';
import { placeOrder } from '../../services/exchangeApi';
import { toast } from 'sonner';

export default function OrderForm({ userId, onOrderPlaced }) {
  const [side, setSide] = useState('BUY');
  const [type, setType] = useState('LIMIT');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId) {
      toast.error('Register a user first');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error('Enter a valid amount (satoshis)');
      return;
    }
    if (type === 'LIMIT' && (!price || Number(price) <= 0)) {
      toast.error('Enter a valid price (satoshis)');
      return;
    }

    setSubmitting(true);
    try {
      const res = await placeOrder({
        userId,
        side,
        type,
        price: type === 'LIMIT' ? price : undefined,
        amount,
      });
      toast.success(`Order placed: ${res.data.data.status}`);
      setPrice('');
      setAmount('');
      onOrderPlaced?.();
    } catch (err) {
      toast.error(err.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSide('BUY')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
            side === 'BUY'
              ? 'bg-green-600 text-white'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => setSide('SELL')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
            side === 'SELL'
              ? 'bg-red-600 text-white'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        >
          Sell
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType('LIMIT')}
          className={`flex-1 py-1.5 rounded text-xs transition-colors ${
            type === 'LIMIT'
              ? 'bg-gray-600 text-white'
              : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
          }`}
        >
          Limit
        </button>
        <button
          type="button"
          onClick={() => setType('MARKET')}
          className={`flex-1 py-1.5 rounded text-xs transition-colors ${
            type === 'MARKET'
              ? 'bg-gray-600 text-white'
              : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
          }`}
        >
          Market
        </button>
      </div>

      {type === 'LIMIT' && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Price (satoshis)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="50000"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}

      <div>
        <label className="block text-xs text-gray-500 mb-1">Amount (satoshis)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100000"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-blue-500 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
          side === 'BUY'
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : 'bg-red-600 hover:bg-red-500 text-white'
        }`}
      >
        {submitting ? 'Placing...' : `${side} ${type}`}
      </button>
    </form>
  );
}
