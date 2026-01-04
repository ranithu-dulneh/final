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
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Session-based auth for simplicity

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
        // Adding a key to force re-mount when returning to Register might help fetch latest products
        // But usually useEffect [] runs on mount.
        // If we switch views, the previous component unmounts.
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
    { id: 'register', label: 'Register' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'stocks', label: 'Stocks' },
    { id: 'reports', label: 'Sales Reports' },
    { id: 'finances', label: 'Finances & P&L' },
    { id: 'creditors', label: 'Creditors' },
  ];

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handlePinSuccess}
      />
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white shadow-lg border-r border-gray-200">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-2xl font-bold text-brand-green">Thusira<span className="text-brand-gold"> Chemical Stores</span></h1>
          <p className="text-xs text-gray-400 mt-1">Management System</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${
                currentView === item.id
                  ? 'bg-green-50 text-brand-green font-bold shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
               <span className="flex items-center justify-between">
                 {item.label}
                 {protectedViews.includes(item.id) && !isAuthenticated && <span className="text-xs text-gray-400">🔒</span>}
               </span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile Header & Menu */}
      <div className="md:hidden fixed top-0 w-full bg-white shadow-sm z-50 flex justify-between items-center p-4">
        <h1 className="text-xl font-bold text-brand-green">Thusira<span className="text-brand-gold"> Chemical Stores</span></h1>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-gray-600">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className="md:hidden fixed top-16 w-full bg-white shadow-lg z-40 border-t">
          <nav className="flex flex-col p-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full text-left px-4 py-3 rounded-lg ${
                  currentView === item.id
                    ? 'bg-green-50 text-brand-green font-semibold'
                    : 'text-gray-600'
                }`}
              >
                 {item.label} {protectedViews.includes(item.id) && !isAuthenticated && '🔒'}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto md:p-8 p-4 pt-20 md:pt-8 bg-gray-50">
        {renderView()}
      </main>
    </div>
  );
}
