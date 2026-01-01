import React, { useState, useEffect } from 'react';

export default function Register() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [lastSale, setLastSale] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3001/api/products')
      .then(res => res.json())
      .then(data => {
        if (data.data) setProducts(data.data);
      });
  }, []);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product) => {
    if (product.stock <= 0) {
      alert('Out of stock!');
      return;
    }
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        alert('Not enough stock!');
        return;
      }
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const updateQuantity = (id, newQty) => {
    if (newQty <= 0) {
      setCart(cart.filter(item => item.id !== id));
      return;
    }
    const product = products.find(p => p.id === id);
    if (newQty > product.stock) {
      alert('Not enough stock!');
      return;
    }
    setCart(cart.map(item => item.id === id ? { ...item, quantity: newQty } : item));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
  const tax = subtotal * 0.1; // 10% tax example
  const total = subtotal + tax;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);

    const saleData = {
      items: cart.map(item => ({
        productId: item.id,
        quantity: item.quantity,
        price: item.selling_price
      }))
    };

    try {
      const res = await fetch('http://localhost:3001/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData)
      });

      if (res.ok) {
        const data = await res.json();
        setMessage('Transaction Successful!');
        setLastSale({
          id: data.saleId,
          items: [...cart],
          total: total,
          date: new Date().toLocaleString()
        });
        setCart([]);
        // Refresh products to get new stock levels
        fetch('http://localhost:3001/api/products')
          .then(res => res.json())
          .then(data => setProducts(data.data || []));

        setTimeout(() => setMessage(''), 3000);
      } else {
        const err = await res.json();
        setMessage('Error: ' + err.error);
      }
    } catch (error) {
      setMessage('Network Error');
    }
    setLoading(false);
  };

  const closeReceipt = () => {
    setLastSale(null);
  };

  if (lastSale) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full border text-center">
          <div className="mb-4">
             <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
             </div>
             <h2 className="text-2xl font-bold text-gray-800">Payment Successful</h2>
             <p className="text-gray-500">{lastSale.date}</p>
             <p className="text-gray-400 text-sm">Sale ID: #{lastSale.id}</p>
          </div>

          <div className="border-t border-b py-4 mb-4 text-left">
            {lastSale.items.map((item) => (
              <div key={item.id} className="flex justify-between mb-2">
                <span>{item.name} x{item.quantity}</span>
                <span>${(item.selling_price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="text-right space-y-1 mb-6">
             <div className="flex justify-between text-gray-600"><span>Subtotal</span> <span>${(lastSale.total / 1.1).toFixed(2)}</span></div>
             <div className="flex justify-between text-gray-600"><span>Tax (10%)</span> <span>${(lastSale.total - (lastSale.total / 1.1)).toFixed(2)}</span></div>
             <div className="flex justify-between text-xl font-bold"><span>Total</span> <span>${lastSale.total.toFixed(2)}</span></div>
          </div>

          <button
            onClick={closeReceipt}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700"
          >
            New Sale
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Product Grid */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by Name or SKU..."
            className="w-full p-3 border rounded-lg shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 p-1">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              onClick={() => addToCart(product)}
              className="bg-white p-4 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow border border-gray-100 flex flex-col justify-between"
            >
              <div>
                <h3 className="font-bold text-gray-800">{product.name}</h3>
                <p className="text-sm text-gray-500">{product.sku}</p>
              </div>
              <div className="mt-2 flex justify-between items-center">
                <span className="font-bold text-blue-600">${product.selling_price}</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${product.stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {product.stock} left
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-full lg:w-96 bg-white rounded-lg shadow-lg flex flex-col h-[80vh] lg:h-auto">
        <div className="p-4 border-b bg-gray-50 rounded-t-lg">
          <h2 className="text-xl font-bold">Current Order</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
           {cart.length === 0 && <p className="text-center text-gray-400 mt-10">Cart is empty</p>}
           {cart.map(item => (
             <div key={item.id} className="flex justify-between items-center border-b pb-2">
               <div>
                 <h4 className="font-medium">{item.name}</h4>
                 <div className="text-sm text-gray-500">${item.selling_price} x {item.quantity}</div>
               </div>
               <div className="flex items-center space-x-2">
                 <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 bg-gray-200 rounded text-gray-700">-</button>
                 <span className="w-8 text-center">{item.quantity}</span>
                 <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 bg-gray-200 rounded text-gray-700">+</button>
               </div>
             </div>
           ))}
        </div>

        <div className="p-4 border-t bg-gray-50 rounded-b-lg">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax (10%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-gray-800">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          {message && <div className={`mb-2 text-center text-sm font-bold ${message.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>{message}</div>}

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'Processing...' : 'Charge'}
          </button>
        </div>
      </div>
    </div>
  );
}
