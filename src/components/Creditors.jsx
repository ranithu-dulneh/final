import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { ref, onValue, push, serverTimestamp } from 'firebase/database';

export default function Creditors() {
  const [customersData, setCustomersData] = useState({});
  const [settlementsData, setSettlementsData] = useState({});
  const [showSettled, setShowSettled] = useState(false);
  const [selectedCreditor, setSelectedCreditor] = useState(null); // For Profile Modal
  const [settlementCreditor, setSettlementCreditor] = useState(null); // For Settlement Modal
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    const customersRef = ref(db, 'customers');
    const settlementsRef = ref(db, 'settlements');

    const unsubCustomers = onValue(customersRef, (snapshot) => {
      setCustomersData(snapshot.val() || {});
    });

    const unsubSettlements = onValue(settlementsRef, (snapshot) => {
      setSettlementsData(snapshot.val() || {});
    });

    return () => {
      unsubCustomers();
      unsubSettlements();
    };
  }, []);

  const creditors = useMemo(() => {
    const grouped = {};

    // Process Credit Sales (Debts)
    Object.entries(customersData).forEach(([key, sale]) => {
      const phone = sale.phone || 'Unknown';
      const name = sale.name || 'Unknown';

      if (!grouped[phone]) {
        grouped[phone] = { name, phone, debt: 0, settled: 0, transactions: [] };
      }

      // Use amount from sale record
      const debtAmount = parseFloat(sale.amount) || 0;

      grouped[phone].debt += debtAmount;
      grouped[phone].transactions.push({
        type: 'DEBT',
        date: sale.date || sale.timestamp, // prefer date string
        amount: debtAmount,
        description: sale.description,
        id: key
      });
    });

    // Process Settlements
    Object.entries(settlementsData).forEach(([key, payment]) => {
      const phone = payment.phone;
      if (!phone) return;

      if (!grouped[phone]) {
         // Create entry if settlement exists without debt (edge case)
         grouped[phone] = { name: payment.name || 'Unknown', phone, debt: 0, settled: 0, transactions: [] };
      }

      const settledAmount = parseFloat(payment.amount) || 0;

      grouped[phone].settled += settledAmount;
      grouped[phone].transactions.push({
        type: 'PAYMENT',
        date: payment.timestamp || payment.date, // prefer timestamp
        amount: settledAmount,
        note: payment.note,
        id: key
      });
    });

    return Object.values(grouped).map(c => ({
      ...c,
      balance: c.debt - c.settled
    })).sort((a, b) => b.balance - a.balance); // Highest debt first
  }, [customersData, settlementsData]);

  const filteredCreditors = creditors.filter(c => showSettled ? true : c.balance > 0.01); // Float tolerance

  const handleAddSettlement = () => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) return alert("Invalid amount");

    const settlementData = {
      phone: settlementCreditor.phone,
      name: settlementCreditor.name,
      amount: parseFloat(amount),
      note: note,
      timestamp: serverTimestamp(),
      date: new Date().toISOString() // Redundant but useful for UI consistent sorting if needed
    };

    push(ref(db, 'settlements'), settlementData)
      .then(() => {
        setSettlementCreditor(null);
        setAmount('');
        setNote('');
      })
      .catch(err => alert("Error adding settlement: " + err.message));
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Creditors Management</h2>
        <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Show Settled</span>
            <button
                onClick={() => setShowSettled(!showSettled)}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${showSettled ? 'bg-brand-green' : 'bg-gray-300'}`}
            >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${showSettled ? 'translate-x-6' : ''}`}></div>
            </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
            <tr>
              <th className="p-4">Name</th>
              <th className="p-4">Phone</th>
              <th className="p-4 text-right">Total Debt</th>
              <th className="p-4 text-right">Settled</th>
              <th className="p-4 text-right">Balance</th>
              <th className="p-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredCreditors.map(creditor => (
                <tr key={creditor.phone} className="hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-800">{creditor.name}</td>
                    <td className="p-4 text-gray-600">{creditor.phone}</td>
                    <td className="p-4 text-right text-red-500">Rs. {creditor.debt.toFixed(2)}</td>
                    <td className="p-4 text-right text-green-600">Rs. {creditor.settled.toFixed(2)}</td>
                    <td className="p-4 text-right font-bold text-gray-800">Rs. {creditor.balance.toFixed(2)}</td>
                    <td className="p-4 text-center space-x-2">
                        <button
                            onClick={() => setSettlementCreditor(creditor)}
                            className="bg-brand-green text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition"
                        >
                            Pay
                        </button>
                        <button
                             onClick={() => setSelectedCreditor(creditor)}
                             className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300 transition"
                        >
                            Profile
                        </button>
                    </td>
                </tr>
            ))}
            {filteredCreditors.length === 0 && (
                <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-500">No creditors found.</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Settlement Modal */}
      {settlementCreditor && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
             <div className="bg-white p-6 rounded-lg w-96 shadow-xl">
                 <h3 className="text-xl font-bold mb-4">Add Settlement</h3>
                 <p className="mb-4 text-gray-600">For: <span className="font-semibold">{settlementCreditor.name}</span></p>

                 <div className="space-y-4">
                     <div>
                         <label className="block text-sm text-gray-700 mb-1">Amount</label>
                         <input
                            type="number"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className="w-full border rounded p-2 focus:ring-2 focus:ring-brand-green outline-none"
                            placeholder="Amount"
                            autoFocus
                         />
                     </div>
                     <div>
                         <label className="block text-sm text-gray-700 mb-1">Note (Optional)</label>
                         <input
                            type="text"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            className="w-full border rounded p-2 focus:ring-2 focus:ring-brand-green outline-none"
                            placeholder="e.g. Bank Transfer"
                         />
                     </div>
                 </div>

                 <div className="mt-6 flex justify-end space-x-2">
                     <button onClick={() => setSettlementCreditor(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                     <button onClick={handleAddSettlement} className="px-4 py-2 bg-brand-green text-white rounded hover:bg-green-700">Confirm Payment</button>
                 </div>
             </div>
         </div>
      )}

      {/* Profile Modal */}
      {selectedCreditor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
                  <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                      <div>
                          <h3 className="text-xl font-bold text-gray-800">{selectedCreditor.name}</h3>
                          <p className="text-sm text-gray-500">{selectedCreditor.phone}</p>
                      </div>
                      <button onClick={() => setSelectedCreditor(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                  </div>

                  <div className="flex-1 overflow-auto p-6">
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="bg-red-50 p-4 rounded text-center">
                                <span className="block text-xs text-gray-500 uppercase">Total Debt</span>
                                <span className="text-xl font-bold text-red-600">Rs. {selectedCreditor.debt.toFixed(2)}</span>
                            </div>
                            <div className="bg-green-50 p-4 rounded text-center">
                                <span className="block text-xs text-gray-500 uppercase">Total Paid</span>
                                <span className="text-xl font-bold text-green-600">Rs. {selectedCreditor.settled.toFixed(2)}</span>
                            </div>
                            <div className="bg-gray-100 p-4 rounded text-center">
                                <span className="block text-xs text-gray-500 uppercase">Balance Due</span>
                                <span className="text-xl font-bold text-gray-800">Rs. {selectedCreditor.balance.toFixed(2)}</span>
                            </div>
                        </div>

                        <h4 className="font-bold text-gray-700 mb-3">Transaction History</h4>
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="p-3 text-left">Date</th>
                                        <th className="p-3 text-left">Type</th>
                                        <th className="p-3 text-left">Note/Desc</th>
                                        <th className="p-3 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {selectedCreditor.transactions.sort((a, b) => {
                                        // Handle mixed date formats (ISO string vs timestamp)
                                        const dateA = new Date(a.date).getTime() || a.date;
                                        const dateB = new Date(b.date).getTime() || b.date;
                                        return dateB - dateA;
                                    }).map((t, idx) => (
                                        <tr key={idx} className={t.type === 'PAYMENT' ? 'bg-green-50/50' : ''}>
                                            <td className="p-3 text-gray-600">
                                                {new Date(t.date).toLocaleDateString()} {new Date(t.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${t.type === 'DEBT' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                    {t.type}
                                                </span>
                                            </td>
                                            <td className="p-3 text-gray-700">{t.description || t.note || '-'}</td>
                                            <td className={`p-3 text-right font-medium ${t.type === 'DEBT' ? 'text-red-600' : 'text-green-600'}`}>
                                                {t.type === 'PAYMENT' ? '-' : '+'} Rs. {t.amount.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
