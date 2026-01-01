import React, { useState, useEffect } from 'react';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({
    name: '', category: '', sku: '', cost_price: '', selling_price: '', stock: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchProducts = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/products');
      const data = await res.json();
      if (data.data) setProducts(data.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('http://localhost:3001/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setMessage('Product added successfully!');
        setFormData({ name: '', category: '', sku: '', cost_price: '', selling_price: '', stock: '' });
        fetchProducts();
      } else {
        setMessage('Error adding product');
      }
    } catch (error) {
      setMessage('Error connecting to server');
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await fetch(`http://localhost:3001/api/products/${id}`, { method: 'DELETE' });
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product', error);
    }
  };

  const handleRestock = async (id) => {
    const quantity = prompt('Enter quantity to add:');
    if (!quantity || isNaN(quantity)) return;
    try {
      await fetch(`http://localhost:3001/api/products/${id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: parseInt(quantity) })
      });
      fetchProducts();
    } catch (error) {
      console.error('Error restocking', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Add New Product</h2>
        {message && <div className="mb-4 p-2 bg-blue-100 text-blue-700 rounded">{message}</div>}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <input name="name" placeholder="Product Name" value={formData.name} onChange={handleChange} className="p-2 border rounded" required />
          <input name="category" placeholder="Category" value={formData.category} onChange={handleChange} className="p-2 border rounded" />
          <input name="sku" placeholder="SKU/Barcode" value={formData.sku} onChange={handleChange} className="p-2 border rounded" required />
          <input name="cost_price" type="number" placeholder="Cost Price" value={formData.cost_price} onChange={handleChange} className="p-2 border rounded" required />
          <input name="selling_price" type="number" placeholder="Selling Price" value={formData.selling_price} onChange={handleChange} className="p-2 border rounded" required />
          <input name="stock" type="number" placeholder="Initial Stock" value={formData.stock} onChange={handleChange} className="p-2 border rounded" required />
          <button type="submit" disabled={loading} className="md:col-span-3 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
            {loading ? 'Saving...' : 'Add Product'}
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Product List</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{product.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.sku}</td>
                  <td className="px-6 py-4 whitespace-nowrap">${product.selling_price}</td>
                  <td className={`px-6 py-4 whitespace-nowrap font-bold ${product.stock < 5 ? 'text-red-600' : 'text-green-600'}`}>
                    {product.stock}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button onClick={() => handleRestock(product.id)} className="text-indigo-600 hover:text-indigo-900">Restock</button>
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
