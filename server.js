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
 */
app.use(express.static(path.join(__dirname, 'public')));

/**
 * DATABASE CONNECTION
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
    lastSeen: { type: Date, default: Date.now }, // Track activity
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
 * AUTHENTICATION API
 */
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const role = username === "Hayden" ? "Developer" : "Member";
        
        const user = new User({ 
            username, 
            email: email || `${username}@chat.local`, 
            password: password || 'default_pass', 
            role,
            lastSeen: new Date()
        });
        await user.save();
        
        res.status(201).json({ success: true, user: { username, role } });
    } catch (error) {
        res.status(400).json({ success: false, message: "Username already taken" });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier } = req.body;
        const user = await User.findOneAndUpdate(
            { $or: [{ username: identifier }, { email: identifier }] },
            { lastSeen: new Date() }, // Update activity on login
            { new: true }
        );

        if (user) {
            res.json({ success: true, user: { username: user.username, role: user.role } });
        } else {
            res.status(401).json({ success: false, message: "User not found" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/**
 * HEARTBEAT API
 * Updates the user's lastSeen timestamp to keep them "Online"
 */
app.post('/api/heartbeat', async (req, res) => {
    try {
        const { username } = req.body;
        await User.updateOne({ username }, { lastSeen: new Date() });
        res.sendStatus(200);
    } catch (err) {
        res.sendStatus(500);
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
        // Also update activity when sending a message
        await User.updateOne({ username: user }, { lastSeen: new Date() });
        res.json(newMessage);
    } catch (err) {
        res.status(500).json({ error: "Failed to broadcast message" });
    }
});

/**
 * USER DIRECTORY API
 * Calculates isOnline based on lastSeen (within last 30 seconds)
 */
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}, 'username role lastSeen');
        const now = new Date();
        const thirtySecondsAgo = new Date(now.getTime() - 30000);

        const processedUsers = users.map(u => ({
            username: u.username,
            role: u.role,
            isOnline: u.lastSeen > thirtySecondsAgo
        }));

        res.json(processedUsers);
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
    console.log(`Chat Server active on port ${PORT}`);
});
