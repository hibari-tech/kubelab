import OrderBook from './OrderBook';
import OrderForm from './OrderForm';
import RecentTrades from './RecentTrades';

export default function TradingDashboard({ userId, onOrderPlaced }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
      {/* Order Book */}
      <div className="lg:col-span-4 bg-gray-800 rounded-xl p-4 min-h-[400px]">
        <OrderBook />
      </div>

      {/* Order Form */}
      <div className="lg:col-span-3 bg-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Place Order</h3>
        <OrderForm userId={userId} onOrderPlaced={onOrderPlaced} />
      </div>

      {/* Recent Trades */}
      <div className="lg:col-span-5 bg-gray-800 rounded-xl p-4 min-h-[400px]">
        <RecentTrades />
      </div>
    </div>
  );
}
