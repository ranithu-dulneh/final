const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { db } = require('./database');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Get all products (with variants)
app.get('/api/products', (req, res) => {
  const sql = `
    SELECT
      p.id as p_id, p.name as p_name, p.category,
      v.id as v_id, v.variant_name, v.sku, v.cost_price, v.selling_price, v.stock_quantity, v.max_discount
    FROM products p
    LEFT JOIN variants v ON p.id = v.product_id
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }

    // Group variants by product
    const productsMap = {};
    rows.forEach(row => {
      if (!productsMap[row.p_id]) {
        productsMap[row.p_id] = {
          id: row.p_id,
          name: row.p_name,
          category: row.category,
          variants: []
        };
      }
      if (row.v_id) {
        productsMap[row.p_id].variants.push({
          id: row.v_id,
          name: row.variant_name,
          sku: row.sku,
          cost_price: row.cost_price,
          selling_price: row.selling_price,
          stock: row.stock_quantity,
          max_discount: row.max_discount
        });
      }
    });

    res.json({ data: Object.values(productsMap) });
  });
});

// Add a new product with variants
app.post('/api/products', (req, res) => {
  const { name, category, variants } = req.body;
  // variants: [{ name, sku, cost_price, selling_price, stock, max_discount }]

  if (!variants || variants.length === 0) {
    return res.status(400).json({ error: 'At least one variant is required' });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    db.run('INSERT INTO products (name, category) VALUES (?,?)', [name, category], function(err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(400).json({ error: err.message });
      }
      const productId = this.lastID;

      const stmt = db.prepare('INSERT INTO variants (product_id, variant_name, sku, cost_price, selling_price, stock_quantity, max_discount) VALUES (?,?,?,?,?,?,?)');

      let errorOccurred = false;
      variants.forEach(v => {
        stmt.run(productId, v.name, v.sku, v.cost_price, v.selling_price, v.stock, v.max_discount || 0, (err) => {
          if (err) errorOccurred = true;
        });
      });

      stmt.finalize(() => {
        if (errorOccurred) {
          db.run('ROLLBACK');
          res.status(500).json({ error: 'Failed to save variants' });
        } else {
          db.run('COMMIT');
          res.json({ message: 'success', id: productId });
        }
      });
    });
  });
});

// Update Product and Upsert Variants
app.put('/api/products/:id', (req, res) => {
  const { name, category, variants } = req.body;
  const productId = req.params.id;

  if (!variants || variants.length === 0) {
    return res.status(400).json({ error: 'At least one variant is required' });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Update Product
    db.run('UPDATE products SET name = ?, category = ? WHERE id = ?', [name, category, productId], function(err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(400).json({ error: err.message });
      }

      const stmtInsert = db.prepare('INSERT INTO variants (product_id, variant_name, sku, cost_price, selling_price, stock_quantity, max_discount) VALUES (?,?,?,?,?,?,?)');
      const stmtUpdate = db.prepare('UPDATE variants SET variant_name = ?, sku = ?, cost_price = ?, selling_price = ?, stock_quantity = ?, max_discount = ? WHERE id = ?');

      let errorOccurred = false;
      let processed = 0;

      variants.forEach(v => {
        if (v.id) {
          // Update existing
          stmtUpdate.run(v.name, v.sku, v.cost_price, v.selling_price, v.stock, v.max_discount || 0, v.id, (err) => {
             if (err) errorOccurred = true;
          });
        } else {
          // Insert new
          stmtInsert.run(productId, v.name, v.sku, v.cost_price, v.selling_price, v.stock, v.max_discount || 0, (err) => {
             if (err) errorOccurred = true;
          });
        }
      });

      stmtInsert.finalize();
      stmtUpdate.finalize(() => {
        if (errorOccurred) {
          db.run('ROLLBACK');
          res.status(500).json({ error: 'Failed to save variants' });
        } else {
          db.run('COMMIT');
          res.json({ message: 'success' });
        }
      });
    });
  });
});

// Delete a product (and cascade variants)
app.delete('/api/products/:id', (req, res) => {
  // SQLite Foreign Key cascade should handle variants, but enforce logic here if needed
  db.run('DELETE FROM products WHERE id = ?', req.params.id, function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ message: 'deleted', changes: this.changes });
  });
});

// Delete a single variant
app.delete('/api/variants/:id', (req, res) => {
  db.run('DELETE FROM variants WHERE id = ?', req.params.id, function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ message: 'deleted', changes: this.changes });
  });
});

// Update stock (Restock) - Now targets VARIANT ID
app.patch('/api/variants/:id/stock', (req, res) => {
  const { quantity } = req.body;
  db.run('UPDATE variants SET stock_quantity = stock_quantity + ? WHERE id = ?', [quantity, req.params.id], function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ message: 'updated', changes: this.changes });
  });
});

// Process a Sale
app.post('/api/sales', (req, res) => {
  const { items } = req.body; // items: [{ variantId, quantity, price, discount }]
  // price here is the SOLD price (selling_price - discount_amount_per_unit ideally, or we calc it)
  // Let's assume frontend sends final unit price and we calculate discount?
  // Requirement: "Input Discount".
  // Let's store discount_amount in DB.

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No items in sale' });
  }

  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    const stmtSale = db.prepare('INSERT INTO sales (total_amount) VALUES (?)');
    stmtSale.run(totalAmount, function(err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      const saleId = this.lastID;

      const stmtUpdateStock = db.prepare('UPDATE variants SET stock_quantity = stock_quantity - ? WHERE id = ?');
      let pending = items.length;
      let failed = false;

      items.forEach(item => {
        if (failed) return;

        // Fetch cost from variant to log 'cost_at_sale'
        // And we record the discount (assuming item.discount is % or amount? Requirement says "Discount %").
        // Let's assume item.price is the FINAL price.
        // And we need to calculate discount amount if needed, or just store what user gave.
        // Let's assume frontend sends `discountAmount` (total for unit) or `discountPercent`.
        // Let's stick to `discount_amount` per unit.

        db.run(
          `INSERT INTO sale_items (sale_id, variant_id, quantity, price_at_sale, cost_at_sale, discount_amount)
           SELECT ?, ?, ?, ?, cost_price, ? FROM variants WHERE id = ?`,
          [saleId, item.variantId, item.quantity, item.price, item.discount || 0, item.variantId],
          (err) => {
            if (err) {
              failed = true;
              console.error("Error inserting item:", err);
            }

            stmtUpdateStock.run(item.quantity, item.variantId, (err) => {
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
    });
  });
});

// Get Sales Report
app.get('/api/reports', (req, res) => {
  const { startDate, endDate } = req.query;

  let sql = `
    SELECT
      sales.id,
      sales.total_amount,
      sales.sale_date,
      json_group_array(json_object(
        'variant', variants.variant_name,
        'product', products.name,
        'quantity', sale_items.quantity,
        'price', sale_items.price_at_sale,
        'discount', sale_items.discount_amount
      )) as items
    FROM sales
    JOIN sale_items ON sales.id = sale_items.sale_id
    JOIN variants ON sale_items.variant_id = variants.id
    JOIN products ON variants.product_id = products.id
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
    const formattedRows = rows.map(row => ({
        ...row,
        items: JSON.parse(row.items)
    }));
    res.json({ data: formattedRows });
  });
});

// Expenses & Drawings APIs (No schema change, just keep them)
app.get('/api/expenses', (req, res) => {
  db.all('SELECT * FROM expenses ORDER BY expense_date DESC', [], (err, rows) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ data: rows });
  });
});
app.post('/api/expenses', (req, res) => {
  const { description, category, amount } = req.body;
  db.run('INSERT INTO expenses (description, category, amount) VALUES (?,?,?)', [description, category, amount], function(err) {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'success', id: this.lastID });
  });
});
app.get('/api/drawings', (req, res) => {
  db.all('SELECT * FROM drawings ORDER BY drawing_date DESC', [], (err, rows) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ data: rows });
  });
});
app.post('/api/drawings', (req, res) => {
  const { description, amount } = req.body;
  db.run('INSERT INTO drawings (description, amount) VALUES (?,?)', [description, amount], function(err) {
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

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
