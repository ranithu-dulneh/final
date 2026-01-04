import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { db } from '../firebase';
import { ref, onValue } from "firebase/database";

export default function Reports() {
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [filterType, setFilterType] = useState('today');

  useEffect(() => {
    const salesRef = ref(db, 'sales');
    const unsubscribe = onValue(salesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const salesList = Object.entries(data).map(([id, val]) => ({
                id,
                ...val,
                total_amount: val.total || 0, // Normalize structure
                sale_date: val.date
            }));
            setSales(salesList);
        } else {
            setSales([]);
        }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!sales.length) {
        setFilteredSales([]);
        return;
    }

    let start = new Date();
    let end = new Date();

    if (filterType === 'today') {
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
    } else if (filterType === 'last7') {
        start.setDate(end.getDate() - 7);
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
    } else if (filterType === 'custom') {
        start = new Date(startDate);
        start.setHours(0,0,0,0);
        end = new Date(endDate);
        end.setHours(23,59,59,999);
    }

    const filtered = sales.filter(sale => {
        const saleDate = new Date(sale.sale_date);
        return saleDate >= start && saleDate <= end;
    });

    // Sort by date desc
    filtered.sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date));

    setFilteredSales(filtered);
  }, [sales, filterType, startDate, endDate]);

  const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total_amount, 0);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow flex flex-wrap gap-4 items-center">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="today">Today</option>
          <option value="last7">Last 7 Days</option>
          <option value="custom">Custom Range</option>
        </select>

        {filterType === 'custom' && (
          <div className="flex gap-2">
            <DatePicker selected={startDate} onChange={(date) => setStartDate(date)} className="p-2 border rounded" />
            <DatePicker selected={endDate} onChange={(date) => setEndDate(date)} className="p-2 border rounded" />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
          <h3 className="text-gray-500 text-sm uppercase">Total Revenue</h3>
          <p className="text-2xl font-bold text-gray-800">Rs. {totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
          <h3 className="text-gray-500 text-sm uppercase">Transactions</h3>
          <p className="text-2xl font-bold text-gray-800">{filteredSales.length}</p>
        </div>
      </div>

      {/* Sales List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredSales.map((sale) => (
              <tr key={sale.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(sale.sale_date).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="space-y-1">
                    {sale.items && sale.items.map((item, idx) => (
                      <div key={idx}>
                        {item.productName} ({item.variantName}) x{item.quantity}
                        {item.discount > 0 && <span className="text-green-600 text-xs ml-1">(Disc: Rs. {item.discount})</span>}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                  Rs. {sale.total_amount.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
