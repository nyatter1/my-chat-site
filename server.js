const express = require('express');
const path = require('path');
const app = express();

// Use the port provided by the environment (e.g., Render) or default to 3000
const PORT = process.env.PORT || 3000;

/**
 * Middleware
 */
app.use(express.json());
// Serve static files (HTML, CSS, JS) from the root directory
app.use(express.static(path.join(__dirname)));

/**
 * API Routes (Foundations for Bongdoo-style logic)
 */
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'online', system: 'Phantom Tunnel Active' });
});

/**
 * Frontend Routing
 * This ensures that if you refresh the page on a specific route, 
 * it always serves the index.html so the client-side logic can take over.
 */
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

/**
 * Start Server
 */
app.listen(PORT, () => {
    console.log(`
    -------------------------------------------
    PHANTOM MESSENGER LIVE
    Tunneling on port: ${PORT}
    Mode: Production/Bongdoo-Ready
    -------------------------------------------
    `);
});
