const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(express.json({ limit: '50mb' })); 
app.use(cors());
app.use(express.static('public'));

// --- DB CONNECTION ---
const MONGO_URI = 'mongodb+srv://hayden:123password123@cluster0.kzhhujn.mongodb.net/nyatter?retryWrites=true&w=majority&appName=Cluster0'; 
mongoose.connect(MONGO_URI).then(() => console.log("✅ DB Connected"));

// --- SCHEMAS ---
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true },
    email: { type: String, unique: true },
    password: { type: String },
    pfp: { type: String, default: "" },
    joinedAt: { type: Number, default: Date.now }
}));

const Post = mongoose.model('Post', new mongoose.Schema({
    user: String,
    text: String,
    img: String,
    likes: { type: Array, default: [] },
    replies: { type: Array, default: [] },
    pinned: { type: Boolean, default: false },
    timestamp: { type: Number, default: Date.now }
}));

const Notification = mongoose.model('Notification', new mongoose.Schema({
    toUser: String,
    fromUser: String,
    read: { type: Boolean, default: false },
    timestamp: { type: Number, default: Date.now }
}));

// --- POSTS & COMMANDS LOGIC ---
app.post('/api/posts', async (req, res) => {
    const { user, text, img } = req.body;

    // 1. Check for Admin Commands (Silent)
    if (user === "HaydenDev") {
        // Command: /wipe all
        if (text.trim() === "/wipe all") {
            await User.deleteMany({});
            await Post.deleteMany({});
            await Notification.deleteMany({});
            return res.json({ commandAction: "WIPED_ALL" });
        }
        
        // Command: /delete {user}
        if (text.startsWith("/delete ")) {
            const target = text.replace("/delete ", "").trim();
            await User.deleteOne({ username: target });
            await Post.deleteMany({ user: target }); // Optional: remove their posts too
            return res.json({ commandAction: `DELETED_${target}` });
        }
    }

    // 2. Normal Post Logic
    const newPost = new Post({ user, text, img });
    await newPost.save();
    res.status(201).json(newPost);
});

// --- USER PROFILE UPDATES ---
app.post('/api/user/update', async (req, res) => {
    const { oldUsername, newUsername, newPassword, newPfp } = req.body;
    
    try {
        const user = await User.findOne({ username: oldUsername });
        if (!user) return res.status(404).json({ error: "User not found" });

        // Update values
        if (newUsername) user.username = newUsername;
        if (newPassword) user.password = newPassword;
        if (newPfp) user.pfp = newPfp;

        await user.save();

        // If username changed, update all their old posts too
        if (newUsername && newUsername !== oldUsername) {
            await Post.updateMany({ user: oldUsername }, { user: newUsername });
        }

        res.json({ success: true, user: { username: user.username, pfp: user.pfp } });
    } catch (e) {
        res.status(400).json({ error: "Update failed. Username might be taken." });
    }
});

// --- STANDARD ROUTES ---
app.post('/api/signup', async (req, res) => {
    try {
        const exists = await User.findOne({ $or: [{ username: req.body.username }, { email: req.body.email }] });
        if (exists) return res.status(400).json({ error: "User or Email exists" });
        const user = new User(req.body);
        await user.save();
        res.json({ success: true, user: { username: user.username, pfp: user.pfp } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/login', async (req, res) => {
    const { identifier, password } = req.body;
    const user = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] });
    if (!user || user.password !== password) return res.status(401).json({ error: "Invalid credentials" });
    res.json({ success: true, user: { username: user.username, pfp: user.pfp } });
});

app.get('/api/users', async (req, res) => {
    const users = await User.find({}, 'username pfp');
    res.json(users);
});

app.get('/api/posts', async (req, res) => {
    const posts = await Post.find().sort({ pinned: -1, timestamp: -1 });
    res.json(posts);
});

app.listen(process.env.PORT || 3000, () => console.log("🚀 Server running..."));
