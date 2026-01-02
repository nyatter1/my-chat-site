const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * MIDDLEWARE CONFIGURATION
 */
app.use(cors());
app.use(express.json());

/**
 * STATIC ASSETS
 * Serves the frontend from the /public directory.
 */
app.use(express.static(path.join(__dirname, 'public')));

/**
 * DATABASE CONNECTION
 * Using the provided MONGODB_URI for the vikvok_live cluster.
 */
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://hayden:123password123@cluster0.57lnswh.mongodb.net/vikvok_live?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI)
    .then(() => console.log('Successfully connected to MongoDB Atlas (vikvok_live)'))
    .catch(err => console.error('CRITICAL: MongoDB connection error:', err));

/**
 * DATA MODELS
 */
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    email: { type: String },
    password: { type: String, required: true },
    role: { type: String, default: 'Member' },
    createdAt: { type: Date, default: Date.now }
});

const MessageSchema = new mongoose.Schema({
    user: String,
    text: String,
    time: String,
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

/**
 * SIMPLIFIED AUTHENTICATION API
 * Handles the "Enter Username" logic from the frontend.
 */
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        // Automatic Developer role for Hayden
        const role = username === "Hayden" ? "Developer" : "Member";
        
        const user = new User({ 
            username, 
            email: email || `${username}@chat.local`, 
            password: password || 'default_pass', 
            role 
        });
        await user.save();
        
        res.status(201).json({ success: true, user: { username, role } });
    } catch (error) {
        res.status(400).json({ success: false, message: "Username already taken" });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const user = await User.findOne({ 
            $or: [{ username: identifier }, { email: identifier }]
        });

        if (user) {
            // In this simplified version, we skip strict password checking to allow quick entry
            res.json({ success: true, user: { username: user.username, role: user.role } });
        } else {
            res.status(401).json({ success: false, message: "User not found" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/**
 * CHAT API
 */
app.get('/api/messages', async (req, res) => {
    try {
        const messages = await Message.find().sort({ timestamp: 1 }).limit(100);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: "Could not retrieve messages" });
    }
});

app.post('/api/messages', async (req, res) => {
    try {
        const { user, text, time } = req.body;
        const newMessage = new Message({ user, text, time });
        await newMessage.save();
        res.json(newMessage);
    } catch (err) {
        res.status(500).json({ error: "Failed to broadcast message" });
    }
});

/**
 * USER DIRECTORY API
 */
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}, 'username role');
        res.json(users);
    } catch (err) {
        res.status(500).json([]);
    }
});

/**
 * SPA ROUTING
 */
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * SERVER START
 */
app.listen(PORT, () => {
    console.log(`Chat Server is active on port ${PORT}`);
});
