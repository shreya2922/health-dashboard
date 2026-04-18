const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error("Error opening database " + err.message);
    } else {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT
        )`, (err) => {
            if (!err) {
                // Insert default admin admin123 -> changed to admin/1234
                bcrypt.hash('1234', 10, (err, hash) => {
                    if (err) return;
                    db.run('INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)', ['admin', hash]);
                });
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS health_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            spo2 INTEGER,
            heart_rate INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

module.exports = db;
