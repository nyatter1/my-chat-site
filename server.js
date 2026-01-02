const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the 'local' folder as requested
// This is where your index.html and profile.png will reside
app.use(express.static(path.join(__dirname, 'local')));

// MongoDB Connection
// Using the provided environment key: MONGODB_URI
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://hayden:123password123@cluster0.57lnswh.mongodb.net/vikvok_live?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// Basic API Route example for the app
app.get('/api/status', (req, res) => {
  res.json({ message: "Server is running", database: "connected" });
});

// Fallback to serve the HTML file for any non-API routes (Single Page App support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'local', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server live at http://localhost:${PORT}`);
});
