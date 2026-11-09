import React, { useState, useEffect, useRef } from 'react';

const methods = ['Cash', 'Card', 'Bank Transfer', 'Credit Sale'];

export default function PaymentModal({ onClose, onConfirm, total }) {
  const [selectedMethod, setSelectedMethod] = useState('Cash');
  const [step, setStep] = useState('selection'); // 'selection' or 'details'

  // Customer Details for Credit Sale
  const [customer, setCustomer] = useState({
    name: '',
    idNo: '',
    phone: '',
    description: ''
  });

  // Refs for focusing inputs
  const nameRef = useRef(null);
  const idNoRef = useRef(null);
  const phoneRef = useRef(null);
  const descRef = useRef(null);
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
        if (step === 'selection') {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedMethod(prev => {
                    const idx = methods.indexOf(prev);
                    return methods[(idx + 1) % methods.length];
                });
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedMethod(prev => {
                    const idx = methods.indexOf(prev);
                    return methods[(idx - 1 + methods.length) % methods.length];
                });
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedMethod === 'Credit Sale') {
                    setStep('details');
                    // Focus logic handled in render/effect
                    setTimeout(() => nameRef.current?.focus(), 100);
                } else {
                    onConfirm({ method: selectedMethod });
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, selectedMethod, onConfirm, onClose]);

  // Handle form submission inside the form inputs
  const handleFormKeyDown = (e, field) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          if (field === 'name') idNoRef.current?.focus();
          if (field === 'idNo') phoneRef.current?.focus();
          if (field === 'phone') descRef.current?.focus();
          if (field === 'description') {
               // Submit
               handleSubmitDetails();
          }
      } else if (e.key === 'Escape') {
          setStep('selection');
      }
  };

  const handleSubmitDetails = () => {
      if (!customer.name) {
          alert('Name is required for Credit Sale');
          nameRef.current?.focus();
          return;
      }
      onConfirm({
          method: 'Credit Sale',
          customerDetails: { ...customer, amount: total }
      });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white p-5 sm:p-8 rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 text-center text-gray-800">Checkout</h2>
        <div className="mb-5 text-center">
            <span className="text-gray-500 text-sm sm:text-base">Total Amount</span>
            <div className="text-3xl sm:text-4xl font-black text-brand-green mt-0.5">Rs. {total.toFixed(2)}</div>
        </div>

        {step === 'selection' && (
            <div>
                <p className="text-center text-gray-500 mb-4 text-xs sm:text-sm">Select Payment Method</p>
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                    {methods.map(m => (
                        <div
                            key={m}
                            onClick={() => {
                                setSelectedMethod(m);
                                if (m === 'Credit Sale') {
                                    setStep('details');
                                } else {
                                    onConfirm({ method: m });
                                }
                            }}
                            className={`p-4 sm:p-6 rounded-xl border-2 text-center cursor-pointer transition-all active:scale-95 ${selectedMethod === m ? 'border-brand-green bg-green-50 shadow-md font-bold' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                            <div className="font-bold text-sm sm:text-base text-gray-800">{m}</div>
                        </div>
                    ))}
                </div>
                <button
                  onClick={onClose}
                  className="w-full mt-4 py-2.5 border rounded-xl text-gray-600 text-xs sm:text-sm font-semibold hover:bg-gray-100"
                >
                  Cancel
                </button>
            </div>
        )}

        {step === 'details' && (
            <div>
                 <h3 className="text-lg font-bold mb-4 border-b pb-2">Customer Details (Credit Sale)</h3>
                 <div className="space-y-4">
                     <div>
                         <label className="block text-sm font-medium text-gray-700">Name</label>
                         <input
                            ref={nameRef}
                            type="text"
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-green outline-none"
                            value={customer.name}
                            onChange={e => setCustomer({...customer, name: e.target.value})}
                            onKeyDown={(e) => handleFormKeyDown(e, 'name')}
                            placeholder="Customer Name"
                            autoFocus
                         />
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                       <div>
                           <label className="block text-sm font-medium text-gray-700">ID / NIC No (Optional)</label>
                           <input
                              ref={idNoRef}
                              type="text"
                              className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-green outline-none"
                              value={customer.idNo}
                              onChange={e => setCustomer({...customer, idNo: e.target.value})}
                              onKeyDown={(e) => handleFormKeyDown(e, 'idNo')}
                              placeholder="ID / NIC"
                           />
                       </div>
                       <div>
                           <label className="block text-sm font-medium text-gray-700">Phone No (Optional)</label>
                           <input
                              ref={phoneRef}
                              type="text"
                              className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-green outline-none"
                              value={customer.phone}
                              onChange={e => setCustomer({...customer, phone: e.target.value})}
                              onKeyDown={(e) => handleFormKeyDown(e, 'phone')}
                              placeholder="Phone Number"
                           />
                       </div>
                     </div>
                     <div>
                         <label className="block text-sm font-medium text-gray-700">Amount Description / Note</label>
                         <input
                            ref={descRef}
                            type="text"
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-green outline-none"
                            value={customer.description}
                            onChange={e => setCustomer({...customer, description: e.target.value})}
                            onKeyDown={(e) => handleFormKeyDown(e, 'description')}
                            placeholder="Items description or note"
                         />
                     </div>
                     <div className="pt-2 flex justify-between">
                         <button onClick={() => setStep('selection')} className="text-gray-500 hover:text-gray-700">Back</button>
                         <button
                            ref={confirmBtnRef}
                            onClick={handleSubmitDetails}
                            className="bg-brand-green text-white px-6 py-2 rounded font-bold hover:bg-green-700"
                         >
                             Confirm (Enter)
                         </button>
                     </div>
                 </div>
            </div>
        )}
      </div>
    </div>
  );
}
