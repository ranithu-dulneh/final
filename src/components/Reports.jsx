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
    <div className="space-y-4 max-w-6xl mx-auto">
      <PinModal
         isOpen={isPinOpen}
         onClose={() => { setIsPinOpen(false); setSaleToReturn(null); }}
         onSuccess={processReturn}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-brand-green">
          <h3 className="text-gray-500 text-xs uppercase font-bold">Total Revenue</h3>
          <p className="text-xl sm:text-2xl font-black text-gray-800 mt-1">Rs. {totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500">
          <h3 className="text-gray-500 text-xs uppercase font-bold">Sales Count</h3>
          <p className="text-xl sm:text-2xl font-black text-gray-800 mt-1">{filteredSales.length}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="p-2.5 border rounded-lg text-sm bg-gray-50 font-medium focus:ring-2 focus:ring-brand-green outline-none"
          >
            <option value="today">Today</option>
            <option value="last7">Last 7 Days</option>
            <option value="custom">Custom Range</option>
          </select>

          {filterType === 'custom' && (
            <div className="flex gap-1.5 items-center flex-wrap">
              <DatePicker selected={startDate} onChange={(date) => setStartDate(date)} className="p-2 border rounded-lg text-xs w-28 bg-gray-50" />
              <span className="text-gray-400 text-xs">to</span>
              <DatePicker selected={endDate} onChange={(date) => setEndDate(date)} className="p-2 border rounded-lg text-xs w-28 bg-gray-50" />
            </div>
          )}
        </div>

        <input
          type="text"
          placeholder="Search receipt ID or item..."
          className="p-2.5 border rounded-lg text-sm w-full sm:w-64 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-green outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Mobile Receipt Cards (block md:hidden) */}
      <div className="block md:hidden space-y-3">
        {filteredSales.map((sale) => (
          <div
            key={sale.id}
            className={`p-4 rounded-xl shadow-sm border space-y-2.5 ${
              sale.status === 'returned' ? 'bg-red-50/70 border-red-200' : 'bg-white border-gray-100'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="font-mono font-bold text-sm bg-gray-100 px-2 py-0.5 rounded text-gray-800">
                  {sale.receiptId || sale.id.slice(-6)}
                </span>
                {sale.status === 'returned' && (
                  <span className="ml-2 text-xs text-red-600 font-black uppercase">Returned</span>
                )}
                <div className="text-[11px] text-gray-400 mt-1">
                  {new Date(sale.sale_date).toLocaleDateString()} {new Date(sale.sale_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="text-right">
                <span className={`text-base font-black ${sale.status === 'returned' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  Rs. {sale.total_amount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Items */}
            <div className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg space-y-1">
              {sale.items && sale.items.map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{item.productName} ({item.variantName}) x{item.quantity}</span>
                  <span className="font-medium text-gray-700">Rs. {(item.finalPrice * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {sale.status !== 'returned' && (
              <div className="pt-1 flex justify-end">
                <button
                  onClick={() => handleReturnClick(sale)}
                  className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 font-bold rounded-lg text-xs"
                >
                  Process Return
                </button>
              </div>
            )}
          </div>
        ))}
        {filteredSales.length === 0 && (
          <div className="bg-white p-8 rounded-xl text-center text-gray-400 text-sm border border-dashed">
            No sales records found.
          </div>
        )}
      </div>

      {/* Desktop Sales Table (hidden md:block) */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-6 py-3 text-left">Receipt ID</th>
              <th className="px-6 py-3 text-left">Date & Time</th>
              <th className="px-6 py-3 text-left">Items Purchased</th>
              <th className="px-6 py-3 text-right">Total Amount</th>
              <th className="px-6 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 text-sm">
            {filteredSales.map((sale) => (
              <tr key={sale.id} className={sale.status === 'returned' ? 'bg-red-50/60' : 'hover:bg-gray-50/60'}>
                <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-gray-900">
                   {sale.receiptId || '-'}
                   {sale.status === 'returned' && <span className="block text-xs text-red-600 font-bold uppercase">Returned</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(sale.sale_date).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="space-y-1">
                    {sale.items && sale.items.map((item, idx) => (
                      <div key={idx} className="text-xs">
                        <span className="font-medium">{item.productName} ({item.variantName})</span> x{item.quantity}
                        {item.discount > 0 && <span className="text-green-600 ml-1">(-{item.discount}%)</span>}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right font-black text-gray-900">
                  <span className={sale.status === 'returned' ? 'line-through text-gray-400' : ''}>
                    Rs. {sale.total_amount.toFixed(2)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                   {sale.status !== 'returned' && (
                       <button
                         onClick={() => handleReturnClick(sale)}
                         className="text-red-600 hover:text-red-800 font-bold text-xs bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition"
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
