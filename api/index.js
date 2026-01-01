const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { db } = require('./database');

const app = express();
// const PORT = 3001; // Removed for Vercel

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

      // Prepare statements
      const stmtItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale, cost_at_sale) VALUES (?, ?, ?, ?, ?)');
      const stmtUpdateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
      const stmtGetCost = db.prepare('SELECT cost_price FROM products WHERE id = ?');

      // We need to process items sequentially to handle async cost lookup if we were in pure Node,
      // but inside db.serialize/prepare/run in sqlite3, we can chain them.
      // HOWEVER, retrieving data (SELECT) to use in INSERT within the same transaction requires care in sqlite3 node driver.
      // A simpler approach for this prototype: Fetch costs first OR use a subquery in INSERT.
      // Subquery approach: INSERT INTO sale_items ... SELECT ?, ?, ?, ?, cost_price FROM products WHERE id = ?

      let pending = items.length;
      let failed = false;

      items.forEach(item => {
        if (failed) return;

        // Subquery approach is cleaner: Insert directly using the product's current cost_price
        db.run(
          'INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale, cost_at_sale) SELECT ?, ?, ?, ?, cost_price FROM products WHERE id = ?',
          [saleId, item.productId, item.quantity, item.price, item.productId],
          (err) => {
            if (err) {
              failed = true;
              console.error("Error inserting item:", err);
            }

            // Update stock
            stmtUpdateStock.run(item.quantity, item.productId, (err) => {
               if (err) failed = true;

               pending--;
               if (pending === 0) {
                 if (failed) {
                   db.run('ROLLBACK');
                   res.status(500).json({ error: 'Transaction failed' });
                 } else {
                   db.run('COMMIT', (err) => {
                     if (err) return res.status(500).json({ error: err.message });
                     res.json({ message: 'Sale completed', saleId });
                   });
                 }
               }
            });
          }
        );
      });

      stmtUpdateStock.finalize();
      stmtSale.finalize();
      // stmtItem is not used directly due to subquery run
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

// Expenses API
app.get('/api/expenses', (req, res) => {
  db.all('SELECT * FROM expenses ORDER BY expense_date DESC', [], (err, rows) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ data: rows });
  });
});

app.post('/api/expenses', (req, res) => {
  const { description, category, amount } = req.body;
  const sql = 'INSERT INTO expenses (description, category, amount) VALUES (?,?,?)';
  db.run(sql, [description, category, amount], function(err) {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'success', id: this.lastID });
  });
});

// Drawings API
app.get('/api/drawings', (req, res) => {
  db.all('SELECT * FROM drawings ORDER BY drawing_date DESC', [], (err, rows) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ data: rows });
  });
});

app.post('/api/drawings', (req, res) => {
  const { description, amount } = req.body;
  const sql = 'INSERT INTO drawings (description, amount) VALUES (?,?)';
  db.run(sql, [description, amount], function(err) {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'success', id: this.lastID });
  });
});

// P&L Report API
app.get('/api/pnl', (req, res) => {
  const { startDate, endDate } = req.query;
  const params = [];
  let dateFilterSales = '';
  let dateFilterExpenses = '';
  let dateFilterDrawings = '';

  if (startDate && endDate) {
    dateFilterSales = ' WHERE sale_date BETWEEN ? AND ?';
    dateFilterExpenses = ' WHERE expense_date BETWEEN ? AND ?';
    dateFilterDrawings = ' WHERE drawing_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  // We need to run parallel queries. Promise.all is best here.
  // Helper to promisify db.get
  const getAsync = (sql, params) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });

  const p1 = getAsync(`
    SELECT
      SUM(sale_items.price_at_sale * sale_items.quantity) as revenue,
      SUM(COALESCE(sale_items.cost_at_sale, 0) * sale_items.quantity) as cogs
    FROM sale_items
    JOIN sales ON sales.id = sale_items.sale_id
    ${dateFilterSales}
  `, startDate && endDate ? [startDate, endDate] : []);

  const p2 = getAsync(`SELECT SUM(amount) as total_expenses FROM expenses ${dateFilterExpenses}`, startDate && endDate ? [startDate, endDate] : []);
  const p3 = getAsync(`SELECT SUM(amount) as total_drawings FROM drawings ${dateFilterDrawings}`, startDate && endDate ? [startDate, endDate] : []);

  Promise.all([p1, p2, p3]).then(([salesData, expenseData, drawingData]) => {
    const revenue = salesData?.revenue || 0;
    const cogs = salesData?.cogs || 0;
    const grossProfit = revenue - cogs;
    const totalExpenses = expenseData?.total_expenses || 0;
    const netProfit = grossProfit - totalExpenses;
    const totalDrawings = drawingData?.total_drawings || 0;

    res.json({
      revenue,
      cogs,
      grossProfit,
      totalExpenses,
      netProfit,
      totalDrawings
    });
  }).catch(err => {
    res.status(500).json({ error: err.message });
  });
});

// Export for Vercel
module.exports = app;
