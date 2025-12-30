const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('TikSnap DB Connected'))
    .catch(err => console.error('DB Error:', err));

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
    banner: { type: String, default: '#00a8ff' },
    bio: { type: String, default: 'Click to set a bio...' }
});

const MessageSchema = new mongoose.Schema({
    user: String, text: String, pfp: String, timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

app.use(express.static('public'));
app.use(express.json({ limit: '15mb' }));

app.post('/auth', async (req, res) => {
    const { username, password, type } = req.body;
    if (type === 'signup') {
        const existing = await User.findOne({ username });
        if (existing) return res.json({ success: false, message: "Username taken" });
        const user = await User.create({ username, password });
        return res.json({ success: true, user });
    } 
    const user = await User.findOne({ username, password });
    if (user) return res.json({ success: true, user });
    res.json({ success: false, message: "Invalid Login" });
});

app.post('/update-profile', async (req, res) => {
    const { username, field, value } = req.body;
    const user = await User.findOneAndUpdate({ username }, { [field]: value }, { new: true });
    // Broadcast update to all users
    io.emit('user-profile-updated', user);
    res.json({ success: true, user });
});

let onlineUsers = {}; 
io.on('connection', async (socket) => {
    const history = await Message.find().sort({ _id: -1 }).limit(50);
    socket.emit('load-history', history.reverse());

    socket.on('join-chat', (userData) => {
        socket.user = userData;
        onlineUsers[socket.id] = userData;
        io.emit('update-user-list', Object.values(onlineUsers));
    });

    socket.on('chat-message', async (msg) => {
        if (!socket.user) return;
        const newMsg = await Message.create({ user: socket.user.username, text: msg, pfp: socket.user.profilePic });
        io.emit('chat-message', newMsg);
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('update-user-list', Object.values(onlineUsers));
    });
});

server.listen(process.env.PORT || 3000);
