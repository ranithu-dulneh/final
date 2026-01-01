import React, { useState, useEffect } from 'react';

export default function Reports() {
  const [sales, setSales] = useState([]);
  const [filter, setFilter] = useState('today');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  const fetchReports = async (startDate, endDate) => {
    let url = '/api/reports';
    if (startDate && endDate) {
      url += `?startDate=${startDate}&endDate=${endDate}`;
    }
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.data) setSales(data.data);
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (filter === 'today') {
      fetchReports(today + ' 00:00:00', today + ' 23:59:59');
    } else if (filter === 'week') {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      const start = lastWeek.toISOString().split('T')[0];
      fetchReports(start + ' 00:00:00', today + ' 23:59:59');
    } else if (filter === 'custom' && customRange.start && customRange.end) {
        fetchReports(customRange.start + ' 00:00:00', customRange.end + ' 23:59:59');
    } else if (filter === 'all') {
        fetchReports();
    }
  }, [filter, customRange]);

  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total_amount, 0);

  // Calculate profit (Mock calculation as we don't have historical cost price in sale_items, assuming current cost price)
  // Ideally, sale_items should store cost_price at time of sale. For now, we focus on Revenue.

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-bold text-gray-800">Sales Reports</h2>
        <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-2 mt-4 md:mt-0">
          <div className="flex space-x-2">
            <button onClick={() => setFilter('today')} className={`px-4 py-2 rounded ${filter === 'today' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Today</button>
            <button onClick={() => setFilter('week')} className={`px-4 py-2 rounded ${filter === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Last 7 Days</button>
            <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>All Time</button>
            <button onClick={() => setFilter('custom')} className={`px-4 py-2 rounded ${filter === 'custom' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Custom</button>
          </div>

          {filter === 'custom' && (
            <div className="flex space-x-2 items-center">
               <input
                 type="date"
                 value={customRange.start}
                 onChange={(e) => setCustomRange({...customRange, start: e.target.value})}
                 className="p-2 border rounded"
               />
               <span>to</span>
               <input
                 type="date"
                 value={customRange.end}
                 onChange={(e) => setCustomRange({...customRange, end: e.target.value})}
                 className="p-2 border rounded"
               />
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <h3 className="text-gray-500 font-medium">Total Revenue</h3>
          <p className="text-3xl font-bold text-gray-900">${totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <h3 className="text-gray-500 font-medium">Total Transactions</h3>
          <p className="text-3xl font-bold text-gray-900">{sales.length}</p>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Transaction History</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(sale.sale_date).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {sale.items.map(i => `${i.name} (${i.quantity})`).join(', ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    ${sale.total_amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
