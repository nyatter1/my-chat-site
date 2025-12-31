const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

// Increase limits for Base64 Profile Pictures
app.use(express.json({ limit: '50mb' })); 
app.use(cors());
app.use(express.static('public'));

// --- DATABASE CONNECTION ---
const MONGO_URI = 'mongodb+srv://hayden:123password123@cluster0.kzhhujn.mongodb.net/nyatter?retryWrites=true&w=majority&appName=Cluster0'; 

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Nyatter Database Connected"))
    .catch(err => console.error("❌ Connection Error:", err));

// --- MODELS ---
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    pfp: { type: String, default: "" },
    joinedAt: { type: Number, default: Date.now }
}));

const Post = mongoose.model('Post', new mongoose.Schema({
    user: String,
    text: String,
    img: { type: String, default: "" },
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

// --- TAG LOGIC ---
const processTags = async (text, fromUser) => {
    const tags = text.match(/@(\w+)/g);
    if (!tags) return;
    
    const uniqueTags = [...new Set(tags.map(t => t.replace('@', '')))];
    for (let targetUser of uniqueTags) {
        if (targetUser !== fromUser) {
            await new Notification({ toUser: targetUser, fromUser }).save();
        }
    }
};

// --- ROUTES ---

// Signup: Checks for existing users before saving
app.post('/api/signup', async (req, res) => {
    try {
        const { username, email, password, pfp } = req.body;
        const exists = await User.findOne({ $or: [{ username }, { email }] });
        if (exists) return res.status(400).json({ error: "Username or Email already in use." });

        const user = new User({ username, email, password, pfp });
        await user.save();
        res.json({ success: true, user: { username, pfp } });
    } catch (e) { res.status(500).json({ error: "Signup Failed" }); }
});

// Login
app.post('/api/login', async (req, res) => {
    const { identifier, password } = req.body;
    const user = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] });
    if (!user || user.password !== password) return res.status(401).json({ error: "Invalid Credentials" });
    res.json({ success: true, user: { username: user.username, pfp: user.pfp } });
});

// Get Users (for PFP mapping)
app.get('/api/users', async (req, res) => {
    const users = await User.find({}, 'username pfp');
    res.json(users);
});

// Post Feed
app.get('/api/posts', async (req, res) => {
    const posts = await Post.find().sort({ pinned: -1, timestamp: -1 }).limit(50);
    res.json(posts);
});

// Create Post
app.post('/api/posts', async (req, res) => {
    try {
        const post = new Post(req.body);
        await post.save();
        if (req.body.text) await processTags(req.body.text, req.body.user);
        res.status(201).json(post);
    } catch (e) { res.status(500).json({ error: "Post Failed" }); }
});

// Reply
app.post('/api/posts/reply', async (req, res) => {
    const { id, user, text } = req.body;
    const post = await Post.findById(id);
    if (post) {
        post.replies.push({ user, text, timestamp: Date.now() });
        await post.save();
        await processTags(text, user);
        res.json(post);
    } else { res.status(404).json({ error: "Post not found" }); }
});

// Notifications
app.get('/api/notifications/:user', async (req, res) => {
    const notifs = await Notification.find({ toUser: req.params.user, read: false });
    res.json(notifs);
});

app.post('/api/notifications/clear', async (req, res) => {
    await Notification.findByIdAndDelete(req.body.id);
    res.json({ success: true });
});

// Admin/Owner Actions
app.post('/api/posts/delete', async (req, res) => {
    const { id, user } = req.body;
    const post = await Post.findById(id);
    if (post && (post.user === user || user === "HaydenDev")) {
        await Post.findByIdAndDelete(id);
        res.json({ success: true });
    } else { res.status(403).json({ error: "Unauthorized" }); }
});

app.listen(process.env.PORT || 3000, () => console.log("🚀 Server running..."));
