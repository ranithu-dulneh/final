import React, { useState, useEffect, useRef } from 'react';

const methods = ['Cash', 'Card', 'Bank Transfer', 'Credit Sale'];

export default function PaymentModal({ onClose, onConfirm, total }) {
  const [selectedMethod, setSelectedMethod] = useState('Cash');
  const [step, setStep] = useState('selection'); // 'selection' or 'details'

  // Customer Details for Credit Sale
  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    description: ''
  });

  // Refs for focusing inputs
  const nameRef = useRef(null);
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
          if (field === 'name') phoneRef.current?.focus();
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
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-2xl max-w-lg w-full">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Checkout</h2>
        <div className="mb-6 text-center">
            <span className="text-gray-500 text-lg">Total Amount</span>
            <div className="text-4xl font-bold text-brand-green mt-1">Rs. {total.toFixed(2)}</div>
        </div>

        {step === 'selection' && (
            <div>
                <p className="text-center text-gray-500 mb-4 text-sm">Select Payment Method (Use Arrows + Enter)</p>
                <div className="grid grid-cols-2 gap-4">
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
                            className={`p-6 rounded-lg border-2 text-center cursor-pointer transition-all transform ${selectedMethod === m ? 'border-brand-green bg-green-50 scale-105 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                            <div className="font-bold text-lg text-gray-700">{m}</div>
                        </div>
                    ))}
                </div>
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
                     <div>
                         <label className="block text-sm font-medium text-gray-700">Phone No</label>
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
