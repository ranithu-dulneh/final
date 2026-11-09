import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { ref, onValue, push, serverTimestamp } from 'firebase/database';

export default function Creditors() {
  const [customersData, setCustomersData] = useState({});
  const [settlementsData, setSettlementsData] = useState({});
  const [showSettled, setShowSettled] = useState(false);
  const [selectedCreditor, setSelectedCreditor] = useState(null); // For Profile Modal
  const [settlementCreditor, setSettlementCreditor] = useState(null); // For Settlement Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); // For Add Creditor Modal
  
  // Settlement Form State
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementNote, setSettlementNote] = useState('');
  const [settlementSubmitting, setSettlementSubmitting] = useState(false);

  // Manual Creditor Form State
  const [formMode, setFormMode] = useState('new'); // 'new' | 'existing'
  const [formData, setFormData] = useState({
    name: '',
    idNo: '',
    phone: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    address: '',
    dueDate: '',
    creditorKey: ''
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Modal Search for Existing Creditors
  const [existingSearchQuery, setExistingSearchQuery] = useState('');

  // Conflict Resolution State
  // When an entered name matches an existing creditor
  const [duplicateConflict, setDuplicateConflict] = useState(null); // { existingCreditor, pendingRecord }
  const [renamePrompt, setRenamePrompt] = useState(null); // { existingCreditor, pendingRecord, suggestedName, currentName }

  // Search State for Main Table
  const [searchTerm, setSearchTerm] = useState('');

  const nameInputRef = useRef(null);
  const renameInputRef = useRef(null);

  useEffect(() => {
    const customersRef = ref(db, 'customers');
    const settlementsRef = ref(db, 'settlements');

    const unsubCustomers = onValue(customersRef, (snapshot) => {
      setCustomersData(snapshot.val() || {});
    }, (err) => {
      console.error("Error reading customers:", err);
    });

    const unsubSettlements = onValue(settlementsRef, (snapshot) => {
      setSettlementsData(snapshot.val() || {});
    }, (err) => {
      console.error("Error reading settlements:", err);
    });

    return () => {
      unsubCustomers();
      unsubSettlements();
    };
  }, []);

  // Helper to determine a consistent creditor group key
  const getCreditorKey = (record) => {
    if (record.creditorKey) return record.creditorKey;
    const phone = (record.phone || '').toString().trim();
    if (phone && phone !== 'Unknown' && phone !== '-') return `phone_${phone}`;
    const idNo = (record.idNo || record.nic || '').toString().trim();
    if (idNo && idNo !== '-') return `id_${idNo.toLowerCase()}`;
    const name = (record.name || 'Unknown').toString().trim().toLowerCase();
    return `name_${name}`;
  };

  const creditors = useMemo(() => {
    const grouped = {};

    // Process Credit Sales & Manual Debts
    Object.entries(customersData).forEach(([key, sale]) => {
      const cKey = getCreditorKey(sale);
      const name = (sale.name || '').trim() || 'Unknown';
      const phone = (sale.phone || '').trim();
      const idNo = (sale.idNo || sale.nic || '').trim();
      const address = (sale.address || '').trim();

      if (!grouped[cKey]) {
        grouped[cKey] = {
          key: cKey,
          name,
          phone: phone || '-',
          idNo: idNo || '-',
          address: address || '',
          debt: 0,
          settled: 0,
          transactions: []
        };
      }

      // Update missing info if available in subsequent transactions
      if (name && grouped[cKey].name === 'Unknown') grouped[cKey].name = name;
      if (phone && grouped[cKey].phone === '-') grouped[cKey].phone = phone;
      if (idNo && grouped[cKey].idNo === '-') grouped[cKey].idNo = idNo;
      if (address && !grouped[cKey].address) grouped[cKey].address = address;

      const debtAmount = parseFloat(sale.amount) || 0;
      grouped[cKey].debt += debtAmount;

      grouped[cKey].transactions.push({
        type: sale.type === 'RETURN' ? 'RETURN' : 'DEBT',
        date: sale.date || sale.timestamp,
        amount: debtAmount,
        description: sale.description || (sale.manual ? 'Manual Credit Entry' : 'Credit Sale'),
        receiptId: sale.receiptId || null,
        manual: !!sale.manual,
        idNo: idNo || null,
        address: address || null,
        dueDate: sale.dueDate || null,
        id: key
      });
    });

    // Process Settlements
    Object.entries(settlementsData).forEach(([key, payment]) => {
      const cKey = getCreditorKey(payment);

      if (!grouped[cKey]) {
        grouped[cKey] = {
          key: cKey,
          name: payment.name || 'Unknown',
          phone: payment.phone || '-',
          idNo: payment.idNo || '-',
          address: '',
          debt: 0,
          settled: 0,
          transactions: []
        };
      }

      const settledAmount = parseFloat(payment.amount) || 0;
      grouped[cKey].settled += settledAmount;

      grouped[cKey].transactions.push({
        type: 'PAYMENT',
        date: payment.timestamp || payment.date,
        amount: settledAmount,
        note: payment.note,
        id: key
      });
    });

    return Object.values(grouped).map(c => ({
      ...c,
      balance: c.debt - c.settled
    })).sort((a, b) => b.balance - a.balance);
  }, [customersData, settlementsData]);

  // Main table filter
  const filteredCreditors = useMemo(() => {
    return creditors.filter(c => {
      const matchesShow = showSettled ? true : c.balance > 0.01;

      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = searchTerm === '' ||
        c.name.toLowerCase().includes(searchLower) ||
        c.phone.toLowerCase().includes(searchLower) ||
        c.idNo.toLowerCase().includes(searchLower) ||
        (c.address && c.address.toLowerCase().includes(searchLower)) ||
        c.transactions.some(t =>
          (t.receiptId && t.receiptId.toLowerCase().includes(searchLower)) ||
          (t.description && t.description.toLowerCase().includes(searchLower)) ||
          (t.note && t.note.toLowerCase().includes(searchLower))
        );

      return matchesShow && matchesSearch;
    });
  }, [creditors, showSettled, searchTerm]);

  // Search existing creditors in the Add Creditor modal
  const searchedExistingCreditors = useMemo(() => {
    if (!existingSearchQuery.trim()) return [];
    const q = existingSearchQuery.toLowerCase().trim();
    return creditors.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.idNo && c.idNo.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [creditors, existingSearchQuery]);

  // Generate smart name suggestions for new account when duplicate name occurs
  const getNameSuggestions = (baseName, idNo, address) => {
    const suggestions = [];
    const lower = baseName.toLowerCase().trim();

    // 1. Numbered: Name (2), Name (3), etc.
    let num = 2;
    while (creditors.some(c => c.name.toLowerCase().trim() === `${lower} (${num})`)) {
      num++;
    }
    suggestions.push(`${baseName.trim()} (${num})`);

    // 2. ID / NIC based
    if (idNo && idNo.trim()) {
      suggestions.push(`${baseName.trim()} [${idNo.trim()}]`);
    } else {
      suggestions.push(`${baseName.trim()} - New`);
    }

    // 3. Address based
    if (address && address.trim()) {
      suggestions.push(`${baseName.trim()} (${address.trim()})`);
    }

    return suggestions;
  };

  // Open Add Creditor Modal
  const handleOpenAddModal = (presetCreditor = null) => {
    setExistingSearchQuery('');
    setDuplicateConflict(null);
    setRenamePrompt(null);

    if (presetCreditor) {
      setFormMode('existing');
      setFormData({
        name: presetCreditor.name !== 'Unknown' ? presetCreditor.name : '',
        idNo: presetCreditor.idNo !== '-' ? presetCreditor.idNo : '',
        phone: presetCreditor.phone !== '-' ? presetCreditor.phone : '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        address: presetCreditor.address || '',
        dueDate: '',
        creditorKey: presetCreditor.key
      });
    } else {
      setFormMode('new');
      setFormData({
        name: '',
        idNo: '',
        phone: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        address: '',
        dueDate: '',
        creditorKey: ''
      });
    }
    setIsAddModalOpen(true);
  };

  // Select an existing creditor from the modal search bar
  const handleSelectExistingCreditor = (creditor) => {
    setFormMode('existing');
    setFormData(prev => ({
      ...prev,
      name: creditor.name !== 'Unknown' ? creditor.name : '',
      idNo: creditor.idNo !== '-' ? creditor.idNo : '',
      phone: creditor.phone !== '-' ? creditor.phone : '',
      address: creditor.address || '',
      creditorKey: creditor.key
    }));
    setExistingSearchQuery('');
  };

  // Clear selected existing creditor and switch to New Creditor mode
  const handleClearSelectedExisting = () => {
    setFormMode('new');
    setFormData(prev => ({
      ...prev,
      name: '',
      idNo: '',
      phone: '',
      address: '',
      creditorKey: ''
    }));
    setExistingSearchQuery('');
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  // Persist record to Firebase
  const executeSaveRecord = async (finalRecord) => {
    setFormSubmitting(true);
    try {
      await push(ref(db, 'customers'), finalRecord);

      setIsAddModalOpen(false);
      setDuplicateConflict(null);
      setRenamePrompt(null);
      setFormData({
        name: '',
        idNo: '',
        phone: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        address: '',
        dueDate: '',
        creditorKey: ''
      });
      alert(`Credit of Rs. ${finalRecord.amount.toFixed(2)} recorded for "${finalRecord.name}" successfully!`);
    } catch (err) {
      console.error(err);
      alert("Error adding creditor: " + err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Form Submission with Duplicate Detection
  const handleFormSubmit = async (e) => {
    e.preventDefault();

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      alert("Please enter the creditor's name.");
      return;
    }

    const numAmount = parseFloat(formData.amount);
    if (!formData.amount || isNaN(numAmount) || numAmount <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }

    if (!formData.date) {
      alert("Please select a date.");
      return;
    }

    const generatedReceiptId = `CR-${Date.now().toString().slice(-6)}`;
    const pendingRecord = {
      name: trimmedName,
      idNo: formData.idNo.trim() || '',
      phone: formData.phone.trim() || '',
      amount: numAmount,
      date: new Date(formData.date + 'T12:00:00').toISOString(),
      description: formData.description.trim() || 'Manual Credit Entry',
      address: formData.address.trim() || '',
      dueDate: formData.dueDate ? new Date(formData.dueDate + 'T12:00:00').toISOString() : '',
      receiptId: generatedReceiptId,
      manual: true,
      creditorKey: formData.creditorKey || '',
      createdAt: serverTimestamp()
    };

    // If already in 'existing' mode with an established creditorKey, save directly
    if (formMode === 'existing' && formData.creditorKey) {
      await executeSaveRecord(pendingRecord);
      return;
    }

    // Check if entered name already exists in the system (case-insensitive)
    const existingMatch = creditors.find(
      c => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingMatch) {
      // Conflict detected! Ask operator: Add to existing account OR create new account?
      setDuplicateConflict({
        existingCreditor: existingMatch,
        pendingRecord
      });
      return;
    }

    // New name, no duplicate
    const newUniqueKey = `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    pendingRecord.creditorKey = newUniqueKey;
    await executeSaveRecord(pendingRecord);
  };

  // Operator chooses to add to the existing account
  const handleResolveAddToExisting = async () => {
    if (!duplicateConflict) return;
    const { existingCreditor, pendingRecord } = duplicateConflict;

    const recordToSave = {
      ...pendingRecord,
      name: existingCreditor.name,
      creditorKey: existingCreditor.key,
      // Retain or complement existing phone / idNo
      phone: existingCreditor.phone !== '-' ? existingCreditor.phone : pendingRecord.phone,
      idNo: existingCreditor.idNo !== '-' ? existingCreditor.idNo : pendingRecord.idNo
    };

    await executeSaveRecord(recordToSave);
  };

  // Operator chooses to create a new account -> open Name Change / Suggestion popup
  const handleResolveCreateNewAccount = () => {
    if (!duplicateConflict) return;
    const { existingCreditor, pendingRecord } = duplicateConflict;

    const suggestions = getNameSuggestions(
      pendingRecord.name,
      pendingRecord.idNo,
      pendingRecord.address
    );
    const initialSuggestion = suggestions[0] || `${pendingRecord.name} (New)`;

    setRenamePrompt({
      existingCreditor,
      pendingRecord,
      suggestions,
      currentName: initialSuggestion
    });
    setDuplicateConflict(null);

    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 100);
  };

  // Confirm new account with modified name
  const handleConfirmRenameAndCreate = async (e) => {
    e.preventDefault();
    if (!renamePrompt) return;

    const finalizedName = renamePrompt.currentName.trim();
    if (!finalizedName) {
      alert("Please provide a name for this new account.");
      return;
    }

    // Generate unique key to prevent grouping with the existing account
    const newUniqueKey = `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const finalRecord = {
      ...renamePrompt.pendingRecord,
      name: finalizedName,
      creditorKey: newUniqueKey
    };

    await executeSaveRecord(finalRecord);
  };

  // Handle Settlement
  const handleAddSettlement = () => {
    const numAmount = parseFloat(settlementAmount);
    if (!settlementAmount || isNaN(numAmount) || numAmount <= 0) {
      alert("Invalid payment amount");
      return;
    }

    setSettlementSubmitting(true);

    const settlementData = {
      creditorKey: settlementCreditor.key,
      phone: settlementCreditor.phone !== '-' ? settlementCreditor.phone : '',
      idNo: settlementCreditor.idNo !== '-' ? settlementCreditor.idNo : '',
      name: settlementCreditor.name,
      amount: numAmount,
      note: settlementNote.trim() || 'Payment Received',
      timestamp: serverTimestamp(),
      date: new Date().toISOString()
    };

    push(ref(db, 'settlements'), settlementData)
      .then(() => {
        setSettlementCreditor(null);
        setSettlementAmount('');
        setSettlementNote('');
        alert(`Payment of Rs. ${numAmount.toFixed(2)} recorded successfully.`);
      })
      .catch(err => alert("Error adding settlement: " + err.message))
      .finally(() => setSettlementSubmitting(false));
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Creditors Management</h2>
          <p className="text-xs text-gray-500 mt-1">Track customer debts, manual credits, and settlements</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Add Creditor Button */}
          <button
            onClick={() => handleOpenAddModal()}
            className="bg-brand-green hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg shadow flex items-center gap-2 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Creditor
          </button>

          {/* Search Box for Main List */}
          <input
            type="text"
            placeholder="Search Name, Phone, ID No..."
            className="p-2 border rounded-lg flex-1 sm:w-60 focus:ring-2 focus:ring-brand-green outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />

          {/* Show Settled Toggle */}
          <div className="flex items-center space-x-2 whitespace-nowrap bg-white p-2 rounded-lg border shadow-sm">
            <span className="text-xs sm:text-sm text-gray-600">Show Settled</span>
            <button
              onClick={() => setShowSettled(!showSettled)}
              className={`w-10 h-5 rounded-full p-0.5 transition-colors ${showSettled ? 'bg-brand-green' : 'bg-gray-300'}`}
              type="button"
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${showSettled ? 'translate-x-5' : ''}`}></div>
            </button>
          </div>
        </div>
      </div>

      {/* Creditors Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto border border-gray-100">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 text-gray-600 font-semibold border-b text-sm">
            <tr>
              <th className="p-4">Name</th>
              <th className="p-4">ID No / NIC</th>
              <th className="p-4">Mobile No</th>
              <th className="p-4 text-right">Total Debt</th>
              <th className="p-4 text-right">Settled</th>
              <th className="p-4 text-right">Balance Due</th>
              <th className="p-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {filteredCreditors.map(creditor => (
              <tr key={creditor.key} className="hover:bg-gray-50 transition">
                <td className="p-4 font-medium text-gray-800">
                  <div>{creditor.name}</div>
                  {creditor.address && (
                    <div className="text-xs text-gray-400 truncate max-w-xs">{creditor.address}</div>
                  )}
                </td>
                <td className="p-4 text-gray-600">
                  {creditor.idNo !== '-' ? (
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono text-gray-700">{creditor.idNo}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="p-4 text-gray-600">
                  {creditor.phone !== '-' ? creditor.phone : <span className="text-gray-400">-</span>}
                </td>
                <td className="p-4 text-right text-red-500 font-semibold">
                  Rs. {creditor.debt.toFixed(2)}
                </td>
                <td className="p-4 text-right text-green-600 font-semibold">
                  Rs. {creditor.settled.toFixed(2)}
                </td>
                <td className="p-4 text-right font-bold text-gray-800">
                  Rs. {creditor.balance.toFixed(2)}
                </td>
                <td className="p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => {
                        setSettlementCreditor(creditor);
                        setSettlementAmount('');
                        setSettlementNote('');
                      }}
                      className="bg-brand-green text-white px-2.5 py-1 rounded text-xs font-medium hover:bg-green-700 transition"
                      title="Add payment settlement"
                    >
                      Pay
                    </button>
                    <button
                      onClick={() => handleOpenAddModal(creditor)}
                      className="bg-amber-100 text-amber-800 hover:bg-amber-200 px-2.5 py-1 rounded text-xs font-medium transition"
                      title="Add more debt/credit to this creditor"
                    >
                      + Debt
                    </button>
                    <button
                      onClick={() => setSelectedCreditor(creditor)}
                      className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-2.5 py-1 rounded text-xs font-medium transition"
                      title="View full transaction profile"
                    >
                      Profile
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredCreditors.length === 0 && (
              <tr>
                <td colSpan="7" className="p-8 text-center text-gray-400">
                  {searchTerm ? 'No creditors match your search query.' : 'No creditors found. Click "+ Add Creditor" to create one.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Creditor / Manual Credit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            {/* Modal Header */}
            <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  {formMode === 'existing' ? `Add Debt to ${formData.name}` : 'Add Creditor Manually'}
                </h3>
                <p className="text-xs text-gray-500">Record creditor debt without creating a purchase order</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* SEARCH BAR FOR EXISTING CREDITORS */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1 flex items-center justify-between">
                  <span>Search Existing Creditors</span>
                  {formMode === 'existing' && (
                    <span className="text-[11px] text-green-700 font-bold bg-green-100 px-2 py-0.5 rounded">
                      Linked to Existing Account
                    </span>
                  )}
                </label>

                {formMode === 'existing' ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 p-2.5 rounded-lg">
                    <div className="text-xs">
                      <span className="font-bold text-gray-800">{formData.name}</span>
                      {formData.idNo && <span className="ml-1 text-gray-600">[{formData.idNo}]</span>}
                      {formData.phone && <span className="ml-1 text-gray-600">({formData.phone})</span>}
                    </div>
                    <button
                      type="button"
                      onClick={handleClearSelectedExisting}
                      className="text-xs text-red-600 hover:text-red-800 font-semibold underline ml-2"
                    >
                      Change / New
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type name, phone, or ID to find existing creditor..."
                      value={existingSearchQuery}
                      onChange={e => setExistingSearchQuery(e.target.value)}
                      className="w-full border rounded-lg p-2 text-xs bg-white focus:ring-2 focus:ring-brand-green outline-none"
                    />

                    {/* Instant Search Results Dropdown */}
                    {searchedExistingCreditors.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto divide-y">
                        {searchedExistingCreditors.map(ec => (
                          <div
                            key={ec.key}
                            onClick={() => handleSelectExistingCreditor(ec)}
                            className="p-2.5 hover:bg-green-50 cursor-pointer flex justify-between items-center transition"
                          >
                            <div>
                              <div className="font-bold text-xs text-gray-800">{ec.name}</div>
                              <div className="text-[11px] text-gray-500">
                                {ec.phone !== '-' ? `📞 ${ec.phone}` : ''} {ec.idNo !== '-' ? `• ID: ${ec.idNo}` : ''}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-bold text-red-600">Rs. {ec.balance.toFixed(2)}</span>
                              <span className="block text-[10px] text-brand-green font-semibold">Select ➔</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {existingSearchQuery.trim() && searchedExistingCreditors.length === 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-2.5 text-xs text-gray-400 text-center">
                        No existing creditors match. You can fill out the form below to create a new profile.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Creditor Name (Required) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Creditor Name <span className="text-red-500">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  required
                  placeholder="e.g. John Doe / Farm Supplies Co."
                  value={formData.name}
                  onChange={e => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formMode === 'existing') {
                      // If user edits name manually, detach from existing creditorKey
                      setFormData(prev => ({ ...prev, name: e.target.value, creditorKey: '' }));
                      setFormMode('new');
                    }
                  }}
                  className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-green outline-none"
                  autoFocus
                />
              </div>

              {/* Grid: ID No & Mobile No */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID / NIC No <span className="text-gray-400 text-xs">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 199012345678"
                    value={formData.idNo}
                    onChange={e => setFormData({ ...formData, idNo: e.target.value })}
                    className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-green outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile No <span className="text-gray-400 text-xs">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 0771234567"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-green outline-none"
                  />
                </div>
              </div>

              {/* Grid: Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount (Rs.) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full border rounded-lg p-2.5 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-brand-green outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-green outline-none"
                  />
                </div>
              </div>

              {/* Description / Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason / Description / Note <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Previous balance, Direct supply of fertilizer, Invoice #450"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-green outline-none"
                />
              </div>

              {/* Grid: Address & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address / Town <span className="text-gray-400 text-xs">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Galle Road, Matara"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-green outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Settlement Due Date <span className="text-gray-400 text-xs">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-green outline-none"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="pt-4 flex justify-end space-x-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-100 transition"
                  disabled={formSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-brand-green text-white font-semibold rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                >
                  {formSubmitting ? 'Saving...' : 'Save Creditor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP 1: DUPLICATE NAME CONFLICT RESOLUTION */}
      {duplicateConflict && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden border border-amber-200 animate-fadeIn">
            <div className="p-5 bg-amber-50 border-b border-amber-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xl flex-shrink-0">
                ⚠️
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Creditor Already Exists</h3>
                <p className="text-xs text-amber-800">A creditor with this name is already registered.</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                A profile for <strong className="text-gray-900 font-bold">"{duplicateConflict.existingCreditor.name}"</strong> already exists in the system:
              </p>

              {/* Existing Creditor Summary Card */}
              <div className="bg-gray-50 border rounded-lg p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Current Balance Due:</span>
                  <span className="font-bold text-red-600">Rs. {duplicateConflict.existingCreditor.balance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Mobile Phone:</span>
                  <span className="text-gray-800 font-medium">{duplicateConflict.existingCreditor.phone !== '-' ? duplicateConflict.existingCreditor.phone : 'Not provided'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ID / NIC No:</span>
                  <span className="text-gray-800 font-medium">{duplicateConflict.existingCreditor.idNo !== '-' ? duplicateConflict.existingCreditor.idNo : 'Not provided'}</span>
                </div>
                {duplicateConflict.existingCreditor.address && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Address:</span>
                    <span className="text-gray-800 font-medium truncate max-w-[200px]">{duplicateConflict.existingCreditor.address}</span>
                  </div>
                )}
              </div>

              <div className="border-t pt-3">
                <p className="text-xs text-gray-600 font-semibold mb-3">
                  How would you like to handle the Rs. {duplicateConflict.pendingRecord.amount.toFixed(2)} credit?
                </p>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleResolveAddToExisting}
                    disabled={formSubmitting}
                    className="w-full p-3 bg-brand-green hover:bg-green-700 text-white rounded-lg font-semibold text-sm shadow flex items-center justify-between transition"
                  >
                    <span>Add to Existing Account</span>
                    <span>➔</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResolveCreateNewAccount}
                    className="w-full p-3 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg font-semibold text-sm flex items-center justify-between transition"
                  >
                    <span>Create a New Account</span>
                    <span>➔</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDuplicateConflict(null)}
                    className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 text-center"
                  >
                    Cancel & Return to Form
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 2: RENAME SUGGESTION FOR NEW ACCOUNT */}
      {renamePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden border border-blue-200 animate-fadeIn">
            <div className="p-5 bg-blue-50 border-b border-blue-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg flex-shrink-0">
                ✏️
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Differentiate New Account</h3>
                <p className="text-xs text-blue-800">Customize the name to avoid misunderstandings</p>
              </div>
            </div>

            <form onSubmit={handleConfirmRenameAndCreate} className="p-6 space-y-4">
              <p className="text-xs text-gray-600 leading-relaxed">
                To prevent confusion with the existing account <strong className="text-gray-900 font-semibold">"{renamePrompt.existingCreditor.name}"</strong>, please adjust the name for this new account:
              </p>

              {/* Editable Name Input */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  New Account Name
                </label>
                <input
                  ref={renameInputRef}
                  type="text"
                  required
                  value={renamePrompt.currentName}
                  onChange={e => setRenamePrompt({ ...renamePrompt, currentName: e.target.value })}
                  className="w-full border-2 border-blue-400 rounded-lg p-2.5 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Enter custom account name"
                />
              </div>

              {/* Quick Clickable Suggestions */}
              {renamePrompt.suggestions && renamePrompt.suggestions.length > 0 && (
                <div>
                  <span className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">
                    Or click a suggestion:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {renamePrompt.suggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setRenamePrompt({ ...renamePrompt, currentName: sug })}
                        className={`text-xs px-2.5 py-1 rounded-full border transition ${
                          renamePrompt.currentName === sug
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setRenamePrompt(null);
                    setDuplicateConflict({
                      existingCreditor: renamePrompt.existingCreditor,
                      pendingRecord: renamePrompt.pendingRecord
                    });
                  }}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-100 text-sm transition"
                  disabled={formSubmitting}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-brand-green text-white font-semibold rounded-lg hover:bg-green-700 text-sm shadow transition"
                >
                  {formSubmitting ? 'Creating...' : 'Confirm & Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settlement Modal */}
      {settlementCreditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <h3 className="text-xl font-bold mb-2 text-gray-800">Record Settlement</h3>
            <p className="mb-4 text-sm text-gray-600">
              Creditor: <span className="font-semibold text-gray-800">{settlementCreditor.name}</span>
              {settlementCreditor.idNo !== '-' && <span className="ml-2 text-xs text-gray-500">[{settlementCreditor.idNo}]</span>}
              <br />
              Current Balance: <span className="font-bold text-red-600">Rs. {settlementCreditor.balance.toFixed(2)}</span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid (Rs.)</label>
                <input
                  type="number"
                  step="0.01"
                  value={settlementAmount}
                  onChange={e => setSettlementAmount(e.target.value)}
                  className="w-full border rounded-lg p-2.5 font-bold text-gray-800 focus:ring-2 focus:ring-brand-green outline-none"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note (Optional)</label>
                <input
                  type="text"
                  value={settlementNote}
                  onChange={e => setSettlementNote(e.target.value)}
                  className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-green outline-none"
                  placeholder="e.g. Bank Transfer, Cash payment, Partial settlement"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setSettlementCreditor(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                disabled={settlementSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddSettlement}
                disabled={settlementSubmitting}
                className="px-5 py-2 bg-brand-green text-white font-semibold rounded-lg hover:bg-green-700 transition"
              >
                {settlementSubmitting ? 'Recording...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {selectedCreditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b flex justify-between items-start bg-gray-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-gray-800">{selectedCreditor.name}</h3>
                  {selectedCreditor.idNo !== '-' && (
                    <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs font-mono">
                      {selectedCreditor.idNo}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-1">
                  {selectedCreditor.phone !== '-' && <span>📞 {selectedCreditor.phone}</span>}
                  {selectedCreditor.address && <span>📍 {selectedCreditor.address}</span>}
                </div>
              </div>
              <button
                onClick={() => setSelectedCreditor(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-red-50 p-4 rounded-lg text-center border border-red-100">
                  <span className="block text-xs text-gray-500 uppercase font-semibold">Total Debt</span>
                  <span className="text-lg md:text-xl font-bold text-red-600">
                    Rs. {selectedCreditor.debt.toFixed(2)}
                  </span>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center border border-green-100">
                  <span className="block text-xs text-gray-500 uppercase font-semibold">Total Paid</span>
                  <span className="text-lg md:text-xl font-bold text-green-600">
                    Rs. {selectedCreditor.settled.toFixed(2)}
                  </span>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center border border-gray-200">
                  <span className="block text-xs text-gray-500 uppercase font-semibold">Balance Due</span>
                  <span className="text-lg md:text-xl font-bold text-gray-800">
                    Rs. {selectedCreditor.balance.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Quick Actions inside Profile */}
              <div className="flex justify-end gap-2 mb-4">
                <button
                  onClick={() => {
                    handleOpenAddModal(selectedCreditor);
                    setSelectedCreditor(null);
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition"
                >
                  + Add More Debt
                </button>
                <button
                  onClick={() => {
                    setSettlementCreditor(selectedCreditor);
                    setSettlementAmount('');
                    setSettlementNote('');
                    setSelectedCreditor(null);
                  }}
                  className="bg-brand-green hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition"
                >
                  Record Settlement
                </button>
              </div>

              {/* Transactions List */}
              <h4 className="font-bold text-gray-700 mb-3 text-sm">Transaction History</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b text-xs text-gray-600">
                    <tr>
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">Type</th>
                      <th className="p-3 text-left">Note / Description</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedCreditor.transactions
                      .slice()
                      .sort((a, b) => {
                        const dateA = new Date(a.date).getTime() || 0;
                        const dateB = new Date(b.date).getTime() || 0;
                        return dateB - dateA;
                      })
                      .map((t, idx) => (
                        <tr key={idx} className={t.type === 'PAYMENT' ? 'bg-green-50/40' : ''}>
                          <td className="p-3 text-gray-600 text-xs">
                            {t.date ? new Date(t.date).toLocaleDateString() : 'N/A'}{' '}
                            <span className="text-gray-400">
                              {t.date ? new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold ${
                                t.type === 'DEBT'
                                  ? 'bg-red-100 text-red-700'
                                  : t.type === 'PAYMENT'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {t.manual ? 'MANUAL DEBT' : t.type}
                            </span>
                          </td>
                          <td className="p-3 text-gray-700 text-xs">
                            {t.receiptId && (
                              <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded mr-1 font-mono text-[11px]">
                                {t.receiptId}
                              </span>
                            )}
                            {t.description || t.note || '-'}
                            {t.dueDate && (
                              <div className="text-[11px] text-amber-600 mt-0.5">
                                Due by: {new Date(t.dueDate).toLocaleDateString()}
                              </div>
                            )}
                          </td>
                          <td
                            className={`p-3 text-right font-medium ${
                              t.type === 'DEBT' ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {t.type === 'PAYMENT' ? '-' : '+'} Rs. {t.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    {selectedCreditor.transactions.length === 0 && (
                      <tr>
                        <td colSpan="4" className="p-4 text-center text-gray-400 text-xs">
                          No transactions recorded yet.
                        </td>
                      </tr>
                    )}
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
