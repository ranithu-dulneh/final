const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Vercel only allows writing to /tmp
const dbPath = process.env.VERCEL ? '/tmp/pos.db' : path.resolve(__dirname, 'pos.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database ' + dbPath + ': ' + err.message);
  } else {
    console.log('Connected to the SQLite database at ' + dbPath);
    initDb();
  }
});

const initDb = () => {
  db.serialize(() => {
    // Products Table (Parent)
    db.run(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT
    )`);

    // Variants Table (Child)
    db.run(`CREATE TABLE IF NOT EXISTS variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      variant_name TEXT NOT NULL,
      sku TEXT UNIQUE,
      cost_price REAL,
      selling_price REAL,
      stock_quantity INTEGER DEFAULT 0,
      max_discount REAL DEFAULT 0,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
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
      variant_id INTEGER,
      quantity INTEGER,
      price_at_sale REAL,
      cost_at_sale REAL,
      discount_amount REAL DEFAULT 0,
      FOREIGN KEY(sale_id) REFERENCES sales(id),
      FOREIGN KEY(variant_id) REFERENCES variants(id)
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

    // Categories Table
    db.run(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )`, (err) => {
       if (!err) {
         // Seed default categories if they don't exist
         const defaults = ['Fertilizer', 'Seeds', 'Chemicals', 'Pet Accessories', 'Other Accessories'];
         const stmt = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
         defaults.forEach(c => stmt.run(c));
         stmt.finalize();
       }
    });

    console.log('Database tables initialized.');
  });
};

module.exports = { db, initDb };
