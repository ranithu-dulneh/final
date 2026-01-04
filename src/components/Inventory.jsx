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

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
           <h2 className="text-xl font-semibold">Inventory List</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variants</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{product.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">{product.category}</td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {product.variants && product.variants.map((v, index) => (
                        <div key={index} className="text-sm flex justify-between items-center bg-gray-50 p-1 rounded">
                          <span>
                            <span className="font-semibold">{v.name}</span>
                            <span className="text-gray-500 ml-2">({v.sku})</span>
                          </span>
                          <span className="mx-2">Rs. {v.selling_price}</span>
                          <span className={`${v.stock < 5 ? 'text-red-600 font-bold' : 'text-green-600'}`}>Qty: {v.stock}</span>
                          <button onClick={() => handleRestock(product, index)} className="text-xs text-blue-600 hover:underline ml-2">Restock</button>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button onClick={() => handleEdit(product)} className="text-indigo-600 hover:text-indigo-900 font-bold">Edit</button>
                    <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-900">Delete</button>
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
