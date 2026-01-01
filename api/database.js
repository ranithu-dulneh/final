const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Vercel only allows writing to /tmp
const dbPath = process.env.VERCEL ? '/tmp/pos.db' : path.resolve(__dirname, 'pos.db');

// In Vercel, we need to initialize the DB if it doesn't exist in /tmp
const needsInit = process.env.VERCEL && !fs.existsSync(dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database ' + dbPath + ': ' + err.message);
  } else {
    console.log('Connected to the SQLite database at ' + dbPath);
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
      FOREIGN KEY(sale_id) REFERENCES sales(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    )`);

    console.log('Database tables initialized.');
  });
};

// Initialize if it's the first run in this container or local
if (require.main === module || needsInit) {
  initDb();
}

module.exports = { db, initDb };
