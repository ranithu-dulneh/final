import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue } from "firebase/database";

export default function Creditors() {
  const [creditRecords, setCreditRecords] = useState([]);
  const [creditors, setCreditors] = useState([]);
  const [selectedCreditor, setSelectedCreditor] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const customersRef = ref(db, 'customers');
    const unsubscribe = onValue(customersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const rawRecords = Object.entries(data).map(([id, val]) => ({
          id,
          ...val
        }));
        setCreditRecords(rawRecords);

        // Aggregate by Phone (primary) or Name
        const aggMap = new Map();

        rawRecords.forEach(record => {
            // Key: prefer phone, fallback to name + phone (in case multiple johns have no phone, unlikely but safe)
            // Actually, if phone is empty, we might merge by name.
            // Let's use Name + Phone as key if phone exists, else Name.
            // Better: use Phone if available. If not, separate by ID? No, user wants aggregation.
            // Let's assume unique entity is defined by Phone if present, else Name.

            const key = record.phone ? record.phone.trim() : record.name.trim();

            if (!aggMap.has(key)) {
                aggMap.set(key, {
                    key,
                    name: record.name,
                    phone: record.phone,
                    totalDebt: 0,
                    transactions: []
                });
            }

            const creditor = aggMap.get(key);
            creditor.totalDebt += parseFloat(record.amount || 0);
            creditor.transactions.push(record);
        });

        setCreditors(Array.from(aggMap.values()));
      } else {
        setCreditRecords([]);
        setCreditors([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const filteredCreditors = creditors.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm))
  );

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center">
         <h2 className="text-2xl font-bold text-gray-800">Creditors</h2>
         <div className="w-1/3">
             <input
                type="text"
                placeholder="Search creditors..."
                className="w-full p-2 border rounded"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
             />
         </div>
      </div>

      <div className="flex-1 overflow-auto bg-white rounded-lg shadow">
         {selectedCreditor ? (
             <div className="p-6">
                 <button
                    onClick={() => setSelectedCreditor(null)}
                    className="mb-4 text-sm text-blue-600 hover:underline flex items-center"
                 >
                    &larr; Back to List
                 </button>
                 <div className="border-b pb-4 mb-4">
                     <h3 className="text-xl font-bold">{selectedCreditor.name}</h3>
                     <p className="text-gray-500">{selectedCreditor.phone}</p>
                     <p className="text-2xl font-bold text-red-600 mt-2">Total Debt: Rs. {selectedCreditor.totalDebt.toFixed(2)}</p>
                 </div>

                 <h4 className="font-semibold mb-2">Transaction History</h4>
                 <table className="min-w-full divide-y divide-gray-200">
                     <thead className="bg-gray-50">
                         <tr>
                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Note / Items</th>
                             <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                         </tr>
                     </thead>
                     <tbody className="bg-white divide-y divide-gray-200">
                         {selectedCreditor.transactions.sort((a,b) => new Date(b.date) - new Date(a.date)).map(tx => (
                             <tr key={tx.id}>
                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                     {new Date(tx.date).toLocaleString()}
                                 </td>
                                 <td className="px-6 py-4 text-sm text-gray-900">
                                     {tx.description}
                                 </td>
                                 <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                                     Rs. {parseFloat(tx.amount).toFixed(2)}
                                 </td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </div>
         ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Credit</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCreditors.map((creditor) => (
                  <tr key={creditor.key} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {creditor.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {creditor.phone || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {creditor.transactions.length}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-red-600">
                      Rs. {creditor.totalDebt.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setSelectedCreditor(creditor)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCreditors.length === 0 && (
                    <tr>
                        <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                            No creditors found.
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
         )}
      </div>
    </div>
  );
}
