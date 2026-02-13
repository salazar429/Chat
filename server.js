const jsonServer = require('json-server');
const server = jsonServer.create();
const router = jsonServer.router('database.json');
const middlewares = jsonServer.defaults();

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

// Endpoint personalizado para matches
server.get('/matches', (req, res) => {
    const db = router.db;
    let matches = db.get('matches').value();
    
    if (req.query.users_like) {
        matches = matches.filter(match => 
            match.users.includes(req.query.users_like)
        );
    }
    
    res.json(matches);
});

// Endpoint personalizado para likes
server.get('/likes', (req, res) => {
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

// Endpoint personalizado para mensajes
server.get('/messages', (req, res) => {
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

// Endpoint para crear match automáticamente
server.post('/likes', (req, res) => {
    const db = router.db;
    const like = req.body;
    
    // Guardar like
    db.get('likes').push(like).write();
    
    // Verificar si hay like recíproco
    const reciprocalLike = db.get('likes')
        .find(l => l.userId === like.targetUserId && l.targetUserId === like.userId)
        .value();
    
    if (reciprocalLike) {
        // Crear match
        const match = {
            id: Date.now().toString(),
            users: [like.userId, like.targetUserId],
            timestamp: new Date().toISOString()
        };
        db.get('matches').push(match).write();
    }
    
    res.json(like);
});

server.use(router);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Servidor Baduu corriendo en http://localhost:${PORT}`);
});
