const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs'); // To save user data
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const USERS_FILE = './users.json';

// Create users file if it doesn't exist
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({}));

app.use(express.static('public'));
app.use(express.json());

let onlineUsers = {};

// Handle Signup/Login
app.post('/auth', (req, res) => {
    const { username, password, type } = req.body;
    let users = JSON.parse(fs.readFileSync(USERS_FILE));

    if (type === 'signup') {
        if (users[username]) return res.json({ success: false, message: "User exists" });
        users[username] = { password };
        fs.writeFileSync(USERS_FILE, JSON.stringify(users));
        return res.json({ success: true });
    } else {
        if (users[username] && users[username].password === password) {
            return res.json({ success: true });
        }
        res.json({ success: false, message: "Invalid login" });
    }
});

io.on('connection', (socket) => {
    socket.on('login', (username) => {
        socket.username = username;
        onlineUsers[socket.id] = username;
        io.emit('update-users', Object.values(onlineUsers));
    });

    socket.on('chat-message', (msg) => {
        io.emit('chat-message', { user: socket.username, text: msg });
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('update-users', Object.values(onlineUsers));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Running on ${PORT}`));
