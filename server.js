const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
// Replace with your actual MongoDB URI in .env or use local
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/live-chat';
mongoose.connect(mongoURI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Schemas
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'Member' },
    lastSeen: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
    user: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

// --- AUTH ROUTES ---

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        // Basic check for first user to be Developer/Owner
        const userCount = await User.countDocuments();
        const role = userCount === 0 ? 'Developer' : 'Member';

        const newUser = new User({ username, email, password, role });
        await newUser.save();
        
        res.json({ success: true, user: { username, role } });
    } catch (err) {
        res.status(400).json({ success: false, message: "Username or Email already exists" });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const user = await User.findOne({ 
            $or: [{ username: identifier }, { email: identifier }],
            password: password 
        });

        if (user) {
            user.lastSeen = new Date();
            await user.save();
            res.json({ success: true, user: { username: user.username, role: user.role } });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// --- CHAT ROUTES ---

app.get('/api/messages', async (req, res) => {
    try {
        const messages = await Message.find().sort({ timestamp: 1 }).limit(50);
        res.json(messages);
    } catch (err) {
        res.status(500).send(err);
    }
});

app.post('/api/messages', async (req, res) => {
    try {
        const newMessage = new Message(req.body);
        await newMessage.save();
        res.status(201).json(newMessage);
    } catch (err) {
        res.status(400).send(err);
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}, 'username role lastSeen');
        const now = Date.now();
        const statusUsers = users.map(u => ({
            username: u.username,
            role: u.role,
            isOnline: (now - new Date(u.lastSeen).getTime()) < 30000 // Online if seen in last 30s
        }));
        res.json(statusUsers);
    } catch (err) {
        res.status(500).send(err);
    }
});

app.post('/api/heartbeat', async (req, res) => {
    try {
        const { username } = req.body;
        await User.findOneAndUpdate({ username }, { lastSeen: new Date() });
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err);
    }
});

// --- ADMIN ROUTES ---

app.delete('/api/admin/users/:username', async (req, res) => {
    try {
        const { adminUsername } = req.query;
        const admin = await User.findOne({ username: adminUsername });
        
        if (!admin || admin.role !== 'Developer') {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        await User.findOneAndDelete({ username: req.params.username });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error deleting user" });
    }
});

// Serving the HTML files
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/themes', (req, res) => res.sendFile(path.join(__dirname, 'public/themes.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
