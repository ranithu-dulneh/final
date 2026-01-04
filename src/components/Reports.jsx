import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { db } from '../firebase';
import { ref, onValue, update, runTransaction, push, set } from "firebase/database";
import PinModal from './PinModal';

export default function Reports() {
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [filterType, setFilterType] = useState('today');
  const [searchTerm, setSearchTerm] = useState('');

  // Return Auth
  const [isPinOpen, setIsPinOpen] = useState(false);
  const [saleToReturn, setSaleToReturn] = useState(null);

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
        const dateMatch = saleDate >= start && saleDate <= end;

        // Search Filter (ID or Items)
        const searchLower = searchTerm.toLowerCase();
        const idMatch = (sale.receiptId || sale.id).toLowerCase().includes(searchLower);
        const itemMatch = sale.items && sale.items.some(item =>
             item.productName.toLowerCase().includes(searchLower) ||
             (item.variantName && item.variantName.toLowerCase().includes(searchLower))
        );

        return dateMatch && (searchTerm === '' || idMatch || itemMatch);
    });

    // Sort by date desc
    filtered.sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date));

    setFilteredSales(filtered);
  }, [sales, filterType, startDate, endDate, searchTerm]);

  const totalRevenue = filteredSales.reduce((sum, sale) => {
      // Don't count returned sales in revenue
      if (sale.status === 'returned') return sum;
      return sum + sale.total_amount;
  }, 0);

  const handleReturnClick = (sale) => {
      if (sale.status === 'returned') return;
      setSaleToReturn(sale);
      setIsPinOpen(true);
  };

  const processReturn = async () => {
      if (!saleToReturn) return;
      setIsPinOpen(false); // Close pin modal

      try {
        // 1. Update Sale Status
        await update(ref(db, `sales/${saleToReturn.id}`), {
            status: 'returned',
            returnedAt: new Date().toISOString()
        });

        // 2. Restock Items
        const updates = [];
        if (saleToReturn.items) {
             for (const item of saleToReturn.items) {
                 // We need to find the variant index again if not stored directly,
                 // but Register stores variantIndex. Assuming it does or we can rely on variantId path if refactored.
                 // The Register.jsx code provided shows it stores variantIndex!
                 // "variantIndex: selectedVariantIndex"
                 // So we can construct path: products/{productId}/variants/{variantIndex}/stock

                 // Fallback if variantIndex missing (legacy data?): we can't easily update without searching.
                 // Assuming new data has it.
                 if (item.variantIndex !== undefined) {
                     const stockRef = ref(db, `products/${item.productId}/variants/${item.variantIndex}/stock`);
                     updates.push(runTransaction(stockRef, (current) => (current || 0) + item.quantity));
                 }
             }
        }
        await Promise.all(updates);

        // 3. Reverse Debt if Credit Sale
        if (saleToReturn.paymentMethod === 'Credit Sale' && saleToReturn.customerDetails) {
            const customersRef = ref(db, 'customers');
            const returnRecord = push(customersRef);
            await set(returnRecord, {
                ...saleToReturn.customerDetails,
                amount: -Math.abs(saleToReturn.total_amount), // Negative amount
                description: `Return: Receipt ${saleToReturn.receiptId || 'Unknown'}`,
                saleId: saleToReturn.id,
                receiptId: saleToReturn.receiptId,
                date: new Date().toISOString(),
                type: 'RETURN'
            });
        }

        alert(`Receipt ${saleToReturn.receiptId} processed as returned.`);
        setSaleToReturn(null);

      } catch (e) {
          console.error(e);
          alert("Error processing return: " + e.message);
      }
  };

  return (
    <div className="space-y-6">
      <PinModal
         isOpen={isPinOpen}
         onClose={() => { setIsPinOpen(false); setSaleToReturn(null); }}
         onSuccess={processReturn}
      />

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-4 items-center">
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

        <input
            type="text"
            placeholder="Search Receipt ID or Item..."
            className="p-2 border rounded w-full md:w-64 focus:ring-2 focus:ring-brand-green outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
        />
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredSales.map((sale) => (
              <tr key={sale.id} className={sale.status === 'returned' ? 'bg-red-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                   {sale.receiptId || '-'}
                   {sale.status === 'returned' && <span className="block text-xs text-red-600 font-bold uppercase">Returned</span>}
                </td>
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
                  <span className={sale.status === 'returned' ? 'line-through text-gray-400' : ''}>
                    Rs. {sale.total_amount.toFixed(2)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                   {sale.status !== 'returned' && (
                       <button
                         onClick={() => handleReturnClick(sale)}
                         className="text-red-600 hover:text-red-900 font-medium"
                       >
                           Return
                       </button>
                   )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
