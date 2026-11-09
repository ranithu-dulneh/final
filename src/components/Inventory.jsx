import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, push, set, remove, update } from "firebase/database";

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    name: '', category: ''
  });
  const [variants, setVariants] = useState([]);
  const [variantForm, setVariantForm] = useState({
    name: '', sku: '', cost_price: '', selling_price: '', stock: '', max_discount: '', measure_unit: 'Unit'
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editProductId, setEditProductId] = useState(null);
  const [inventorySearch, setInventorySearch] = useState('');

  useEffect(() => {
    const productsRef = ref(db, 'products');
    const unsubscribeProducts = onValue(productsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convert object to array and preserve keys as IDs
        const productsList = Object.entries(data).map(([id, product]) => ({
          id,
          ...product,
          variants: product.variants || [] // Ensure variants is an array
        }));
        setProducts(productsList);
      } else {
        setProducts([]);
      }
    });

    const categoriesRef = ref(db, 'categories');
    const unsubscribeCategories = onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const categoriesList = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        setCategories(categoriesList);
      } else {
        // Seed initial categories if empty
        const initialCategories = ['Fertilizer', 'Insecticide', 'Herbicide', 'Fungicide', 'Seeds', 'Equipment'];
        initialCategories.forEach(name => {
           push(categoriesRef, { name });
        });
      }
    });

    return () => {
      unsubscribeProducts();
      unsubscribeCategories();
    };
  }, []);

  // Effect to set default category when categories load
  useEffect(() => {
      if (!formData.category && categories.length > 0 && !isEditing) {
          setFormData(prev => ({ ...prev, category: categories[0].name }));
      }
  }, [categories, formData.category, isEditing]);


  const handleProductChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddCategory = async () => {
    const newCat = prompt("Enter new category name:");
    if (!newCat) return;
    try {
      const categoriesRef = ref(db, 'categories');
      const newCatRef = push(categoriesRef);
      await set(newCatRef, { name: newCat });
      setFormData({ ...formData, category: newCat });
    } catch (e) {
      console.error(e);
      alert("Failed to add category");
    }
  };

  const handleVariantChange = (e) => {
    setVariantForm({ ...variantForm, [e.target.name]: e.target.value });
  };

  const addVariant = () => {
    if (!variantForm.name || !variantForm.sku || !variantForm.selling_price) {
      alert("Name, SKU, and Selling Price are required for a variant.");
      return;
    }
    setVariants([...variants, { ...variantForm, id: Date.now().toString() + Math.random().toString().slice(2) }]); // Generate a temp ID
    setVariantForm({ name: '', sku: '', cost_price: '', selling_price: '', stock: '', max_discount: '', measure_unit: 'Unit' });
  };

  const removeVariant = (index, variant) => {
       if (isEditing) {
           if (!window.confirm("Are you sure you want to delete this variant?")) return;
       }
       setVariants(variants.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (variants.length === 0) {
      alert("Please add at least one variant.");
      return;
    }
    setLoading(true);
    setMessage('');

    const payload = {
        ...formData,
        category: formData.category || (categories[0]?.name || 'Uncategorized'),
        variants
    };

    try {
      if (isEditing) {
        const productRef = ref(db, `products/${editProductId}`);
        await update(productRef, payload);
        setMessage('Product updated successfully!');
      } else {
        const productsRef = ref(db, 'products');
        const newProductRef = push(productsRef);
        await set(newProductRef, payload);
        setMessage('Product added successfully!');
      }
      resetForm();
    } catch (error) {
      setMessage('Error connecting to server: ' + error.message);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({ name: '', category: categories[0]?.name || '' });
    setVariants([]);
    setVariantForm({ name: '', sku: '', cost_price: '', selling_price: '', stock: '', max_discount: '', measure_unit: 'Unit' });
    setIsEditing(false);
    setEditProductId(null);
  };

  const handleEdit = (product) => {
    setIsEditing(true);
    setEditProductId(product.id);
    setFormData({ name: product.name, category: product.category });
    setVariants(product.variants || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product and all its variants?')) return;
    try {
      await remove(ref(db, `products/${id}`));
    } catch (error) {
      console.error('Error deleting product', error);
    }
  };

  const handleRestock = async (product, variantIndex) => {
    const quantity = prompt('Enter quantity to add:', '0');
    if (!quantity || isNaN(quantity)) return;
    const qtyInt = parseInt(quantity);
    if (qtyInt === 0) return;

    try {
      const currentStock = parseInt(product.variants[variantIndex].stock || 0);
      const newStock = currentStock + qtyInt;

      const variantStockRef = ref(db, `products/${product.id}/variants/${variantIndex}/stock`);
      await set(variantStockRef, newStock); // Use set to update the specific value

    } catch (error) {
      console.error('Error restocking', error);
      alert('Error updating stock');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-brand-green">
        <div className="flex justify-between items-center mb-4">
           <h2 className="text-xl font-semibold text-brand-green">{isEditing ? 'Edit Product' : 'Add New Product'}</h2>
           {isEditing && <button onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-700">Cancel Edit</button>}
        </div>

        {message && <div className={`mb-4 p-2 rounded ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{message}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input name="name" placeholder="Product Name" value={formData.name} onChange={handleProductChange} className="p-2 border rounded focus:ring-2 focus:ring-brand-green outline-none" required />

            <div className="flex gap-2">
                <select
                    name="category"
                    value={formData.category}
                    onChange={handleProductChange}
                    className="p-2 border rounded focus:ring-2 focus:ring-brand-green outline-none flex-1 bg-white"
                >
                    {categories.length === 0 && <option>Loading...</option>}
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <button type="button" onClick={handleAddCategory} className="bg-gray-200 text-gray-700 px-3 rounded hover:bg-gray-300">+</button>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded border border-gray-200">
            <h3 className="text-md font-medium mb-2 text-gray-700">Variants</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-2">
              <input name="name" placeholder="Variant (e.g. 100ml)" value={variantForm.name} onChange={handleVariantChange} className="p-2 border rounded text-sm" />
              <input name="sku" placeholder="SKU/Barcode" value={variantForm.sku} onChange={handleVariantChange} className="p-2 border rounded text-sm" />
              <input name="cost_price" type="number" placeholder="Cost" value={variantForm.cost_price} onChange={handleVariantChange} className="p-2 border rounded text-sm" />
              <input name="selling_price" type="number" placeholder="Price (Rs)" value={variantForm.selling_price} onChange={handleVariantChange} className="p-2 border rounded text-sm" />
              <div className="flex gap-1">
                 <input name="stock" type="number" placeholder="Stock" value={variantForm.stock} onChange={handleVariantChange} className="p-2 border rounded text-sm w-2/3" />
                 <select name="measure_unit" value={variantForm.measure_unit} onChange={handleVariantChange} className="p-2 border rounded text-sm w-1/3 bg-white">
                    <option value="Unit">Unit</option>
                    <option value="Kg">Kg</option>
                    <option value="g">g</option>
                 </select>
              </div>
              <input name="max_discount" type="number" placeholder="Max Disc %" value={variantForm.max_discount} onChange={handleVariantChange} className="p-2 border rounded text-sm" />
            </div>
            <button type="button" onClick={addVariant} className="bg-gray-600 text-white px-4 py-1 rounded text-sm hover:bg-gray-700">Add Variant</button>

            {variants.length > 0 && (
              <div className="mt-4">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 text-left">Variant</th>
                      <th className="p-2 text-left">SKU</th>
                      <th className="p-2 text-left">Price</th>
                      <th className="p-2 text-left">Stock</th>
                      <th className="p-2 text-left">Unit</th>
                      <th className="p-2 text-left">Max Disc</th>
                      <th className="p-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2">{v.name}</td>
                        <td className="p-2">{v.sku}</td>
                        <td className="p-2">Rs. {v.selling_price}</td>
                        <td className="p-2">{v.stock}</td>
                        <td className="p-2">{v.measure_unit || 'Unit'}</td>
                        <td className="p-2">{v.max_discount}%</td>
                        <td className="p-2">
                          <button type="button" onClick={() => removeVariant(i, v)} className="text-red-600 hover:text-red-800">Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <button type="submit" disabled={loading} className="w-full bg-brand-green text-white py-2 rounded font-semibold hover:bg-green-700 transition-colors">
            {loading ? 'Saving...' : (isEditing ? 'Update Product' : 'Save Product')}
          </button>
        </form>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Inventory List</h2>
            <p className="text-xs text-gray-500">{products.length} products total</p>
          </div>
          <input
            type="text"
            placeholder="Search products, category, SKU..."
            className="w-full sm:w-64 p-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-green outline-none"
            value={inventorySearch}
            onChange={(e) => setInventorySearch(e.target.value)}
          />
        </div>

        {/* Mobile Product Cards (hidden on md and up) */}
        <div className="block md:hidden space-y-3">
          {products
            .filter(p => {
              const q = inventorySearch.toLowerCase();
              return !q || p.name.toLowerCase().includes(q) ||
                (p.category && p.category.toLowerCase().includes(q)) ||
                (p.variants && p.variants.some(v => v.sku && v.sku.toLowerCase().includes(q)));
            })
            .map((product) => (
              <div key={product.id} className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-2.5">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{product.name}</h3>
                    <span className="inline-block bg-white text-gray-600 px-2 py-0.5 rounded text-xs border mt-0.5">
                      {product.category}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(product)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 font-bold rounded-lg text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="px-3 py-1.5 bg-red-50 text-red-600 font-bold rounded-lg text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Variants inside mobile card */}
                <div className="space-y-1.5 pt-1">
                  {product.variants && product.variants.map((v, index) => (
                    <div key={index} className="bg-white p-2.5 rounded-lg border flex items-center justify-between text-xs">
                      <div className="min-w-0">
                        <span className="font-bold text-gray-800">{v.name}</span>
                        {v.sku && <span className="text-gray-400 ml-1">({v.sku})</span>}
                        <div className="text-gray-600 font-medium">Rs. {v.selling_price} / {v.measure_unit || 'Unit'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${v.stock < 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-800'}`}>
                          Qty: {v.stock}
                        </span>
                        <button
                          onClick={() => handleRestock(product, index)}
                          className="bg-brand-green text-white font-bold px-2 py-1 rounded text-xs active:bg-green-700"
                        >
                          + Restock
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>

        {/* Desktop Table (hidden on mobile, visible on md and up) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-6 py-3 text-left">Product</th>
                <th className="px-6 py-3 text-left">Category</th>
                <th className="px-6 py-3 text-left">Variants & Stock</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-sm">
              {products
                .filter(p => {
                  const q = inventorySearch.toLowerCase();
                  return !q || p.name.toLowerCase().includes(q) ||
                    (p.category && p.category.toLowerCase().includes(q)) ||
                    (p.variants && p.variants.some(v => v.sku && v.sku.toLowerCase().includes(q)));
                })
                .map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{product.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">{product.category}</td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {product.variants && product.variants.map((v, index) => (
                          <div key={index} className="text-xs flex justify-between items-center bg-gray-50 p-1.5 rounded">
                            <span>
                              <span className="font-semibold text-gray-800">{v.name}</span>
                              <span className="text-gray-400 ml-1 font-mono">({v.sku})</span>
                            </span>
                            <span className="mx-2 font-medium">Rs. {v.selling_price}</span>
                            <span className={`font-bold ${v.stock < 5 ? 'text-red-600' : 'text-green-600'}`}>
                              Qty: {v.stock}
                            </span>
                            <button onClick={() => handleRestock(product, index)} className="text-xs text-blue-600 hover:underline font-semibold ml-2">
                              Restock
                            </button>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button onClick={() => handleEdit(product)} className="text-indigo-600 hover:text-indigo-900 font-bold">Edit</button>
                      <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-900 font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
