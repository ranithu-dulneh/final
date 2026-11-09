import React, { useState, useEffect, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { db } from '../firebase';
import { ref, onValue, push, set } from "firebase/database";

export default function Finances() {
  const [activeTab, setActiveTab] = useState('pnl');
  const [expenses, setExpenses] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [sales, setSales] = useState([]);

  // Filters
  const [filterType, setFilterType] = useState('today');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  // Forms
  const [expenseForm, setExpenseForm] = useState({ description: '', category: 'Wages', amount: '' });
  const [drawingForm, setDrawingForm] = useState({ description: '', amount: '' });

  const [message, setMessage] = useState('');

  useEffect(() => {
    const expensesRef = ref(db, 'expenses');
    onValue(expensesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            setExpenses(Object.entries(data).map(([id, val]) => ({ id, ...val })).reverse());
        } else {
            setExpenses([]);
        }
    });

    const drawingsRef = ref(db, 'drawings');
    onValue(drawingsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            setDrawings(Object.entries(data).map(([id, val]) => ({ id, ...val })).reverse());
        } else {
            setDrawings([]);
        }
    });

    const salesRef = ref(db, 'sales');
    onValue(salesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            setSales(Object.entries(data).map(([id, val]) => ({ id, ...val })));
        } else {
            setSales([]);
        }
    });
  }, []);

  // Filter Data using useMemo
  const { filteredSales, filteredExpenses, filteredDrawings } = useMemo(() => {
      let start = new Date();
      let end = new Date();

      if (filterType === 'today') {
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
      } else if (filterType === '7days') {
          start.setDate(end.getDate() - 7);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
      } else if (filterType === 'month') {
          start.setDate(1);
          start.setHours(0, 0, 0, 0);
          // End of current month
          end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
      } else if (filterType === 'custom') {
          start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
      }

      // Filter Sales
      const fs = sales.filter(s => {
          if (!s.date) return false;
          const d = new Date(s.date);
          return d >= start && d <= end;
      });

      // Filter Expenses
      const fe = expenses.filter(e => {
          if (!e.expense_date) return false;
          const d = new Date(e.expense_date);
          return d >= start && d <= end;
      });

      // Filter Drawings
      const fd = drawings.filter(d => {
          if (!d.drawing_date) return false;
          const dd = new Date(d.drawing_date);
          return dd >= start && dd <= end;
      });

      return { filteredSales: fs, filteredExpenses: fe, filteredDrawings: fd };

  }, [sales, expenses, drawings, filterType, startDate, endDate]);

  // Calculate P&L on filtered data using useMemo
  const pnlData = useMemo(() => {
        let revenue = 0;
        let cogs = 0;

        filteredSales.forEach(sale => {
            if (sale.items) {
                sale.items.forEach(item => {
                   revenue += (item.price * item.quantity);
                   if (item.cost_price) {
                       cogs += (item.cost_price * item.quantity);
                   }
                });
            }
        });

        const totalExpenses = filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        const totalDrawings = filteredDrawings.reduce((sum, d) => sum + parseFloat(d.amount), 0);
        const grossProfit = revenue - cogs;
        const netProfit = grossProfit - totalExpenses;

        return {
            revenue,
            cogs,
            grossProfit,
            totalExpenses,
            netProfit,
            totalDrawings
        };
  }, [filteredSales, filteredExpenses, filteredDrawings]);


  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
        const expensesRef = ref(db, 'expenses');
        const newRef = push(expensesRef);
        await set(newRef, {
            ...expenseForm,
            expense_date: new Date().toISOString()
        });
        setMessage('Expense added');
        setExpenseForm({ description: '', category: 'Wages', amount: '' });
        setTimeout(() => setMessage(''), 3000);
    } catch (err) {
        console.error(err);
    }
  };

  const handleAddDrawing = async (e) => {
    e.preventDefault();
    try {
        const drawingsRef = ref(db, 'drawings');
        const newRef = push(drawingsRef);
        await set(newRef, {
            ...drawingForm,
            drawing_date: new Date().toISOString()
        });
        setMessage('Drawing recorded');
        setDrawingForm({ description: '', amount: '' });
        setTimeout(() => setMessage(''), 3000);
    } catch (err) {
        console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Date Filters */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <label className="text-xs sm:text-sm font-bold text-gray-700">Date Range:</label>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="p-2.5 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-brand-green outline-none"
        >
          <option value="today">Today</option>
          <option value="7days">Last 7 Days</option>
          <option value="month">This Month</option>
          <option value="custom">Custom Range</option>
        </select>

        {filterType === 'custom' && (
          <div className="flex gap-2 items-center flex-wrap">
            <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                className="p-2 border rounded-lg text-xs w-28 bg-gray-50"
                placeholderText="Start Date"
            />
            <span className="text-gray-400 text-xs">to</span>
            <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                className="p-2 border rounded-lg text-xs w-28 bg-gray-50"
                placeholderText="End Date"
            />
          </div>
        )}
      </div>

      {/* Segmented Tab Navigation */}
      <div className="flex p-1 bg-gray-200/70 rounded-xl gap-1 text-xs sm:text-sm font-bold">
        <button
          onClick={() => setActiveTab('pnl')}
          className={`flex-1 py-2.5 px-2 rounded-lg transition text-center ${activeTab === 'pnl' ? 'bg-white text-brand-green shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          P&L Report
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex-1 py-2.5 px-2 rounded-lg transition text-center ${activeTab === 'expenses' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          Expenses
        </button>
        <button
          onClick={() => setActiveTab('drawings')}
          className={`flex-1 py-2.5 px-2 rounded-lg transition text-center ${activeTab === 'drawings' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          Drawings
        </button>
      </div>

      {message && <div className="p-2 bg-green-100 text-green-700 rounded">{message}</div>}

      {activeTab === 'pnl' && pnlData && (
        <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center border-b pb-2">
            Profit & Loss Statement
            <span className="text-sm font-normal text-gray-500 ml-2">
                ({filterType === 'today' ? 'Today' :
                  filterType === '7days' ? 'Last 7 Days' :
                  filterType === 'month' ? 'This Month' : 'Custom Range'})
            </span>
          </h2>

          <div className="space-y-4">
             <div className="flex justify-between text-lg">
                <span className="font-semibold text-gray-700">Total Revenue (Sales)</span>
                <span className="font-bold text-gray-900">Rs. {pnlData.revenue.toFixed(2)}</span>
             </div>
             <div className="flex justify-between text-red-600">
                <span>Cost of Goods Sold (COGS)</span>
                <span>- Rs. {pnlData.cogs.toFixed(2)}</span>
             </div>
             <div className="flex justify-between text-xl font-bold border-t pt-2">
                <span>Gross Profit</span>
                <span>Rs. {pnlData.grossProfit.toFixed(2)}</span>
             </div>

             <div className="py-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Expenses</h3>
                <div className="flex justify-between text-red-600 pl-4">
                   <span>Total Expenses</span>
                   <span>- Rs. {pnlData.totalExpenses.toFixed(2)}</span>
                </div>
             </div>

             <div className="flex justify-between text-2xl font-bold border-t border-b py-4 bg-gray-50 p-4 rounded">
                <span>Net Profit</span>
                <span className={pnlData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>Rs. {pnlData.netProfit.toFixed(2)}</span>
             </div>

             <div className="mt-8 pt-4 border-t border-dashed text-gray-500 text-sm">
                <div className="flex justify-between">
                   <span>Owner Drawings (Cash Out)</span>
                   <span>Rs. {pnlData.totalDrawings.toFixed(2)}</span>
                </div>
                <p className="text-xs mt-1">* Drawings are equity withdrawals and do not reduce Net Profit.</p>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-bold mb-4">Add Expense</h3>
              <form onSubmit={handleAddExpense} className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Category</label>
                    <select
                      className="w-full p-2 border rounded"
                      value={expenseForm.category}
                      onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}
                    >
                       <option>Wages</option>
                       <option>Rent</option>
                       <option>Utilities</option>
                       <option>Supplies</option>
                       <option>Maintenance</option>
                       <option>Other</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Amount (Rs.)</label>
                    <input
                      type="number" step="0.01" required
                      className="w-full p-2 border rounded"
                      value={expenseForm.amount}
                      onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <input
                      type="text" required
                      className="w-full p-2 border rounded"
                      value={expenseForm.description}
                      onChange={e => setExpenseForm({...expenseForm, description: e.target.value})}
                    />
                 </div>
                 <button type="submit" className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700">Record Expense</button>
              </form>
           </div>

           <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-base sm:text-lg font-bold mb-3 text-gray-800">
                Expenses ({filterType === 'today' ? 'Today' : filterType === '7days' ? 'Last 7 Days' : filterType === 'month' ? 'This Month' : 'Custom'})
              </h3>

              {/* Mobile Cards */}
              <div className="block md:hidden space-y-2">
                {filteredExpenses.map(e => (
                  <div key={e.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-gray-800 block text-sm">{e.category}</span>
                      <span className="text-gray-500">{e.description}</span>
                      <span className="text-[10px] text-gray-400 block mt-0.5">{new Date(e.expense_date).toLocaleDateString()}</span>
                    </div>
                    <span className="font-black text-red-600 text-sm">Rs. {parseFloat(e.amount).toFixed(2)}</span>
                  </div>
                ))}
                {filteredExpenses.length === 0 && <p className="text-gray-400 text-center py-4 text-xs">No expenses found for this period.</p>}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-auto">
                <table className="min-w-full">
                   <thead>
                      <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                         <th className="pb-2">Date</th>
                         <th className="pb-2">Category</th>
                         <th className="pb-2">Description</th>
                         <th className="pb-2 text-right">Amount</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                      {filteredExpenses.map(e => (
                         <tr key={e.id} className="text-sm">
                            <td className="py-2.5 text-gray-500">{new Date(e.expense_date).toLocaleDateString()}</td>
                            <td className="py-2.5 font-bold text-gray-800">{e.category}</td>
                            <td className="py-2.5 text-gray-600">{e.description}</td>
                            <td className="py-2.5 font-black text-right text-red-600">Rs. {parseFloat(e.amount).toFixed(2)}</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
                {filteredExpenses.length === 0 && <p className="text-gray-400 text-center py-4 text-xs">No expenses found for this period.</p>}
              </div>
           </div>
        </div>
      )}

      {activeTab === 'drawings' && (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-bold mb-4">Record Owner Drawing</h3>
              <form onSubmit={handleAddDrawing} className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Amount (Rs.)</label>
                    <input
                      type="number" step="0.01" required
                      className="w-full p-2 border rounded"
                      value={drawingForm.amount}
                      onChange={e => setDrawingForm({...drawingForm, amount: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Description / Note</label>
                    <input
                      type="text"
                      className="w-full p-2 border rounded"
                      value={drawingForm.description}
                      onChange={e => setDrawingForm({...drawingForm, description: e.target.value})}
                    />
                 </div>
                 <button type="submit" className="w-full bg-orange-500 text-white py-2 rounded hover:bg-orange-600">Record Drawing</button>
              </form>
           </div>

           <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-base sm:text-lg font-bold mb-3 text-gray-800">
                Drawings ({filterType === 'today' ? 'Today' : filterType === '7days' ? 'Last 7 Days' : filterType === 'month' ? 'This Month' : 'Custom'})
              </h3>

              {/* Mobile Cards */}
              <div className="block md:hidden space-y-2">
                {filteredDrawings.map(d => (
                  <div key={d.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-gray-800 block text-sm">{d.description || 'Owner Drawing'}</span>
                      <span className="text-[10px] text-gray-400 block mt-0.5">{new Date(d.drawing_date).toLocaleDateString()}</span>
                    </div>
                    <span className="font-black text-orange-600 text-sm">Rs. {parseFloat(d.amount).toFixed(2)}</span>
                  </div>
                ))}
                {filteredDrawings.length === 0 && <p className="text-gray-400 text-center py-4 text-xs">No drawings found for this period.</p>}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-auto">
                <table className="min-w-full">
                   <thead>
                      <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                         <th className="pb-2">Date</th>
                         <th className="pb-2">Note / Description</th>
                         <th className="pb-2 text-right">Amount</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                      {filteredDrawings.map(d => (
                         <tr key={d.id} className="text-sm">
                            <td className="py-2.5 text-gray-500">{new Date(d.drawing_date).toLocaleDateString()}</td>
                            <td className="py-2.5 text-gray-800 font-medium">{d.description || '-'}</td>
                            <td className="py-2.5 font-black text-right text-orange-600">Rs. {parseFloat(d.amount).toFixed(2)}</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
                {filteredDrawings.length === 0 && <p className="text-gray-400 text-center py-4 text-xs">No drawings found for this period.</p>}
              </div>
           </div>
         </div>
      )}
    </div>
  );
}
