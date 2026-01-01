import React, { useState } from 'react';

export default function PinModal({ isOpen, onClose, onSuccess }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Hardcoded PIN for demonstration
    if (pin === '1234') {
      onSuccess();
      setPin('');
      setError('');
    } else {
      setError('Incorrect PIN');
      setPin('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl w-80">
        <h2 className="text-xl font-bold mb-4 text-center">Manager Access</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            maxLength="4"
            className="w-full text-center text-3xl tracking-widest border-2 border-gray-300 rounded-lg p-2 mb-4 focus:border-blue-500 outline-none"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            autoFocus
          />
          {error && <p className="text-red-500 text-center mb-4">{error}</p>}
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Enter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
