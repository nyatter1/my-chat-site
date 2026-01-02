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
    email: { type: String, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'Member' },
    lastSeen: { type: Date, default: Date.now },
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
        // Logic to assign Developer role to Hayden automatically
        const role = username === "Hayden" ? "Developer" : "Member";
        
        const user = new User({ 
            username, 
            email, 
            password, 
            role,
            lastSeen: new Date()
        });
        await user.save();
        
        res.status(201).json({ success: true, user: { username, role } });
    } catch (error) {
        res.status(400).json({ success: false, message: "Username or Email already exists" });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        // Check for username OR email matches and then verify password
        const user = await User.findOne({ 
            $or: [{ username: identifier }, { email: identifier }]
        });

        if (user && user.password === password) {
            user.lastSeen = new Date();
            await user.save();
            res.json({ success: true, user: { username: user.username, role: user.role } });
        } else {
            res.status(401).json({ success: false, message: "Invalid username or password" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error during login" });
    }
});

/**
 * ADMIN API: DELETE USER
 * Only allows a user with the 'Developer' role to delete an account.
 */
app.delete('/api/admin/users/:username', async (req, res) => {
    try {
        const { adminUsername } = req.query; // Sender of the request
        const targetUsername = req.params.username;

        // Verify the requester is a Developer
        const admin = await User.findOne({ username: adminUsername });
        if (!admin || admin.role !== 'Developer') {
            return res.status(403).json({ success: false, message: "Unauthorized: Developer role required" });
        }

        // Prevent developers from deleting themselves via this specific UI action if desired,
        // but here we allow it or you can add: if(adminUsername === targetUsername) ...

        // Delete the user
        await User.deleteOne({ username: targetUsername });
        
        // Optional: Delete all messages sent by this user
        await Message.deleteMany({ user: targetUsername });

        res.json({ success: true, message: `Account ${targetUsername} deleted successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error during deletion" });
    }
});

/**
 * HEARTBEAT API
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
        // Update user activity whenever they send a message
        await User.updateOne({ username: user }, { lastSeen: new Date() });
        res.json(newMessage);
    } catch (err) {
        res.status(500).json({ error: "Failed to broadcast message" });
    }
});

/**
 * USER DIRECTORY API
 * Shows online/offline status based on lastSeen activity
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
 * Serves the login page if the user is not authenticated 
 * (Handled primarily by client-side logic, but we provide the file)
 */
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * SERVER START
 */
app.listen(PORT, () => {
    console.log(`Chat Server active on port ${PORT}`);
});
