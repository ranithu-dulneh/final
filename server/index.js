const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { db } = require('./database');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// Get all products
app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products', [], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ data: rows });
  });
});

// Add a new product
app.post('/api/products', (req, res) => {
  const { name, category, sku, cost_price, selling_price, stock } = req.body;
  const sql = 'INSERT INTO products (name, category, sku, cost_price, selling_price, stock) VALUES (?,?,?,?,?,?)';
  const params = [name, category, sku, cost_price, selling_price, stock];
  db.run(sql, params, function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({
      message: 'success',
      data: { id: this.lastID, ...req.body }
    });
  });
});

// Delete a product
app.delete('/api/products/:id', (req, res) => {
  db.run('DELETE FROM products WHERE id = ?', req.params.id, function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ message: 'deleted', changes: this.changes });
  });
});

// Update stock (Restock)
app.patch('/api/products/:id/stock', (req, res) => {
  const { quantity } = req.body; // quantity to add
  db.run('UPDATE products SET stock = stock + ? WHERE id = ?', [quantity, req.params.id], function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ message: 'updated', changes: this.changes });
  });
});

// Process a Sale
app.post('/api/sales', (req, res) => {
  const { items } = req.body; // items: [{ productId, quantity, price }]

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No items in sale' });
  }

  // Calculate total
  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  // Start transaction (serialized)
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    const stmtSale = db.prepare('INSERT INTO sales (total_amount) VALUES (?)');
    stmtSale.run(totalAmount, function(err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      const saleId = this.lastID;

      const stmtItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale) VALUES (?, ?, ?, ?)');
      const stmtUpdateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

      items.forEach(item => {
        stmtItem.run(saleId, item.productId, item.quantity, item.price);
        stmtUpdateStock.run(item.quantity, item.productId);
      });

      stmtItem.finalize();
      stmtUpdateStock.finalize();
      stmtSale.finalize();

      db.run('COMMIT', (err) => {
        if (err) {
           return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Sale completed', saleId });
      });
    });
  });
});

// Get Sales Report
app.get('/api/reports', (req, res) => {
  const { startDate, endDate } = req.query; // Optional filters

  let sql = `
    SELECT
      sales.id,
      sales.total_amount,
      sales.sale_date,
      json_group_array(json_object('name', products.name, 'quantity', sale_items.quantity, 'price', sale_items.price_at_sale)) as items
    FROM sales
    JOIN sale_items ON sales.id = sale_items.sale_id
    JOIN products ON sale_items.product_id = products.id
  `;

  const params = [];
  if (startDate && endDate) {
    sql += ' WHERE sales.sale_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  sql += ' GROUP BY sales.id ORDER BY sales.sale_date DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    // Parse the JSON string from json_group_array
    const formattedRows = rows.map(row => ({
        ...row,
        items: JSON.parse(row.items)
    }));
    res.json({ data: formattedRows });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
