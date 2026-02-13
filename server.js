const jsonServer = require('json-server');
const path = require('path');
const express = require('express');

const server = express();
const router = jsonServer.router(path.join(__dirname, 'database.json'));
const middlewares = jsonServer.defaults();

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

// Endpoint para matches (EVITAR DUPLICADOS)
server.get('/api/matches', (req, res) => {
    const db = router.db;
    let matches = db.get('matches').value();
    
    if (req.query.users_like) {
        matches = matches.filter(match => 
            match.users.includes(req.query.users_like)
        );
    }
    
    // ELIMINAR DUPLICADOS
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

// Endpoint para crear like y verificar match (EVITAR DUPLICADOS)
server.post('/api/likes', (req, res) => {
    const db = router.db;
    const like = req.body;
    
    // Verificar si ya existe este like
    const existingLike = db.get('likes')
        .find(l => l.userId === like.userId && l.targetUserId === like.targetUserId)
        .value();
    
    if (!existingLike) {
        // Guardar like
        db.get('likes').push(like).write();
    }
    
    // Verificar si hay like recíproco
    const reciprocalLike = db.get('likes')
        .find(l => l.userId === like.targetUserId && l.targetUserId === like.userId)
        .value();
    
    let match = null;
    if (reciprocalLike) {
        // Verificar si el match ya existe
        const matchKey = [like.userId, like.targetUserId].sort().join('-');
        const existingMatch = db.get('matches')
            .find(m => m.users.sort().join('-') === matchKey)
            .value();
        
        if (!existingMatch) {
            // Crear match
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
