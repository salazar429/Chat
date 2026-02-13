const jsonServer = require('json-server');
const path = require('path');
const express = require('express');
const fs = require('fs');

const server = express();
const router = jsonServer.router(path.join(__dirname, 'database.json'));
const middlewares = jsonServer.defaults();

// Habilitar CORS para GitHub Pages
server.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Servir archivos estáticos
server.use(express.static(path.join(__dirname, 'public')));

// Middlewares
server.use(middlewares);
server.use(jsonServer.bodyParser);

// Middleware para validar datos
server.use((req, res, next) => {
    if (req.method === 'POST') {
        req.body.id = Date.now().toString();
        req.body.timestamp = req.body.timestamp || new Date().toISOString();
    }
    next();
});

// ============ ENDPOINTS PERSONALIZADOS ============

// Endpoint para matches
server.get('/api/matches', (req, res) => {
    const db = router.db;
    let matches = db.get('matches').value();
    
    if (req.query.users_like) {
        matches = matches.filter(match => 
            match.users.includes(req.query.users_like)
        );
    }
    
    const uniqueMatches = [];
    const matchKeys = new Set();
    
    matches.forEach(match => {
        const key = match.users.sort().join('-');
        if (!matchKeys.has(key)) {
            matchKeys.add(key);
            uniqueMatches.push(match);
        }
    });
    
    res.json(uniqueMatches);
});

// Endpoint para likes
server.get('/api/likes', (req, res) => {
    const db = router.db;
    let likes = db.get('likes').value();
    
    if (req.query.userId) {
        likes = likes.filter(like => like.userId === req.query.userId);
    }
    
    if (req.query.targetUserId) {
        likes = likes.filter(like => like.targetUserId === req.query.targetUserId);
    }
    
    res.json(likes);
});

// Endpoint para mensajes
server.get('/api/messages', (req, res) => {
    const db = router.db;
    let messages = db.get('messages').value();
    
    if (req.query.fromUserId) {
        messages = messages.filter(m => m.fromUserId === req.query.fromUserId);
    }
    
    if (req.query.toUserId) {
        messages = messages.filter(m => m.toUserId === req.query.toUserId);
    }
    
    if (req.query.read !== undefined) {
        const read = req.query.read === 'true';
        messages = messages.filter(m => m.read === read);
    }
    
    res.json(messages);
});

// Endpoint para crear like y verificar match
server.post('/api/likes', (req, res) => {
    const db = router.db;
    const like = req.body;
    
    const existingLike = db.get('likes')
        .find(l => l.userId === like.userId && l.targetUserId === like.targetUserId)
        .value();
    
    if (!existingLike) {
        db.get('likes').push(like).write();
    }
    
    const reciprocalLike = db.get('likes')
        .find(l => l.userId === like.targetUserId && l.targetUserId === like.userId)
        .value();
    
    let match = null;
    if (reciprocalLike) {
        const matchKey = [like.userId, like.targetUserId].sort().join('-');
        const existingMatch = db.get('matches')
            .find(m => m.users.sort().join('-') === matchKey)
            .value();
        
        if (!existingMatch) {
            match = {
                id: Date.now().toString(),
                users: [like.userId, like.targetUserId],
                timestamp: new Date().toISOString()
            };
            db.get('matches').push(match).write();
        } else {
            match = existingMatch;
        }
    }
    
    res.json({ like, match });
});

// Endpoint para verificar código de referido
server.get('/api/verify-referral', (req, res) => {
    const { code } = req.query;
    
    if (code === 'qwerty') {
        return res.json({ valid: true, isTestCode: true });
    }
    
    const db = router.db;
    const user = db.get('users').find({ referralCode: code }).value();
    
    res.json({ 
        valid: !!user, 
        referrerId: user ? user.id : null 
    });
});

// Usar las rutas de la API con prefijo /api
server.use('/api', router);

// Todas las demás rutas redirigen al index.html
server.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Servidor Baduu corriendo en puerto ${PORT}`);
    console.log(`🌍 API: http://localhost:${PORT}/api`);
    console.log(`📱 App: http://localhost:${PORT}`);
});
