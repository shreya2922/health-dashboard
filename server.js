const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database.js');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = "health_dashboard_secret_key"; // In production, move this to .env

app.use(cors());
app.use(express.json());

// Login Endpoint
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            db.run('INSERT INTO login_history (username, status, ip_address) VALUES (?, ?, ?)', [username || 'unknown', 'failed - db error', ipAddress]);
            return res.status(500).json({ error: "Database error" });
        }
        if (!row) {
            db.run('INSERT INTO login_history (username, status, ip_address) VALUES (?, ?, ?)', [username || 'unknown', 'failed - invalid user', ipAddress]);
            return res.status(401).json({ error: "Invalid username or password" });
        }

        bcrypt.compare(password, row.password, (err, result) => {
            if (result) {
                db.run('INSERT INTO login_history (username, status, ip_address) VALUES (?, ?, ?)', [username, 'success', ipAddress]);
                const token = jwt.sign({ id: row.id, username: row.username }, SECRET_KEY, { expiresIn: '2h' });
                res.json({ token, message: "Logged in successfully" });
            } else {
                db.run('INSERT INTO login_history (username, status, ip_address) VALUES (?, ?, ?)', [username, 'failed - invalid password', ipAddress]);
                res.status(401).json({ error: "Invalid username or password" });
            }
        });
    });
});

// Middleware for auth
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Get Login History Endpoint
app.get('/api/auth/history', authenticateToken, (req, res) => {
    db.all('SELECT * FROM login_history ORDER BY timestamp DESC LIMIT 50', [], (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

// Get Dashboard Data Endpoint
app.get('/api/health/data', authenticateToken, (req, res) => {
    // Return latest 15 records
    db.all('SELECT * FROM health_data ORDER BY timestamp DESC LIMIT 15', [], (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        // Reverse to maintain chronological order in charts (oldest out of the 15 first)
        res.json(rows.reverse());
    });
});

// Endpoint for IoT simulator/sensors to post real data
app.post('/api/health/data', (req, res) => {
    const { spo2, heart_rate } = req.body;
    if (!spo2 || !heart_rate) return res.status(400).json({ error: "Missing parameters" });

    db.run('INSERT INTO health_data (spo2, heart_rate) VALUES (?, ?)', [spo2, heart_rate], function(err) {
        if (err) return res.status(500).json({ error: "Database error" });
        res.status(201).json({ id: this.lastID, message: "Data logged successfully" });
    });
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    
    // Simulate real-time IoT pushing data to the API every 5 seconds
    // This allows the database to stay populated even without real hardware
    setInterval(() => {
        const spo2 = Math.floor(Math.random() * (100 - 90 + 1)) + 90;
        const heart_rate = Math.floor(Math.random() * (110 - 60 + 1)) + 60;
        db.run('INSERT INTO health_data (spo2, heart_rate) VALUES (?, ?)', [spo2, heart_rate]);
    }, 5000);
});
