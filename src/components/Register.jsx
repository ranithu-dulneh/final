import React, { useState, useEffect } from 'react';
import PinModal from './PinModal'; // Ensure this is available if used, or use inline logic

// Inline ProductModal (same as before but we should keep it)
function ProductModal({ product, onClose, onConfirm }) {
  const [selectedVariantId, setSelectedVariantId] = useState(product.variants[0]?.id || null);
  const [quantity, setQuantity] = useState(''); // Text input for easier typing
  const [discount, setDiscount] = useState(0);
  const [saleUnit, setSaleUnit] = useState('Unit'); // 'Unit', 'Kg', 'g'
  const [isSpecialDiscount, setIsSpecialDiscount] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const selectedVariant = product.variants.find(v => v.id == selectedVariantId);
  const maxDiscount = selectedVariant?.max_discount || 0;
  const itemUnit = selectedVariant?.measure_unit || 'Unit';

  // Update sale unit when variant changes
  useEffect(() => {
    if (selectedVariant) {
        setSaleUnit(selectedVariant.measure_unit || 'Unit');
    }
  }, [selectedVariant]);

  // Conversion logic
  // normalizedQty is what we subtract from stock (in base unit)
  let normalizedQty = parseFloat(quantity) || 0;
  if (itemUnit === 'Kg' && saleUnit === 'g') {
      normalizedQty = normalizedQty / 1000;
  }

  // Calculate price
  // Price is per ITEM UNIT.
  const pricePerBaseUnit = selectedVariant ? selectedVariant.selling_price : 0;
  const unitPrice = pricePerBaseUnit; // For calc purposes

  const discountedUnitPrice = unitPrice - (isSpecialDiscount ? (unitPrice * discount / 100) : (unitPrice * Math.min(discount, maxDiscount) / 100));
  const finalTotal = discountedUnitPrice * normalizedQty;

  const handleConfirm = () => {
    if (!selectedVariant) return;
    const qtyVal = parseFloat(quantity);
    if (!qtyVal || qtyVal <= 0) {
        alert("Enter valid quantity");
        return;
    }

    if (normalizedQty > selectedVariant.stock) {
      alert(`Insufficient stock! Request: ${normalizedQty} ${itemUnit}, Available: ${selectedVariant.stock} ${itemUnit}`);
      return;
    }

    if (discount > maxDiscount && !isSpecialDiscount) {
      alert(`Discount exceeds maximum allowed (${maxDiscount}%). Enable Special Discount to override.`);
      return;
    }

    onConfirm({
      productName: product.name,
      variantId: selectedVariant.id,
      variantName: selectedVariant.name,
      price: pricePerBaseUnit, // Base price per stock unit
      quantity: normalizedQty, // Stock decrement amount
      displayQuantity: qtyVal,
      displayUnit: saleUnit,
      discount: isSpecialDiscount ? discount : Math.min(discount, maxDiscount),
      finalPrice: discountedUnitPrice // Price per base unit after discount
    });
    onClose();
  };

  const toggleSpecialDiscount = (e) => {
    if (e.target.checked) {
      setShowPin(true);
    } else {
      setIsSpecialDiscount(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-full max-w-md">
        <h3 className="text-xl font-bold mb-4">{product.name}</h3>

        {/* Variant Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Variant</label>
          <div className="grid grid-cols-2 gap-2">
             {product.variants.map(v => (
               <button
                 key={v.id}
                 onClick={() => setSelectedVariantId(v.id)}
                 className={`p-2 border rounded text-sm ${selectedVariantId === v.id ? 'bg-brand-green text-white border-brand-green' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
               >
                 {v.name} (Rs. {v.selling_price}/{v.measure_unit || 'Unit'})
               </button>
             ))}
          </div>
          {selectedVariant && (
             <p className="text-xs text-gray-500 mt-1">Stock: {selectedVariant.stock} {selectedVariant.measure_unit || 'Unit'} available</p>
          )}
        </div>

        {/* Quantity */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
          <div className="flex gap-2">
            <input
              type="number"
              autoFocus
              onFocus={(e) => e.target.select()}
              value={quantity}
              placeholder="Qty"
              onChange={(e) => setQuantity(e.target.value)}
              className="p-3 border rounded w-2/3 text-lg font-bold outline-brand-green"
            />
            {itemUnit === 'Kg' ? (
                <select
                    value={saleUnit}
                    onChange={(e) => setSaleUnit(e.target.value)}
                    className="p-2 border rounded w-1/3 bg-white font-semibold"
                >
                    <option value="Kg">Kg</option>
                    <option value="g">g</option>
                </select>
            ) : (
                <div className="p-3 border rounded w-1/3 bg-gray-50 text-center font-semibold text-gray-600">
                    {itemUnit}
                </div>
            )}
          </div>
        </div>

        {/* Discount */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%) (Max: {maxDiscount}%)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              className="p-2 border rounded w-full"
            />
            <div className="flex items-center whitespace-nowrap">
               <input
                 type="checkbox"
                 id="special"
                 checked={isSpecialDiscount}
                 onChange={toggleSpecialDiscount}
                 className="mr-1"
               />
               <label htmlFor="special" className="text-sm cursor-pointer select-none">Special (Admin)</label>
            </div>
          </div>
        </div>

        {/* Total Display */}
        <div className="bg-gray-50 p-3 rounded mb-6 flex justify-between items-center">
           <span className="text-gray-600">Total</span>
           <span className="text-xl font-bold text-brand-green">Rs. {finalTotal.toFixed(2)}</span>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border rounded text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleConfirm} className="flex-1 py-2 bg-brand-green text-white rounded hover:bg-green-700 font-bold">Add to Cart</button>
        </div>
      </div>

      {showPin && (
         <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-60">
            <div className="bg-white p-6 rounded shadow-lg text-center">
               <h3 className="mb-4 font-bold">Admin Authorization</h3>
               <input type="password" id="adminPin" placeholder="PIN" className="border p-2 rounded mb-4" />
               <div className="flex gap-2 justify-center">
                  <button onClick={() => setShowPin(false)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                  <button onClick={() => {
                     const val = document.getElementById('adminPin').value;
                     if(val === '1234') {
                        setIsSpecialDiscount(true);
                        setShowPin(false);
                     } else {
                        alert('Incorrect PIN');
                     }
                  }} className="px-4 py-2 bg-red-600 text-white rounded">Verify</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}

export default function Register() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [lastSale, setLastSale] = useState(null);
  const [fetchError, setFetchError] = useState(false);

  const fetchData = async () => {
    setFetchError(false);
    try {
      const prodRes = await fetch('/api/products');
      if (!prodRes.ok) throw new Error("Failed to fetch products");
      const prodData = await prodRes.json();
      if (prodData.data) setProducts(prodData.data);

      const catRes = await fetch('/api/categories');
      if (catRes.ok) {
         const catData = await catRes.json();
         if (catData.data) setCategories(catData.data);
      }
    } catch (e) {
      console.error(e);
      setFetchError(true);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                          p.variants.some(v => v.sku.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (itemData) => {
    // Check if variant already in cart
    const existing = cart.find(c => c.variantId === itemData.variantId && c.discount === itemData.discount);

    if (existing) {
       const newCart = cart.map(c =>
         (c.variantId === itemData.variantId && c.discount === itemData.discount)
         ? { ...c, quantity: c.quantity + itemData.quantity }
         : c
       );
       setCart(newCart);
    } else {
       setCart([...cart, { ...itemData, id: Date.now() }]);
    }
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const total = cart.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);

    const saleData = {
      items: cart.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity,
        price: item.finalPrice,
        discount: (item.price - item.finalPrice)
      }))
    };

    try {
      const res = await fetch('/api/sales', {
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
        fetch('/api/products') // Refresh stock
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

  if (lastSale) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full border text-center">
          <div className="mb-4">
             <div className="w-16 h-16 bg-green-100 text-brand-green rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
             </div>
             <h2 className="text-2xl font-bold text-gray-800">Payment Successful</h2>
             <p className="text-gray-500">{lastSale.date}</p>
          </div>
          <div className="border-t border-b py-4 mb-4 text-left">
            {lastSale.items.map((item, i) => (
              <div key={i} className="flex justify-between mb-2">
                <span>{item.productName} ({item.variantName}) x{item.quantity}</span>
                <span>Rs. {(item.finalPrice * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xl font-bold mb-6"><span>Total</span> <span>Rs. {lastSale.total.toFixed(2)}</span></div>
          <button onClick={() => setLastSale(null)} className="w-full bg-brand-green text-white py-3 rounded-lg font-bold hover:bg-green-700">New Sale</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Product Grid */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Search & Categories */}
        <div className="mb-4 space-y-3">
          <input
            type="text"
            placeholder="Search by Name or SKU..."
            className="w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-brand-green outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex flex-wrap gap-2">
             <button
               onClick={() => setSelectedCategory('All')}
               className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${selectedCategory === 'All' ? 'bg-brand-green text-white border-brand-green' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
             >
               All
             </button>
             {categories.map(cat => (
               <button
                 key={cat.id}
                 onClick={() => setSelectedCategory(cat.name)}
                 className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${selectedCategory === cat.name ? 'bg-brand-green text-white border-brand-green' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
               >
                 {cat.name}
               </button>
             ))}
          </div>
        </div>

        {fetchError && (
          <div className="p-4 text-center">
            <p className="text-red-500 mb-2">Error loading data.</p>
            <button onClick={fetchData} className="bg-blue-600 text-white px-4 py-2 rounded">Retry</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 p-1">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              className="bg-white p-4 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow border border-gray-100 flex flex-col justify-between"
            >
              <div>
                <h3 className="font-bold text-gray-800">{product.name}</h3>
                <p className="text-xs text-gray-500 mb-1">{product.category}</p>
                <p className="text-xs text-gray-400">{product.variants.length} Variants</p>
              </div>
              <div className="mt-2 text-right">
                <span className="text-sm font-semibold text-brand-green">Select &gt;</span>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
             <div className="col-span-full text-center text-gray-400 py-10">
                No products found.
             </div>
          )}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-full lg:w-96 bg-white rounded-lg shadow-lg flex flex-col h-[60vh] lg:h-auto border border-gray-200">
        <div className="p-4 border-b bg-gray-50 rounded-t-lg">
          <h2 className="text-xl font-bold text-gray-800">Current Order</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
           {cart.length === 0 && <p className="text-center text-gray-400 mt-10">Cart is empty</p>}
           {cart.map((item, index) => (
             <div key={index} className="flex justify-between items-center border-b pb-2">
               <div>
                 <h4 className="font-medium text-gray-800">{item.productName} <span className="text-sm text-gray-500">({item.variantName})</span></h4>
                 <div className="text-xs text-gray-500">Rs. {item.finalPrice.toFixed(2)} x {item.displayQuantity || item.quantity} {item.displayUnit || ''} {item.discount > 0 && <span className="text-green-600">(-{item.discount}%)</span>}</div>
               </div>
               <div className="flex items-center gap-3">
                 <span className="font-bold">Rs. {(item.finalPrice * item.quantity).toFixed(2)}</span>
                 <button onClick={() => removeFromCart(index)} className="text-red-500 font-bold">&times;</button>
               </div>
             </div>
           ))}
        </div>

        <div className="p-4 border-t bg-gray-50 rounded-b-lg">
          <div className="flex justify-between text-xl font-bold text-gray-800 mb-4">
              <span>Total</span>
              <span>Rs. {total.toFixed(2)}</span>
          </div>

          {message && <div className={`mb-2 text-center text-sm font-bold ${message.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>{message}</div>}

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || loading}
            className="w-full bg-brand-green text-white py-3 rounded-lg font-bold shadow hover:bg-green-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'Processing...' : 'Charge'}
          </button>
        </div>
      </div>

      {/* Modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onConfirm={addToCart}
        />
      )}
    </div>
  );
}
