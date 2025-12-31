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

app.use(express.static(path.join(__dirname, 'public')));

// --- GAME CONFIGURATION ---
const WORDS = ["HAMBURGER", "SPACESHIP", "PINEAPPLE", "SKELETON", "VOLCANO", "GUITAR", "DRAGON", "BICYCLE"];
const ROUND_TIME = 60;

// --- STATE MANAGEMENT ---
let players = {}; // { socketId: { name, pfp, base, accessory, score, id } }
let gameState = {
    status: 'waiting', // waiting, active, intermission
    currentWord: '',
    drawerId: null,
    timer: ROUND_TIME,
    winners: []
};
let timerInterval = null;

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // --- PLAYER JOINING ---
    socket.on('join_game', (userData) => {
        players[socket.id] = {
            ...userData,
            id: socket.id,
            score: 0
        };
        
        // Broadcast new player list to everyone
        io.emit('player_list_update', Object.values(players));
        
        // Send current game state to the newcomer
        socket.emit('game_state_update', gameState);

        // Auto-start game if 2+ players join and status is 'waiting'
        if (Object.keys(players).length >= 2 && gameState.status === 'waiting') {
            startNewRound();
        }
    });

    // --- DRAWING SYNC ---
    socket.on('draw_stroke', (strokeData) => {
        // Only allow the current drawer to send strokes
        if (socket.id === gameState.drawerId) {
            socket.broadcast.emit('remote_draw', strokeData);
        }
    });

    socket.on('clear_canvas', () => {
        if (socket.id === gameState.drawerId) {
            io.emit('remote_clear');
        }
    });

    // --- CHAT & GUESSING ---
    socket.on('send_message', (text) => {
        const player = players[socket.id];
        if (!player) return;

        const guess = text.trim().toUpperCase();
        
        // Check if guess is correct
        if (gameState.status === 'active' && 
            socket.id !== gameState.drawerId && 
            guess === gameState.currentWord && 
            !gameState.winners.includes(socket.id)) {
            
            player.score += (gameState.timer * 10);
            gameState.winners.push(socket.id);
            
            io.emit('correct_guess', { 
                playerName: player.name, 
                players: Object.values(players) 
            });

            // If everyone guessed, end round early
            if (gameState.winners.length >= Object.keys(players).length - 1) {
                endRound();
            }
        } else {
            // Normal chat message
            io.emit('new_message', {
                user: player.name,
                text: text,
                type: 'chat'
            });
        }
    });

    // --- DISCONNECT ---
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('player_list_update', Object.values(players));

        // If drawer leaves, end round
        if (socket.id === gameState.drawerId) {
            endRound();
        }

        // If not enough players, go back to waiting
        if (Object.keys(players).length < 2) {
            resetGame();
        }
    });
});

// --- GAME LOGIC FUNCTIONS ---

function startNewRound() {
    clearInterval(timerInterval);
    
    const playerIds = Object.keys(players);
    if (playerIds.length < 2) return;

    // Pick next drawer (simple rotation or random)
    gameState.drawerId = playerIds[Math.floor(Math.random() * playerIds.length)];
    gameState.currentWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    gameState.status = 'active';
    gameState.timer = ROUND_TIME;
    gameState.winners = [];

    io.emit('game_state_update', gameState);
    io.emit('new_message', { user: 'SYSTEM', text: 'A new round has started!', type: 'system' });

    timerInterval = setInterval(() => {
        gameState.timer--;
        io.emit('timer_update', gameState.timer);

        if (gameState.timer <= 0) {
            endRound();
        }
    }, 1000);
}

function endRound() {
    clearInterval(timerInterval);
    gameState.status = 'intermission';
    io.emit('game_state_update', gameState);

    // Show results for 5 seconds then start next round
    setTimeout(() => {
        if (Object.keys(players).length >= 2) {
            startNewRound();
        } else {
            resetGame();
        }
    }, 5000);
}

function resetGame() {
    clearInterval(timerInterval);
    gameState = {
        status: 'waiting',
        currentWord: '',
        drawerId: null,
        timer: ROUND_TIME,
        winners: []
    };
    io.emit('game_state_update', gameState);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`SketchDash Multiplayer Server running on port ${PORT}`);
});
