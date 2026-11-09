import React, { useState } from 'react';
import Register from './Register';
import Inventory from './Inventory';
import Stocks from './Stocks';
import Reports from './Reports';
import Finances from './Finances';
import Creditors from './Creditors';
import PinModal from './PinModal';

export default function Layout() {
  const [currentView, setCurrentView] = useState('register');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Security State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingView, setPendingView] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Session-based auth

  const protectedViews = ['inventory', 'reports', 'finances', 'creditors'];

  const handleNavClick = (viewId) => {
    if (protectedViews.includes(viewId) && !isAuthenticated) {
      setPendingView(viewId);
      setIsPinModalOpen(true);
    } else {
      setCurrentView(viewId);
    }
    setIsMenuOpen(false);
  };

  const handlePinSuccess = () => {
    setIsAuthenticated(true);
    setIsPinModalOpen(false);
    if (pendingView) {
      setCurrentView(pendingView);
      setPendingView(null);
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'register':
        return <Register key="register" />;
      case 'inventory':
        return <Inventory />;
      case 'stocks':
        return <Stocks />;
      case 'reports':
        return <Reports />;
      case 'finances':
        return <Finances />;
      case 'creditors':
        return <Creditors />;
      default:
        return <Register />;
    }
  };

  const navItems = [
    { id: 'register', label: 'Register', icon: '🛒' },
    { id: 'inventory', label: 'Inventory', icon: '📦' },
    { id: 'stocks', label: 'Stocks', icon: '📊' },
    { id: 'reports', label: 'Sales Reports', icon: '📑' },
    { id: 'finances', label: 'Finances & P&L', icon: '💰' },
    { id: 'creditors', label: 'Creditors / Profiles', icon: '👥' },
  ];

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handlePinSuccess}
      />

      {/* Sidebar for Desktop & Tablets (>= md) */}
      <aside className="hidden md:flex flex-col w-64 bg-white shadow-lg border-r border-gray-200 flex-shrink-0">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-black text-brand-green tracking-tight leading-tight">
            Thusira<span className="text-brand-gold"> Chemical Stores</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-medium">POS & Management System</p>
        </div>
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full text-left px-3.5 py-3 rounded-xl transition-all duration-150 flex items-center justify-between text-sm font-semibold ${
                currentView === item.id
                  ? 'bg-green-50 text-brand-green font-bold shadow-sm border border-green-200/50'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </span>
              {protectedViews.includes(item.id) && !isAuthenticated && (
                <span className="text-xs opacity-60">🔒</span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile Top Header (Fixed) */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white shadow-sm z-40 flex justify-between items-center px-4 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">🌱</span>
          <h1 className="text-base font-black text-brand-green truncate leading-tight">
            Thusira<span className="text-brand-gold"> Chemical Stores</span>
          </h1>
        </div>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 -mr-2 text-gray-700 hover:bg-gray-100 rounded-lg active:scale-95 transition"
          aria-label="Toggle Navigation Menu"
        >
          {isMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu Backdrop & Dropdown Drawer */}
      {isMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40 animate-fadeIn"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="md:hidden fixed top-14 left-0 right-0 bg-white shadow-2xl z-50 border-b rounded-b-2xl p-3 space-y-1 max-h-[80vh] overflow-y-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between text-sm font-bold transition ${
                  currentView === item.id
                    ? 'bg-green-100/70 text-brand-green'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </span>
                {protectedViews.includes(item.id) && !isAuthenticated && (
                  <span className="text-xs text-gray-400">🔒</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto md:p-8 p-3 pt-16 pb-20 md:pb-8 bg-gray-50">
        {renderView()}
      </main>

      {/* Mobile Bottom Navigation Bar (Fixed for quick 1-tap switching) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 z-30 flex items-center justify-around px-1 shadow-lg">
        {[
          { id: 'register', label: 'POS', icon: '🛒' },
          { id: 'inventory', label: 'Items', icon: '📦' },
          { id: 'stocks', label: 'Stocks', icon: '📊' },
          { id: 'creditors', label: 'Credit', icon: '👥' },
          { id: 'reports', label: 'Reports', icon: '📑' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-lg transition-all ${
              currentView === item.id
                ? 'text-brand-green font-black scale-105'
                : 'text-gray-500 hover:text-gray-900 font-medium'
            }`}
          >
            <span className="text-lg leading-tight">{item.icon}</span>
            <span className="text-[10px] mt-0.5 leading-none">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
