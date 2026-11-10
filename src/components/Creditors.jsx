import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { ref, onValue, push, serverTimestamp } from 'firebase/database';

export default function Creditors() {
  const [customersData, setCustomersData] = useState({});
  const [settlementsData, setSettlementsData] = useState({});
  
  // Filter status: 'active' | 'all' | 'settled'
  const [filterStatus, setFilterStatus] = useState('active');
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
    invoiceNo: '',
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
  const [duplicateConflict, setDuplicateConflict] = useState(null); // { existingCreditor, pendingRecord }
  const [renamePrompt, setRenamePrompt] = useState(null); // { existingCreditor, pendingRecord, suggestions, currentName }

  // Search State for Main List
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
        invoiceNo: sale.invoiceNo || null,
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

  // Overall Statistics
  const stats = useMemo(() => {
    let totalOutstanding = 0;
    let totalSettled = 0;
    let activeCount = 0;
    let settledCount = 0;

    creditors.forEach(c => {
      if (c.balance > 0.01) {
        totalOutstanding += c.balance;
        activeCount++;
      } else {
        settledCount++;
      }
      totalSettled += c.settled;
    });

    return {
      totalOutstanding,
      totalSettled,
      activeCount,
      settledCount,
      totalCount: creditors.length
    };
  }, [creditors]);

  // Main list filter
  const filteredCreditors = useMemo(() => {
    return creditors.filter(c => {
      let matchesStatus = true;
      if (filterStatus === 'active') matchesStatus = c.balance > 0.01;
      else if (filterStatus === 'settled') matchesStatus = c.balance <= 0.01;

      const searchLower = searchTerm.toLowerCase().trim();
      const matchesSearch = searchLower === '' ||
        c.name.toLowerCase().includes(searchLower) ||
        (c.phone && c.phone.toLowerCase().includes(searchLower)) ||
        (c.idNo && c.idNo.toLowerCase().includes(searchLower)) ||
        (c.address && c.address.toLowerCase().includes(searchLower)) ||
        c.transactions.some(t =>
          (t.receiptId && t.receiptId.toLowerCase().includes(searchLower)) ||
          (t.invoiceNo && t.invoiceNo.toLowerCase().includes(searchLower)) ||
          (t.description && t.description.toLowerCase().includes(searchLower)) ||
          (t.note && t.note.toLowerCase().includes(searchLower))
        );

      return matchesStatus && matchesSearch;
    });
  }, [creditors, filterStatus, searchTerm]);

  // Search existing creditors in the Add Creditor modal
  const searchedExistingCreditors = useMemo(() => {
    if (!existingSearchQuery.trim()) return [];
    const q = existingSearchQuery.toLowerCase().trim();
    return creditors.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.idNo && c.idNo.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [creditors, existingSearchQuery]);

  // Generate smart name suggestions for new account when duplicate name occurs
  const getNameSuggestions = (baseName, idNo, address) => {
    const suggestions = [];
    const lower = baseName.toLowerCase().trim();

    let num = 2;
    while (creditors.some(c => c.name.toLowerCase().trim() === `${lower} (${num})`)) {
      num++;
    }
    suggestions.push(`${baseName.trim()} (${num})`);

    if (idNo && idNo.trim()) {
      suggestions.push(`${baseName.trim()} [${idNo.trim()}]`);
    } else {
      suggestions.push(`${baseName.trim()} - New`);
    }

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
        invoiceNo: '',
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
        invoiceNo: '',
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
        invoiceNo: '',
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
      invoiceNo: formData.invoiceNo.trim() || '',
      amount: numAmount,
      date: new Date(formData.date + 'T12:00:00').toISOString(),
      description: formData.description.trim() || 'Manual Credit Entry',
      address: formData.address.trim() || '',
      dueDate: formData.dueDate ? new Date(formData.dueDate + 'T12:00:00').toISOString() : '',
      receiptId: formData.invoiceNo.trim() || generatedReceiptId,
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
    <div className="w-full max-w-6xl mx-auto space-y-4 pb-8">
      {/* 1. TOP STATS BAR (Mobile & Desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-red-100 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Total Due
          </span>
          <div className="text-lg sm:text-2xl font-black text-red-600 mt-1 truncate">
            Rs. {stats.totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] sm:text-xs text-red-400 mt-0.5">
            {stats.activeCount} active creditor{stats.activeCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl border border-green-100 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Total Settled
          </span>
          <div className="text-lg sm:text-2xl font-black text-green-600 mt-1 truncate">
            Rs. {stats.totalSettled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] sm:text-xs text-green-500 mt-0.5">
            {stats.settledCount} fully paid
          </span>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide block">
              Total Accounts
            </span>
            <span className="text-xl sm:text-2xl font-black text-gray-800">
              {stats.totalCount}
            </span>
          </div>
          <button
            onClick={() => handleOpenAddModal()}
            className="bg-brand-green hover:bg-green-700 active:scale-95 text-white font-bold px-4 py-2.5 rounded-lg shadow flex items-center gap-1.5 text-xs sm:text-sm transition-all"
          >
            <span className="text-base leading-none">+</span>
            <span>Add Creditor</span>
          </button>
        </div>
      </div>

      {/* 2. SEARCH & FILTER CONTROLS */}
      <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          {/* Search Box with Clear Button */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by name, phone, NIC, address..."
              className="w-full pl-9 pr-9 py-2.5 border rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-brand-green outline-none bg-gray-50 focus:bg-white transition"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 text-base"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Add Button (Prominent on Mobile) */}
          <button
            onClick={() => handleOpenAddModal()}
            className="sm:hidden w-full bg-brand-green hover:bg-green-700 active:bg-green-800 text-white font-bold py-3 px-4 rounded-lg shadow flex items-center justify-center gap-2 text-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>+ Add New Creditor</span>
          </button>
        </div>

        {/* Segmented Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-lg text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setFilterStatus('active')}
            className={`flex-1 min-w-[90px] py-2 px-3 rounded-md transition text-center whitespace-nowrap ${
              filterStatus === 'active'
                ? 'bg-white text-brand-green shadow-sm font-bold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            With Balance ({stats.activeCount})
          </button>
          <button
            onClick={() => setFilterStatus('all')}
            className={`flex-1 min-w-[70px] py-2 px-3 rounded-md transition text-center whitespace-nowrap ${
              filterStatus === 'all'
                ? 'bg-white text-brand-green shadow-sm font-bold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All ({stats.totalCount})
          </button>
          <button
            onClick={() => setFilterStatus('settled')}
            className={`flex-1 min-w-[80px] py-2 px-3 rounded-md transition text-center whitespace-nowrap ${
              filterStatus === 'settled'
                ? 'bg-white text-brand-green shadow-sm font-bold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Settled ({stats.settledCount})
          </button>
        </div>
      </div>

      {/* 3. MOBILE VIEW: TOUCH-FRIENDLY CARDS (hidden on md and up) */}
      <div className="block md:hidden space-y-3">
        {filteredCreditors.map(creditor => (
          <div
            key={creditor.key}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-green-200 transition space-y-3"
          >
            {/* Header: Name, ID, & Balance Badge */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-base leading-tight truncate">
                  {creditor.name}
                </h3>
                {creditor.idNo !== '-' && (
                  <span className="inline-block mt-0.5 bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[11px] font-mono">
                    NIC: {creditor.idNo}
                  </span>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                {creditor.balance > 0.01 ? (
                  <span className="inline-block bg-red-50 text-red-700 border border-red-200 font-extrabold text-sm px-2.5 py-1 rounded-lg">
                    Rs. {creditor.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                ) : (
                  <span className="inline-block bg-green-50 text-green-700 border border-green-200 font-bold text-xs px-2.5 py-1 rounded-lg">
                    ✓ Settled
                  </span>
                )}
              </div>
            </div>

            {/* Creditor Details: Phone & Address */}
            <div className="text-xs text-gray-600 space-y-1 bg-gray-50 p-2.5 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Mobile:</span>
                {creditor.phone !== '-' ? (
                  <a
                    href={`tel:${creditor.phone}`}
                    className="font-semibold text-brand-green flex items-center gap-1 active:underline"
                  >
                    <span>📞 {creditor.phone}</span>
                    <span className="text-[10px] bg-green-100 px-1 rounded text-green-800">Call</span>
                  </a>
                ) : (
                  <span className="text-gray-400">Not provided</span>
                )}
              </div>

              {creditor.address && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Address:</span>
                  <span className="text-gray-800 truncate max-w-[200px]">📍 {creditor.address}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-gray-200/60 text-[11px]">
                <span className="text-gray-500">Total Debt: Rs. {creditor.debt.toFixed(2)}</span>
                <span className="text-gray-500">Paid: Rs. {creditor.settled.toFixed(2)}</span>
              </div>
            </div>

            {/* Big Touch-Friendly Action Buttons */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                onClick={() => {
                  setSettlementCreditor(creditor);
                  setSettlementAmount('');
                  setSettlementNote('');
                }}
                className="py-2.5 px-2 bg-brand-green hover:bg-green-700 active:bg-green-800 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 shadow-sm"
              >
                <span>💰</span>
                <span>Pay</span>
              </button>

              <button
                onClick={() => handleOpenAddModal(creditor)}
                className="py-2.5 px-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 shadow-sm"
              >
                <span>➕</span>
                <span>Debt</span>
              </button>

              <button
                onClick={() => setSelectedCreditor(creditor)}
                className="py-2.5 px-2 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 rounded-lg font-bold text-xs flex items-center justify-center gap-1 border border-gray-200"
              >
                <span>👤</span>
                <span>History</span>
              </button>
            </div>
          </div>
        ))}

        {filteredCreditors.length === 0 && (
          <div className="bg-white p-8 rounded-xl text-center border border-dashed border-gray-300">
            <span className="text-3xl block mb-2">📋</span>
            <p className="text-gray-500 text-sm font-medium">No creditors found</p>
            <p className="text-gray-400 text-xs mt-1">
              {searchTerm ? 'Try a different search query' : 'Tap "+ Add Creditor" to create your first record'}
            </p>
          </div>
        )}
      </div>

      {/* 4. DESKTOP VIEW: DATA TABLE (visible on md and up) */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 text-gray-600 font-semibold border-b text-xs uppercase tracking-wider">
            <tr>
              <th className="p-4">Creditor Name</th>
              <th className="p-4">ID / NIC No</th>
              <th className="p-4">Mobile No</th>
              <th className="p-4 text-right">Total Debt</th>
              <th className="p-4 text-right">Settled</th>
              <th className="p-4 text-right">Balance Due</th>
              <th className="p-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {filteredCreditors.map(creditor => (
              <tr key={creditor.key} className="hover:bg-gray-50/80 transition">
                <td className="p-4 font-semibold text-gray-800">
                  <div>{creditor.name}</div>
                  {creditor.address && (
                    <div className="text-xs text-gray-400 truncate max-w-xs">📍 {creditor.address}</div>
                  )}
                </td>
                <td className="p-4 text-gray-600">
                  {creditor.idNo !== '-' ? (
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono text-gray-700">
                      {creditor.idNo}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="p-4 text-gray-600">
                  {creditor.phone !== '-' ? (
                    <a href={`tel:${creditor.phone}`} className="text-brand-green hover:underline">
                      {creditor.phone}
                    </a>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="p-4 text-right text-gray-600 font-medium">
                  Rs. {creditor.debt.toFixed(2)}
                </td>
                <td className="p-4 text-right text-green-600 font-medium">
                  Rs. {creditor.settled.toFixed(2)}
                </td>
                <td className="p-4 text-right font-bold text-base">
                  {creditor.balance > 0.01 ? (
                    <span className="text-red-600">Rs. {creditor.balance.toFixed(2)}</span>
                  ) : (
                    <span className="text-green-600 text-xs font-semibold bg-green-50 px-2 py-0.5 rounded">Settled</span>
                  )}
                </td>
                <td className="p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => {
                        setSettlementCreditor(creditor);
                        setSettlementAmount('');
                        setSettlementNote('');
                      }}
                      className="bg-brand-green hover:bg-green-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition"
                      title="Add payment settlement"
                    >
                      Pay
                    </button>
                    <button
                      onClick={() => handleOpenAddModal(creditor)}
                      className="bg-amber-100 hover:bg-amber-200 text-amber-900 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition"
                      title="Add more debt/credit to this creditor"
                    >
                      + Debt
                    </button>
                    <button
                      onClick={() => setSelectedCreditor(creditor)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition"
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
                <td colSpan="7" className="p-8 text-center text-gray-400 text-sm">
                  {searchTerm ? 'No creditors match your search query.' : 'No creditors found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 5. ADD CREDITOR / MANUAL CREDIT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b bg-gray-50 flex justify-between items-center flex-shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">
                  {formMode === 'existing' ? `Add Debt to ${formData.name}` : 'Add Creditor Manually'}
                </h3>
                <p className="text-xs text-gray-500">Record debt without purchase order</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 flex items-center justify-center text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-3.5 flex-1 text-sm">
              {/* SEARCH BAR FOR EXISTING CREDITORS */}
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center justify-between">
                  <span>Search Existing Creditor</span>
                  {formMode === 'existing' && (
                    <span className="text-[10px] text-green-700 font-bold bg-green-100 px-2 py-0.5 rounded">
                      Linked to Account
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
                      className="text-xs text-red-600 hover:text-red-800 font-bold underline ml-2"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type name, phone, or ID to find..."
                      value={existingSearchQuery}
                      onChange={e => setExistingSearchQuery(e.target.value)}
                      className="w-full border rounded-lg p-2.5 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-brand-green outline-none"
                    />

                    {/* Instant Search Results */}
                    {searchedExistingCreditors.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 max-h-44 overflow-y-auto divide-y">
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
                  </div>
                )}
              </div>

              {/* Creditor Name (Required) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Creditor Name <span className="text-red-500">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  required
                  placeholder="e.g. John Perera / Agro Supplies"
                  value={formData.name}
                  onChange={e => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formMode === 'existing') {
                      setFormData(prev => ({ ...prev, name: e.target.value, creditorKey: '' }));
                      setFormMode('new');
                    }
                  }}
                  className="w-full border rounded-lg p-3 text-base focus:ring-2 focus:ring-brand-green outline-none"
                  autoFocus
                />
              </div>

              {/* ID No & Mobile No */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    ID / NIC No <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 199012345678"
                    value={formData.idNo}
                    onChange={e => setFormData({ ...formData, idNo: e.target.value })}
                    className="w-full border rounded-lg p-2.5 text-sm sm:text-base focus:ring-2 focus:ring-brand-green outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Mobile No <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 0771234567"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border rounded-lg p-2.5 text-sm sm:text-base focus:ring-2 focus:ring-brand-green outline-none"
                  />
                </div>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
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
                    className="w-full border rounded-lg p-2.5 text-base font-black text-gray-900 focus:ring-2 focus:ring-brand-green outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full border rounded-lg p-2.5 text-sm sm:text-base focus:ring-2 focus:ring-brand-green outline-none"
                  />
                </div>
              </div>

              {/* Invoice No & Reason / Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Invoice / Bill No <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-10452 / Bill #88"
                    value={formData.invoiceNo}
                    onChange={e => setFormData({ ...formData, invoiceNo: e.target.value })}
                    className="w-full border rounded-lg p-2.5 text-sm sm:text-base font-mono focus:ring-2 focus:ring-brand-green outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Reason / Description <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fertilizer supply, Opening balance"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border rounded-lg p-2.5 text-sm sm:text-base focus:ring-2 focus:ring-brand-green outline-none"
                  />
                </div>
              </div>

              {/* Address & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Address / Town <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Galle Road"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="w-full border rounded-lg p-2.5 text-sm sm:text-base focus:ring-2 focus:ring-brand-green outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Due Date <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full border rounded-lg p-2.5 text-sm sm:text-base focus:ring-2 focus:ring-brand-green outline-none"
                  />
                </div>
              </div>

              {/* Sticky / Touch Footer */}
              <div className="pt-3 border-t flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-3 border rounded-lg text-gray-600 font-bold hover:bg-gray-100 transition text-center"
                  disabled={formSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 py-3 bg-brand-green text-white font-bold rounded-lg hover:bg-green-700 active:bg-green-800 transition shadow"
                >
                  {formSubmitting ? 'Saving...' : 'Save Creditor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. DUPLICATE NAME CONFLICT POPUP */}
      {duplicateConflict && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-amber-200">
            <div className="p-4 sm:p-5 bg-amber-50 border-b border-amber-200 flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Creditor Already Exists</h3>
                <p className="text-xs text-amber-800">A creditor with this name was found</p>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <p className="text-xs sm:text-sm text-gray-700">
                A profile for <strong className="text-gray-900 font-bold">"{duplicateConflict.existingCreditor.name}"</strong> already exists:
              </p>

              <div className="bg-gray-50 border rounded-xl p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Balance Due:</span>
                  <span className="font-extrabold text-red-600">Rs. {duplicateConflict.existingCreditor.balance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Mobile:</span>
                  <span className="text-gray-800 font-medium">{duplicateConflict.existingCreditor.phone !== '-' ? duplicateConflict.existingCreditor.phone : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ID / NIC:</span>
                  <span className="text-gray-800 font-medium">{duplicateConflict.existingCreditor.idNo !== '-' ? duplicateConflict.existingCreditor.idNo : 'N/A'}</span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleResolveAddToExisting}
                  disabled={formSubmitting}
                  className="w-full py-3 px-4 bg-brand-green hover:bg-green-700 active:bg-green-800 text-white rounded-xl font-bold text-sm shadow flex items-center justify-between"
                >
                  <span>Add to Existing Account</span>
                  <span>➔</span>
                </button>

                <button
                  type="button"
                  onClick={handleResolveCreateNewAccount}
                  className="w-full py-3 px-4 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-800 border border-blue-200 rounded-xl font-bold text-sm flex items-center justify-between"
                >
                  <span>Create a New Account</span>
                  <span>➔</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDuplicateConflict(null)}
                  className="w-full py-2.5 text-xs text-gray-500 hover:text-gray-700 text-center font-medium"
                >
                  Cancel & Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. RENAME SUGGESTION POPUP */}
      {renamePrompt && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-blue-200">
            <div className="p-4 sm:p-5 bg-blue-50 border-b border-blue-200 flex items-center gap-3">
              <span className="text-2xl">✏️</span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Differentiate Account</h3>
                <p className="text-xs text-blue-800">Customize the name to avoid mix-ups</p>
              </div>
            </div>

            <form onSubmit={handleConfirmRenameAndCreate} className="p-4 sm:p-6 space-y-4">
              <p className="text-xs text-gray-600">
                To prevent confusion with <strong className="text-gray-900 font-semibold">"{renamePrompt.existingCreditor.name}"</strong>, please adjust the name for this new account:
              </p>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Account Name
                </label>
                <input
                  ref={renameInputRef}
                  type="text"
                  required
                  value={renamePrompt.currentName}
                  onChange={e => setRenamePrompt({ ...renamePrompt, currentName: e.target.value })}
                  className="w-full border-2 border-blue-400 rounded-xl p-3 text-base font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Enter name"
                />
              </div>

              {renamePrompt.suggestions && renamePrompt.suggestions.length > 0 && (
                <div>
                  <span className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">
                    Quick Suggestions:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {renamePrompt.suggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setRenamePrompt({ ...renamePrompt, currentName: sug })}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition ${
                          renamePrompt.currentName === sug
                            ? 'bg-blue-600 text-white border-blue-600 font-bold'
                            : 'bg-gray-100 text-gray-700 border-gray-200 active:bg-gray-200'
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRenamePrompt(null);
                    setDuplicateConflict({
                      existingCreditor: renamePrompt.existingCreditor,
                      pendingRecord: renamePrompt.pendingRecord
                    });
                  }}
                  className="flex-1 py-3 border rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-sm"
                  disabled={formSubmitting}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 py-3 bg-brand-green text-white font-bold rounded-xl hover:bg-green-700 active:bg-green-800 text-sm shadow"
                >
                  {formSubmitting ? 'Creating...' : 'Confirm & Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. SETTLEMENT MODAL */}
      {settlementCreditor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl p-4 sm:p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Record Settlement</h3>
                <p className="text-xs text-gray-500">Creditor: {settlementCreditor.name}</p>
              </div>
              <button
                onClick={() => setSettlementCreditor(null)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-lg"
              >
                &times;
              </button>
            </div>

            <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex justify-between items-center">
              <div>
                <span className="text-xs text-red-700 block font-medium">Balance Due</span>
                <span className="text-xl font-black text-red-600">
                  Rs. {settlementCreditor.balance.toFixed(2)}
                </span>
              </div>
              {settlementCreditor.balance > 0 && (
                <button
                  type="button"
                  onClick={() => setSettlementAmount(settlementCreditor.balance.toString())}
                  className="bg-white text-red-700 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-red-200 shadow-sm hover:bg-red-50"
                >
                  Pay Full Balance
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Amount Paid (Rs.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settlementAmount}
                  onChange={e => setSettlementAmount(e.target.value)}
                  className="w-full border rounded-xl p-3 text-lg font-black text-gray-900 focus:ring-2 focus:ring-brand-green outline-none"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Payment Note (Optional)
                </label>
                <input
                  type="text"
                  value={settlementNote}
                  onChange={e => setSettlementNote(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-brand-green outline-none"
                  placeholder="e.g. Cash, Bank Transfer, GPay"
                />
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setSettlementCreditor(null)}
                className="flex-1 py-3 border rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-sm"
                disabled={settlementSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddSettlement}
                disabled={settlementSubmitting}
                className="flex-1 py-3 bg-brand-green text-white font-bold rounded-xl hover:bg-green-700 active:bg-green-800 text-sm shadow"
              >
                {settlementSubmitting ? 'Recording...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. PROFILE & TRANSACTION HISTORY MODAL */}
      {selectedCreditor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b bg-gray-50 flex justify-between items-start flex-shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-xl font-bold text-gray-900">{selectedCreditor.name}</h3>
                  {selectedCreditor.idNo !== '-' && (
                    <span className="bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded text-[11px] font-mono">
                      {selectedCreditor.idNo}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                  {selectedCreditor.phone !== '-' && (
                    <a href={`tel:${selectedCreditor.phone}`} className="text-brand-green font-semibold">
                      📞 {selectedCreditor.phone}
                    </a>
                  )}
                  {selectedCreditor.address && <span>📍 {selectedCreditor.address}</span>}
                </div>
              </div>
              <button
                onClick={() => setSelectedCreditor(null)}
                className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="bg-red-50 p-2.5 sm:p-3 rounded-xl text-center border border-red-100">
                  <span className="block text-[10px] sm:text-xs text-gray-500 uppercase font-semibold">Total Debt</span>
                  <span className="text-xs sm:text-lg font-black text-red-600 truncate block">
                    Rs. {selectedCreditor.debt.toFixed(2)}
                  </span>
                </div>
                <div className="bg-green-50 p-2.5 sm:p-3 rounded-xl text-center border border-green-100">
                  <span className="block text-[10px] sm:text-xs text-gray-500 uppercase font-semibold">Total Paid</span>
                  <span className="text-xs sm:text-lg font-black text-green-600 truncate block">
                    Rs. {selectedCreditor.settled.toFixed(2)}
                  </span>
                </div>
                <div className="bg-gray-50 p-2.5 sm:p-3 rounded-xl text-center border border-gray-200">
                  <span className="block text-[10px] sm:text-xs text-gray-500 uppercase font-semibold">Balance Due</span>
                  <span className="text-xs sm:text-lg font-black text-gray-900 truncate block">
                    Rs. {selectedCreditor.balance.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Quick Actions inside Profile */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    handleOpenAddModal(selectedCreditor);
                    setSelectedCreditor(null);
                  }}
                  className="py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-sm"
                >
                  <span>➕</span>
                  <span>Add More Debt</span>
                </button>
                <button
                  onClick={() => {
                    setSettlementCreditor(selectedCreditor);
                    setSettlementAmount('');
                    setSettlementNote('');
                    setSelectedCreditor(null);
                  }}
                  className="py-2.5 px-3 bg-brand-green hover:bg-green-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-sm"
                >
                  <span>💰</span>
                  <span>Record Payment</span>
                </button>
              </div>

              {/* Transaction History */}
              <div>
                <h4 className="font-bold text-gray-800 text-xs sm:text-sm mb-2">
                  Transaction History ({selectedCreditor.transactions.length})
                </h4>
                
                {/* Mobile Transaction Cards */}
                <div className="space-y-2">
                  {selectedCreditor.transactions
                    .slice()
                    .sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0))
                    .map((t, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs flex justify-between items-start gap-2 ${
                          t.type === 'PAYMENT' ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                t.type === 'DEBT'
                                  ? 'bg-red-100 text-red-700'
                                  : t.type === 'PAYMENT'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {t.manual ? 'MANUAL DEBT' : t.type}
                            </span>
                            {t.invoiceNo && (
                              <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold">
                                Inv #{t.invoiceNo}
                              </span>
                            )}
                            {t.receiptId && !t.invoiceNo && (
                              <span className="bg-gray-200 text-gray-700 px-1 rounded font-mono text-[10px]">
                                {t.receiptId}
                              </span>
                            )}
                          </div>

                          <div className="text-gray-800 font-medium truncate">
                            {t.description || t.note || '-'}
                          </div>

                          <div className="text-[10px] text-gray-400">
                            {t.date ? new Date(t.date).toLocaleDateString() : 'N/A'}{' '}
                            {t.date ? new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                        </div>

                        <div
                          className={`font-black text-sm whitespace-nowrap text-right ${
                            t.type === 'DEBT' ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {t.type === 'PAYMENT' ? '-' : '+'} Rs. {t.amount.toFixed(2)}
                        </div>
                      </div>
                    ))}

                  {selectedCreditor.transactions.length === 0 && (
                    <div className="p-4 text-center text-gray-400 text-xs">
                      No transactions recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
