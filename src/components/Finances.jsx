import React, { useState, useEffect } from 'react';

export default function Finances() {
  const [activeTab, setActiveTab] = useState('pnl');
  const [expenses, setExpenses] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [pnlData, setPnlData] = useState(null);

  // Forms
  const [expenseForm, setExpenseForm] = useState({ description: '', category: 'Wages', amount: '' });
  const [drawingForm, setDrawingForm] = useState({ description: '', amount: '' });

  const [message, setMessage] = useState('');

  const fetchExpenses = () => fetch('/api/expenses').then(r => r.json()).then(d => setExpenses(d.data || []));
  const fetchDrawings = () => fetch('/api/drawings').then(r => r.json()).then(d => setDrawings(d.data || []));
  const fetchPnl = () => fetch('/api/pnl').then(r => r.json()).then(d => setPnlData(d));

  useEffect(() => {
    if (activeTab === 'expenses') fetchExpenses();
    if (activeTab === 'drawings') fetchDrawings();
    if (activeTab === 'pnl') fetchPnl();
  }, [activeTab]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expenseForm)
    });
    if (res.ok) {
       setMessage('Expense added');
       setExpenseForm({ description: '', category: 'Wages', amount: '' });
       fetchExpenses();
       setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleAddDrawing = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/drawings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(drawingForm)
    });
    if (res.ok) {
       setMessage('Drawing recorded');
       setDrawingForm({ description: '', amount: '' });
       fetchDrawings();
       setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow-sm flex space-x-4">
        <button onClick={() => setActiveTab('pnl')} className={`px-4 py-2 rounded ${activeTab === 'pnl' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>P&L Statement</button>
        <button onClick={() => setActiveTab('expenses')} className={`px-4 py-2 rounded ${activeTab === 'expenses' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Expenses</button>
        <button onClick={() => setActiveTab('drawings')} className={`px-4 py-2 rounded ${activeTab === 'drawings' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Drawings</button>
      </div>

      {message && <div className="p-2 bg-green-100 text-green-700 rounded">{message}</div>}

      {activeTab === 'pnl' && pnlData && (
        <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center border-b pb-2">Profit & Loss Statement</h2>

          <div className="space-y-4">
             <div className="flex justify-between text-lg">
                <span className="font-semibold text-gray-700">Total Revenue (Sales)</span>
                <span className="font-bold text-gray-900">${pnlData.revenue.toFixed(2)}</span>
             </div>
             <div className="flex justify-between text-red-600">
                <span>Cost of Goods Sold (COGS)</span>
                <span>- ${pnlData.cogs.toFixed(2)}</span>
             </div>
             <div className="flex justify-between text-xl font-bold border-t pt-2">
                <span>Gross Profit</span>
                <span>${pnlData.grossProfit.toFixed(2)}</span>
             </div>

             <div className="py-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Expenses</h3>
                <div className="flex justify-between text-red-600 pl-4">
                   <span>Total Expenses</span>
                   <span>- ${pnlData.totalExpenses.toFixed(2)}</span>
                </div>
             </div>

             <div className="flex justify-between text-2xl font-bold border-t border-b py-4 bg-gray-50 p-4 rounded">
                <span>Net Profit</span>
                <span className={pnlData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>${pnlData.netProfit.toFixed(2)}</span>
             </div>

             <div className="mt-8 pt-4 border-t border-dashed text-gray-500 text-sm">
                <div className="flex justify-between">
                   <span>Owner Drawings (Cash Out)</span>
                   <span>${pnlData.totalDrawings.toFixed(2)}</span>
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
                    <label className="block text-sm font-medium text-gray-700">Amount ($)</label>
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

           <div className="bg-white p-6 rounded-lg shadow overflow-auto">
              <h3 className="text-lg font-bold mb-4">Recent Expenses</h3>
              <table className="min-w-full">
                 <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                       <th className="pb-2">Date</th>
                       <th className="pb-2">Category</th>
                       <th className="pb-2">Desc</th>
                       <th className="pb-2 text-right">Amount</th>
                    </tr>
                 </thead>
                 <tbody>
                    {expenses.map(e => (
                       <tr key={e.id} className="border-t">
                          <td className="py-2 text-sm">{new Date(e.expense_date).toLocaleDateString()}</td>
                          <td className="py-2 text-sm font-medium">{e.category}</td>
                          <td className="py-2 text-sm text-gray-500">{e.description}</td>
                          <td className="py-2 text-sm font-bold text-right">${e.amount.toFixed(2)}</td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {activeTab === 'drawings' && (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-bold mb-4">Record Owner Drawing</h3>
              <form onSubmit={handleAddDrawing} className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Amount ($)</label>
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

           <div className="bg-white p-6 rounded-lg shadow overflow-auto">
              <h3 className="text-lg font-bold mb-4">Recent Drawings</h3>
              <table className="min-w-full">
                 <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                       <th className="pb-2">Date</th>
                       <th className="pb-2">Note</th>
                       <th className="pb-2 text-right">Amount</th>
                    </tr>
                 </thead>
                 <tbody>
                    {drawings.map(d => (
                       <tr key={d.id} className="border-t">
                          <td className="py-2 text-sm">{new Date(d.drawing_date).toLocaleDateString()}</td>
                          <td className="py-2 text-sm text-gray-500">{d.description}</td>
                          <td className="py-2 text-sm font-bold text-right">${d.amount.toFixed(2)}</td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
         </div>
      )}
    </div>
  );
}
