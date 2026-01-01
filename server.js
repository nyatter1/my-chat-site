/**
 * VIKVOK LIVE CONTACTS SERVER
 * Features:
 * - Real-time User Discovery
 * - Unique ID Assignment (Numeric)
 * - Live Contact Validation
 * - Secure Session Management
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// --- LIVE STATE STORAGE ---
// Store active users: Key = Socket ID, Value = User Object
const activeUsers = new Map();
// Mapping for quick lookup: Key = Unique Number, Value = Socket ID
const numberToSocket = new Map();

/**
 * Generate a unique "fake" random number (e.g., 8 digits)
 * In a live environment, this acts as the user's temporary ID
 */
function generateUniqueId() {
    let id;
    do {
        id = Math.floor(10000000 + Math.random() * 90000000).toString();
    } while (numberToSocket.has(id));
    return id;
}

io.on('connection', (socket) => {
    console.log(`[CONN] New node connected: ${socket.id}`);

    // --- USER REGISTRATION ---
    socket.on('register_user', ({ username, email }) => {
        const userNumber = generateUniqueId();
        
        const userData = {
            id: socket.id,
            userNumber: userNumber,
            username: username || 'Ghost_User',
            email: email,
            status: 'online',
            joinedAt: Date.now()
        };

        activeUsers.set(socket.id, userData);
        numberToSocket.set(userNumber, socket.id);

        // Send the user their own live identity
        socket.emit('registration_success', userData);
        
        // Broadcast new user to others (optional, for global search)
        socket.broadcast.emit('new_user_online', {
            username: userData.username,
            userNumber: userData.userNumber
        });
    });

    // --- SEARCH & ADD CONTACT LOGIC ---
    socket.on('add_contact_by_number', ({ targetNumber }) => {
        const currentUser = activeUsers.get(socket.id);
        if (!currentUser) return;

        const targetSocketId = numberToSocket.get(targetNumber);

        if (targetSocketId && targetSocketId !== socket.id) {
            const targetUser = activeUsers.get(targetSocketId);
            
            // Success: Target exists and is live
            socket.emit('contact_added_success', {
                username: targetUser.username,
                userNumber: targetUser.userNumber,
                status: targetUser.status
            });

            // Notify the target that someone added them
            io.to(targetSocketId).emit('you_were_added', {
                byUsername: currentUser.username,
                byNumber: currentUser.userNumber
            });

            console.log(`[CONTACT] ${currentUser.userNumber} added ${targetNumber}`);
        } else {
            // Failure: Number does not exist or is self
            socket.emit('contact_added_error', {
                message: targetNumber === currentUser?.userNumber 
                    ? "You cannot add yourself." 
                    : "User number not found. They might be offline."
            });
        }
    });

    // --- SEARCH SUGGESTIONS (Live) ---
    socket.on('search_users', ({ query }) => {
        const results = [];
        const searchTerm = query.toLowerCase();

        for (const user of activeUsers.values()) {
            if (user.id === socket.id) continue;
            
            if (user.username.toLowerCase().includes(searchTerm) || 
                user.userNumber.includes(searchTerm)) {
                results.push({
                    username: user.username,
                    userNumber: user.userNumber
                });
            }
            if (results.length >= 5) break; // Limit results
        }

        socket.emit('search_results', results);
    });

    // --- DISCONNECT ---
    socket.on('disconnect', () => {
        const user = activeUsers.get(socket.id);
        if (user) {
            console.log(`[DISCONN] User ${user.userNumber} went offline`);
            numberToSocket.delete(user.userNumber);
            activeUsers.delete(socket.id);
            
            socket.broadcast.emit('user_offline', {
                userNumber: user.userNumber
            });
        }
    });
});

// Static Middleware
if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
}

server.listen(PORT, () => {
    console.log(`
    ===========================================
    VIKVOK PREMIUM IDENTITY SERVER
    Port: ${PORT}
    Live Discovery: Enabled
    ===========================================
    `);
});
