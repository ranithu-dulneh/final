import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { ref, onValue, push, set } from "firebase/database";

export default function Creditors() {
  const [transactions, setTransactions] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCreditor, setSelectedCreditor] = useState(null); // For settlement modal
  const [viewingProfile, setViewingProfile] = useState(null); // For profile modal
  const [showSettled, setShowSettled] = useState(false);

  // Fetch Data
  useEffect(() => {
    const customersRef = ref(db, 'customers');
    const settlementsRef = ref(db, 'settlements');

    const unsubCustomers = onValue(customersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTransactions(Object.entries(data).map(([id, val]) => ({ id, ...val })));
      } else {
        setTransactions([]);
      }
    });

    const unsubSettlements = onValue(settlementsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSettlements(Object.entries(data).map(([id, val]) => ({ id, ...val })));
      } else {
        setSettlements([]);
      }
    });

    return () => {
      unsubCustomers();
      unsubSettlements();
    };
  }, []);

  // Aggregation Logic
  const creditorsList = useMemo(() => {
    const groups = {};

    // Process Credit Sales (Debts)
    transactions.forEach(t => {
      const phone = t.phone || 'Unknown';
      if (!groups[phone]) {
        groups[phone] = {
          phone,
          name: t.name, // Assume consistent name for phone
          totalDebt: 0,
          totalSettled: 0,
          history: [] // For detailed view if needed later
        };
      }
      // If name updates, we might want to track that, but for now stick to first found or update
      if (t.name) groups[phone].name = t.name;

      const amount = parseFloat(t.amount) || 0;
      groups[phone].totalDebt += amount;
      groups[phone].history.push({
        type: 'Credit',
        date: t.date,
        amount: amount,
        description: t.description
      });
    });

    // Process Settlements
    settlements.forEach(s => {
      const phone = s.phone || 'Unknown';
      if (!groups[phone]) {
        // If settlement exists without debt (edge case), create entry
        groups[phone] = {
          phone,
          name: s.customerName || 'Unknown',
          totalDebt: 0,
          totalSettled: 0,
          history: []
        };
      }
      const amount = parseFloat(s.amount) || 0;
      groups[phone].totalSettled += amount;
      groups[phone].history.push({
        type: 'Settlement',
        date: s.date,
        amount: amount,
        description: s.description
      });
    });

    // Convert to array, calculate balance, filter
    return Object.values(groups)
      .map(g => ({
        ...g,
        balance: g.totalDebt - g.totalSettled
      }))
      .filter(g => showSettled ? true : g.balance > 0.01) // Show all if toggle on, else only active debts. Tolerance for float errors
      .sort((a, b) => b.balance - a.balance); // Highest debt first

  }, [transactions, settlements, showSettled]);

  // Filtering
  const filteredCreditors = creditorsList.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
         <div>
            <h2 className="text-2xl font-bold text-gray-800">Creditors Management</h2>
            <p className="text-sm text-gray-500">Manage outstanding debts and settlements</p>
         </div>
         <div className="flex items-center gap-4 w-full sm:w-auto">
             <div className="flex items-center gap-2">
                 <input
                    type="checkbox"
                    id="showSettled"
                    checked={showSettled}
                    onChange={(e) => setShowSettled(e.target.checked)}
                    className="w-4 h-4 text-brand-green rounded focus:ring-brand-green"
                 />
                 <label htmlFor="showSettled" className="text-sm text-gray-700 cursor-pointer select-none">Show Settled</label>
             </div>
             <input
               type="text"
               placeholder="Search Name or Phone..."
               className="p-3 border rounded-lg shadow-sm w-full sm:w-64 focus:ring-2 focus:ring-brand-green outline-none"
               value={search}
               onChange={e => setSearch(e.target.value)}
             />
         </div>
      </div>

      <div className="flex-1 overflow-auto bg-white rounded-lg shadow border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Debt</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Settled</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCreditors.length === 0 ? (
                <tr>
                    <td colSpan="6" className="px-6 py-10 text-center text-gray-400">
                        {showSettled ? "No creditor records found." : "No outstanding creditors found."}
                    </td>
                </tr>
            ) : (
                filteredCreditors.map((creditor) => (
                    <tr key={creditor.phone} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{creditor.name}</div>
                            <div className="text-xs text-gray-400">{creditor.history.length} Transactions</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {creditor.phone}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                            Rs. {creditor.totalDebt.toFixed(2)}
                        </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                            Rs. {creditor.totalSettled.toFixed(2)}
                        </td>
                         <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${creditor.balance < 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} text-sm`}>
                                Rs. {creditor.balance.toFixed(2)}
                            </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center space-x-2">
                            <button
                                onClick={() => setViewingProfile(creditor)}
                                className="text-brand-green hover:underline text-sm font-medium"
                            >
                                Profile
                            </button>
                            {creditor.balance > 0.01 && (
                                <button
                                    onClick={() => setSelectedCreditor(creditor)}
                                    className="bg-brand-green text-white px-3 py-1 rounded text-sm font-medium hover:bg-green-700 transition-colors"
                                >
                                    Settle
                                </button>
                            )}
                        </td>
                    </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      {/* Settlement Modal */}
      {selectedCreditor && (
        <SettlementModal
            creditor={selectedCreditor}
            onClose={() => setSelectedCreditor(null)}
        />
      )}

      {/* Profile Modal */}
      {viewingProfile && (
        <ProfileModal
            creditor={viewingProfile}
            onClose={() => setViewingProfile(null)}
        />
      )}
    </div>
  );
}

function SettlementModal({ creditor, onClose }) {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        const val = parseFloat(amount);
        if (!val || val <= 0) {
            alert("Please enter a valid amount");
            return;
        }
        if (val > creditor.balance) {
             if(!confirm(`Amount (Rs. ${val}) exceeds balance (Rs. ${creditor.balance}). Continue?`)) {
                 return;
             }
        }

        setLoading(true);
        try {
            const settlementsRef = ref(db, 'settlements');
            const newSettlementRef = push(settlementsRef);
            await set(newSettlementRef, {
                phone: creditor.phone,
                customerName: creditor.name,
                amount: val,
                description: description || 'Payment',
                date: new Date().toISOString()
            });
            onClose();
        } catch (e) {
            console.error(e);
            alert("Error saving settlement: " + e.message);
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-full max-w-sm shadow-xl">
                <h3 className="text-xl font-bold mb-2">Settlement</h3>
                <p className="text-gray-600 mb-4">
                    For: <span className="font-bold">{creditor.name}</span> <br/>
                    Balance: <span className="text-red-600 font-bold">Rs. {creditor.balance.toFixed(2)}</span>
                </p>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <input
                        type="number"
                        autoFocus
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-green outline-none text-lg font-bold"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="0.00"
                    />
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Note (Optional)</label>
                    <input
                        type="text"
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-green outline-none"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="e.g. Cash payment"
                    />
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 border rounded text-gray-600 hover:bg-gray-50"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="flex-1 py-2 bg-brand-green text-white rounded font-bold hover:bg-green-700 disabled:bg-gray-400"
                        disabled={loading}
                    >
                        {loading ? 'Saving...' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ProfileModal({ creditor, onClose }) {
    const sortedHistory = [...creditor.history].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-full max-w-2xl shadow-xl h-[80vh] flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">{creditor.name}</h3>
                        <p className="text-sm text-gray-500">{creditor.phone}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
                    <div className="text-center border-r border-gray-200">
                        <div className="text-xs text-gray-500 uppercase">Total Debt</div>
                        <div className="font-bold text-gray-800">Rs. {creditor.totalDebt.toFixed(2)}</div>
                    </div>
                    <div className="text-center border-r border-gray-200">
                        <div className="text-xs text-gray-500 uppercase">Total Settled</div>
                        <div className="font-bold text-green-600">Rs. {creditor.totalSettled.toFixed(2)}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-gray-500 uppercase">Balance</div>
                        <div className={`font-bold ${creditor.balance < 1 ? 'text-green-600' : 'text-red-600'}`}>Rs. {creditor.balance.toFixed(2)}</div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sortedHistory.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-sm text-gray-600 whitespace-nowrap">
                                        {new Date(item.date).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-2 text-sm">
                                        <span className={`px-2 py-0.5 rounded text-xs ${item.type === 'Credit' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                            {item.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-600">
                                        {item.description || '-'}
                                    </td>
                                    <td className={`px-4 py-2 text-sm font-medium text-right ${item.type === 'Credit' ? 'text-gray-900' : 'text-green-600'}`}>
                                        Rs. {item.amount.toFixed(2)}
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
