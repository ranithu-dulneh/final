import React, { useState } from 'react';
import Register from './Register';
import Inventory from './Inventory';
import Stocks from './Stocks';
import Reports from './Reports';
import PinModal from './PinModal';

export default function Layout() {
  const [currentView, setCurrentView] = useState('register');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Security State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingView, setPendingView] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Session-based auth for simplicity

  const protectedViews = ['inventory', 'reports'];

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
        return <Register />;
      case 'inventory':
        return <Inventory />;
      case 'stocks':
        return <Stocks />;
      case 'reports':
        return <Reports />;
      default:
        return <Register />;
    }
  };

  const navItems = [
    { id: 'register', label: 'Register' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'stocks', label: 'Stocks' },
    { id: 'reports', label: 'Reports' },
  ];

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handlePinSuccess}
      />
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white shadow-lg">
        <div className="p-4 border-b">
          <h1 className="text-2xl font-bold text-blue-600">QuickPOS</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                currentView === item.id
                  ? 'bg-blue-50 text-blue-600 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
               {item.label} {protectedViews.includes(item.id) && !isAuthenticated && '🔒'}
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile Header & Menu */}
      <div className="md:hidden fixed top-0 w-full bg-white shadow-sm z-50 flex justify-between items-center p-4">
        <h1 className="text-xl font-bold text-blue-600">QuickPOS</h1>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2">
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
                    ? 'bg-blue-50 text-blue-600 font-semibold'
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
      <main className="flex-1 overflow-auto md:p-8 p-4 pt-20 md:pt-8">
        {renderView()}
      </main>
    </div>
  );
}
