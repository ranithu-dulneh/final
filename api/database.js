const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Vercel only allows writing to /tmp
const dbPath = process.env.VERCEL ? '/tmp/pos.db' : path.resolve(__dirname, 'pos.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database ' + dbPath + ': ' + err.message);
  } else {
    console.log('Connected to the SQLite database at ' + dbPath);
    // Always attempt to initialize tables on connection
    // SQLite's "IF NOT EXISTS" makes this safe to run every time
    initDb();
  }
});

const initDb = () => {
  db.serialize(() => {
    // Products Table
    db.run(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      sku TEXT UNIQUE,
      cost_price REAL,
      selling_price REAL,
      stock INTEGER DEFAULT 0
    )`);

    // Sales Table
    db.run(`CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_amount REAL,
      sale_date TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // Sale Items Table
    db.run(`CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      product_id INTEGER,
      quantity INTEGER,
      price_at_sale REAL,
      cost_at_sale REAL,
      FOREIGN KEY(sale_id) REFERENCES sales(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    )`);

    // Expenses Table
    db.run(`CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT,
      category TEXT,
      amount REAL,
      expense_date TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // Drawings Table
    db.run(`CREATE TABLE IF NOT EXISTS drawings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT,
      amount REAL,
      drawing_date TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log('Database tables initialized (if they did not exist).');
  });
};

module.exports = { db, initDb };
