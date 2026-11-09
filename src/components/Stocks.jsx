import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { ref, onValue } from "firebase/database";

export default function Stocks() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'low' | 'healthy'

  useEffect(() => {
    const productsRef = ref(db, 'products');
    const unsubscribe = onValue(productsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const productsList = Object.entries(data).map(([id, product]) => ({
                id,
                ...product,
                variants: product.variants || []
            }));
            setProducts(productsList);
        } else {
            setProducts([]);
        }
    });

    return () => unsubscribe();
  }, []);

  const allItems = useMemo(() => {
    return products.flatMap(product =>
      product.variants.map((variant, index) => ({
        key: `${product.id}-${index}`,
        productId: product.id,
        productName: product.name,
        category: product.category,
        variantName: variant.name,
        sku: variant.sku || '-',
        stock: parseFloat(variant.stock) || 0,
        unit: variant.measure_unit || 'Unit',
        price: variant.selling_price
      }))
    );
  }, [products]);

  const stats = useMemo(() => {
    let low = 0;
    let healthy = 0;
    allItems.forEach(item => {
      if (item.stock < 5) low++;
      else healthy++;
    });
    return { total: allItems.length, low, healthy };
  }, [allItems]);

  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      let matchesFilter = true;
      if (filter === 'low') matchesFilter = item.stock < 5;
      else if (filter === 'healthy') matchesFilter = item.stock >= 5;

      const q = search.toLowerCase().trim();
      const matchesSearch = !q ||
        item.productName.toLowerCase().includes(q) ||
        item.variantName.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q));

      return matchesFilter && matchesSearch;
    });
  }, [allItems, filter, search]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Top Header & Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm text-center">
          <span className="text-[10px] sm:text-xs text-gray-500 uppercase font-semibold">Total Items</span>
          <span className="text-lg sm:text-2xl font-black text-gray-800 block mt-0.5">{stats.total}</span>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-red-100 shadow-sm text-center">
          <span className="text-[10px] sm:text-xs text-red-500 uppercase font-semibold">Low Stock (&lt; 5)</span>
          <span className="text-lg sm:text-2xl font-black text-red-600 block mt-0.5">{stats.low}</span>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-green-100 shadow-sm text-center">
          <span className="text-[10px] sm:text-xs text-green-600 uppercase font-semibold">Healthy Stock</span>
          <span className="text-lg sm:text-2xl font-black text-green-700 block mt-0.5">{stats.healthy}</span>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search stock by product, variant, SKU..."
              className="w-full pl-9 pr-9 py-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-green outline-none"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md transition ${filter === 'all' ? 'bg-white text-brand-green shadow-sm font-bold' : 'text-gray-600'}`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setFilter('low')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md transition ${filter === 'low' ? 'bg-white text-red-600 shadow-sm font-bold' : 'text-gray-600'}`}
            >
              Low Stock ({stats.low})
            </button>
            <button
              onClick={() => setFilter('healthy')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md transition ${filter === 'healthy' ? 'bg-white text-green-700 shadow-sm font-bold' : 'text-gray-600'}`}
            >
              Healthy ({stats.healthy})
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Stock Cards (block md:hidden) */}
      <div className="block md:hidden space-y-2.5">
        {filteredItems.map(item => (
          <div key={item.key} className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-3">
              <h3 className="font-bold text-gray-900 text-sm truncate">{item.productName}</h3>
              <p className="text-xs text-gray-500">
                {item.variantName} {item.sku !== '-' && <span className="font-mono text-gray-400">({item.sku})</span>}
              </p>
              <div className="text-[11px] text-gray-400 mt-0.5">Rs. {item.price} / {item.unit}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <span className={`px-2.5 py-1 inline-flex text-xs font-bold rounded-lg ${
                item.stock < 5 ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-800'
              }`}>
                {item.stock} {item.unit}
              </span>
              <span className="block text-[10px] text-gray-400 mt-0.5">
                {item.stock < 5 ? 'Low Stock' : 'In Stock'}
              </span>
            </div>
          </div>
        ))}
        {filteredItems.length === 0 && (
          <div className="bg-white p-8 rounded-xl text-center text-gray-400 text-sm border border-dashed">
            No stock records match.
          </div>
        )}
      </div>

      {/* Desktop Stock Table (hidden md:block) */}
      <div className="hidden md:block bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-6 py-3 text-left">Product</th>
              <th className="px-6 py-3 text-left">Variant</th>
              <th className="px-6 py-3 text-left">SKU</th>
              <th className="px-6 py-3 text-left">Price</th>
              <th className="px-6 py-3 text-right">Stock Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 text-sm">
            {filteredItems.map(item => (
              <tr key={item.key} className="hover:bg-gray-50/80 transition">
                <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{item.productName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{item.variantName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-400 font-mono text-xs">{item.sku}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-700 font-medium">Rs. {item.price} / {item.unit}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className={`px-2.5 py-1 inline-flex text-xs font-bold rounded-full ${
                    item.stock < 5 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {item.stock} {item.unit} Remaining
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
