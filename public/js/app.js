// ==================== CONFIGURACIÓN ====================
const API_URL = window.location.origin + '/api';
let currentUser = null;
let currentChatUser = null;
let currentCardIndex = 0;
let availableUsers = [];
let isDragging = false;
let startX = 0;
let currentX = 0;
let currentCard = null;
let publicacionFotoData = null;
let matchUserId = null;
let messageCheckInterval = null;

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
    // IMPORTANTE: Limpiar sesión anterior si estamos en la página de login
    const isAuthScreen = document.getElementById('auth-screen').classList.contains('active');
    if (isAuthScreen) {
        // Si estamos en pantalla de login, NO cargar sesión automáticamente
        setTimeout(() => {
            document.getElementById('splash-screen').classList.remove('active');
            document.getElementById('auth-screen').classList.add('active');
        }, 2000);
    } else {
        checkSession();
    }
});

// ==================== VERIFICAR SESIÓN ====================
async function checkSession() {
    try {
        const savedUser = localStorage.getItem('baduu_current_user');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            // Verificar que el usuario sigue existiendo
            const response = await fetch(`${API_URL}/users/${currentUser.id}`);
            if (response.ok) {
                const user = await response.json();
                currentUser = user;
                // Actualizar estado online
                await fetch(`${API_URL}/users/${currentUser.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ online: true })
                });
                
                // Cargar la app directamente
                setTimeout(() => {
                    document.getElementById('splash-screen').classList.remove('active');
                    if (!currentUser.photo) {
                        document.getElementById('photo-screen').classList.add('active');
                    } else {
                        document.getElementById('main-screen').classList.add('active');
                        loadMainScreen();
                    }
                }, 2000);
            } else {
                // Usuario no existe, limpiar sesión
                localStorage.removeItem('baduu_current_user');
                setTimeout(() => {
                    document.getElementById('splash-screen').classList.remove('active');
                    document.getElementById('auth-screen').classList.add('active');
                }, 2000);
            }
        } else {
            setTimeout(() => {
                document.getElementById('splash-screen').classList.remove('active');
                document.getElementById('auth-screen').classList.add('active');
            }, 2000);
        }
    } catch (error) {
        console.error('Error checking session:', error);
        setTimeout(() => {
            document.getElementById('splash-screen').classList.remove('active');
            document.getElementById('auth-screen').classList.add('active');
        }, 2000);
    }
}

// ==================== AUTENTICACIÓN ====================
function showRegister() {
    // Limpiar cualquier sesión existente
    localStorage.removeItem('baduu_current_user');
    currentUser = null;
    
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('authTitle').textContent = 'Crear Cuenta';
    document.getElementById('authSubtitle').textContent = 'Regístrate para comenzar';
}

function showLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('authTitle').textContent = 'Bienvenido';
    document.getElementById('authSubtitle').textContent = 'Inicia sesión para continuar';
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        alert('Por favor completa todos los campos');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/users?email=${email}&password=${password}`);
        const users = await response.json();
        
        if (users.length > 0) {
            const user = users[0];
            currentUser = user;
            
            // Actualizar estado online
            await fetch(`${API_URL}/users/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ online: true })
            });
            
            localStorage.setItem('baduu_current_user', JSON.stringify(user));
            
            document.getElementById('auth-screen').classList.remove('active');
            
            if (!user.photo) {
                document.getElementById('photo-screen').classList.add('active');
            } else {
                document.getElementById('main-screen').classList.add('active');
                loadMainScreen();
            }
        } else {
            alert('Email o contraseña incorrectos');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al iniciar sesión');
    }
}

async function handleRegister() {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;

    if (!name || !email || !password) {
        alert('Por favor completa todos los campos');
        return;
    }

    try {
        // Verificar si el email ya existe
        const checkResponse = await fetch(`${API_URL}/users?email=${email}`);
        const existingUsers = await checkResponse.json();
        
        if (existingUsers.length > 0) {
            alert('Este email ya está registrado');
            return;
        }

        const newUser = {
            id: Date.now().toString(),
            name,
            email,
            password,
            photo: '',
            online: true,
            createdAt: new Date().toISOString()
        };

        const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUser)
        });

        const user = await response.json();
        currentUser = user;
        localStorage.setItem('baduu_current_user', JSON.stringify(user));
        
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('photo-screen').classList.add('active');
    } catch (error) {
        console.error('Error:', error);
        alert('Error al registrar usuario');
    }
}

// ==================== LOGOUT ====================
async function logout() {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        try {
            if (currentUser) {
                await fetch(`${API_URL}/users/${currentUser.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ online: false })
                });
            }
        } catch (error) {
            console.error('Error updating status:', error);
        }
        
        // LIMPIAR COMPLETAMENTE LA SESIÓN
        localStorage.removeItem('baduu_current_user');
        currentUser = null;
        currentChatUser = null;
        
        if (messageCheckInterval) {
            clearInterval(messageCheckInterval);
            messageCheckInterval = null;
        }
        
        // Resetear formularios
        document.getElementById('loginEmail').value = 'ana@email.com';
        document.getElementById('loginPassword').value = '123456';
        document.getElementById('regName').value = '';
        document.getElementById('regEmail').value = '';
        document.getElementById('regPassword').value = '';
        
        // Volver a pantalla de login
        document.getElementById('main-screen').classList.remove('active');
        document.getElementById('photo-screen').classList.remove('active');
        document.getElementById('auth-screen').classList.add('active');
        showLogin();
    }
}

// ==================== FOTO DE PERFIL ====================
let uploadedPhoto = null;

function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedPhoto = e.target.result;
            document.getElementById('photoPreview').innerHTML = `<img src="${e.target.result}">`;
        };
        reader.readAsDataURL(file);
    }
}

async function savePhoto() {
    if (!uploadedPhoto && !currentUser?.photo) {
        alert('Por favor selecciona una foto');
        return;
    }

    try {
        if (uploadedPhoto) {
            const response = await fetch(`${API_URL}/users/${currentUser.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photo: uploadedPhoto })
            });
            
            currentUser = await response.json();
            localStorage.setItem('baduu_current_user', JSON.stringify(currentUser));
        }

        document.getElementById('photo-screen').classList.remove('active');
        document.getElementById('main-screen').classList.add('active');
        loadMainScreen();
    } catch (error) {
        console.error('Error:', error);
        alert('Error al guardar la foto');
    }
}

// ==================== FUNCIONES PRINCIPALES ====================
async function loadMainScreen() {
    document.getElementById('headerAvatar').src = currentUser.photo || 'https://via.placeholder.com/40';
    document.getElementById('profilePhoto').src = currentUser.photo || 'https://via.placeholder.com/150';
    document.getElementById('profileName').textContent = currentUser.name;
    document.getElementById('profileEmail').textContent = currentUser.email;
    
    await loadUserStats();
    loadCards();
    await loadMatchesAndConversations();
    loadPublicaciones();
    
    startMessageCheck();
}

async function loadUserStats() {
    try {
        const messages = await fetch(`${API_URL}/messages?fromUserId=${currentUser.id}&toUserId=${currentUser.id}`).then(res => res.json());
        const posts = await fetch(`${API_URL}/posts?userId=${currentUser.id}`).then(res => res.json());
        const matches = await getMatches();
        
        document.getElementById('profileMatchesCount').textContent = matches.length;
        document.getElementById('profileMessagesCount').textContent = messages.length;
        document.getElementById('profilePostsCount').textContent = posts.length;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ==================== TINDER CARDS ====================
async function loadCards() {
    try {
        const users = await fetch(`${API_URL}/users`).then(res => res.json());
        const likes = await getUserLikes();
        const matches = await getMatches();
        
        availableUsers = users.filter(user => 
            user.id !== currentUser.id && 
            !likes.includes(user.id) &&
            !matches.includes(user.id)
        );
        
        currentCardIndex = 0;
        renderCurrentCard();
    } catch (error) {
        console.error('Error loading cards:', error);
    }
}

async function getUserLikes() {
    const likes = await fetch(`${API_URL}/likes?userId=${currentUser.id}`).then(res => res.json());
    return likes.map(l => l.targetUserId);
}

async function getMatches() {
    const matches = await fetch(`${API_URL}/matches?users_like=${currentUser.id}`).then(res => res.json());
    return matches.map(m => m.users.find(id => id !== currentUser.id));
}

function renderCurrentCard() {
    const container = document.getElementById('cards-container');
    
    if (currentCardIndex >= availableUsers.length) {
        container.innerHTML = `
            <div class="no-more-cards">
                <span>😊</span>
                <h3>No hay más usuarios</h3>
                <p>Vuelve más tarde para conocer más personas</p>
            </div>
        `;
        return;
    }

    const user = availableUsers[currentCardIndex];
    container.innerHTML = `
        <div id="swipe-card" class="card">
            <div class="card-swipe-indicator left">✕ NO</div>
            <div class="card-swipe-indicator right">♥ LIKE</div>
            <img src="${user.photo || 'https://via.placeholder.com/400'}" alt="${user.name}" class="card-photo">
            <div class="card-info">
                <div class="card-name">${user.name}</div>
                <div class="card-status">
                    <span>●</span> ${user.online ? 'En línea' : 'Desconectado'}
                </div>
            </div>
        </div>
    `;

    currentCard = document.getElementById('swipe-card');
    attachSwipeListeners();
}

// ... (código de swipe igual que antes) ...

// ==================== MATCHES Y CONVERSACIONES (CORREGIDO - SIN DUPLICADOS) ====================
async function loadMatchesAndConversations() {
    try {
        const matches = await fetch(`${API_URL}/matches?users_like=${currentUser.id}`).then(res => res.json());
        const matchesList = document.getElementById('matchesList');
        const conversationsList = document.getElementById('conversationsList');
        
        // LIMPIAR HTML ANTES DE INSERTAR
        matchesList.innerHTML = '';
        conversationsList.innerHTML = '';
        
        // Mostrar matches (SIN DUPLICADOS)
        if (matches.length > 0) {
            // Usar un Set para evitar duplicados
            const uniqueMatches = [];
            const matchIds = new Set();
            
            for (const match of matches) {
                const otherUserId = match.users.find(id => id !== currentUser.id);
                if (!matchIds.has(otherUserId)) {
                    matchIds.add(otherUserId);
                    uniqueMatches.push(match);
                }
            }
            
            let matchesHtml = '';
            for (const match of uniqueMatches) {
                const otherUserId = match.users.find(id => id !== currentUser.id);
                const user = await fetch(`${API_URL}/users/${otherUserId}`).then(res => res.json());
                
                matchesHtml += `
                    <div class="match-item" onclick="openChat('${user.id}')">
                        <img src="${user.photo || 'https://via.placeholder.com/60'}" class="match-avatar">
                        <span class="match-name">${user.name}</span>
                    </div>
                `;
            }
            matchesList.innerHTML = matchesHtml;
        } else {
            matchesList.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No tienes matches aún</p>';
        }
        
        // Cargar conversaciones (SIN DUPLICADOS)
        const conversations = await loadConversations();
        
        if (conversations.length > 0) {
            // Usar un Map para evitar duplicados por usuario
            const uniqueConversations = new Map();
            
            conversations.forEach(conv => {
                if (!uniqueConversations.has(conv.otherUserId)) {
                    uniqueConversations.set(conv.otherUserId, conv);
                }
            });
            
            let conversationsHtml = '';
            for (const [otherUserId, conv] of uniqueConversations) {
                const otherUser = await fetch(`${API_URL}/users/${otherUserId}`).then(res => res.json());
                const lastMessage = conv.lastMessage;
                const unreadCount = conv.unreadCount || 0;
                
                conversationsHtml += `
                    <div class="conversation-item" onclick="openChat('${otherUser.id}')">
                        <div style="position: relative;">
                            <img src="${otherUser.photo || 'https://via.placeholder.com/50'}" class="conversation-avatar">
                            ${otherUser.online ? '<span style="position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; background: #4CAF50; border-radius: 50%; border: 2px solid white;"></span>' : ''}
                        </div>
                        <div class="conversation-info">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div class="conversation-name">${otherUser.name}</div>
                                ${unreadCount > 0 ? `<span class="unread-count">${unreadCount}</span>` : ''}
                            </div>
                            <div class="conversation-last-message">
                                ${lastMessage?.fromUserId === currentUser.id ? 'Tú: ' : ''}
                                ${lastMessage?.text || ''}
                            </div>
                        </div>
                    </div>
                `;
            }
            conversationsList.innerHTML = conversationsHtml;
        } else {
            conversationsList.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No tienes conversaciones aún</p>';
        }
        
        // Actualizar badge de mensajes no leídos
        await updateUnreadBadge();
        
    } catch (error) {
        console.error('Error loading matches:', error);
    }
}

async function loadConversations() {
    const messages = await fetch(`${API_URL}/messages`).then(res => res.json());
    const conversations = {};
    
    messages.forEach(msg => {
        if (msg.fromUserId === currentUser.id || msg.toUserId === currentUser.id) {
            const otherUserId = msg.fromUserId === currentUser.id ? msg.toUserId : msg.fromUserId;
            const key = [currentUser.id, otherUserId].sort().join('-');
            
            if (!conversations[key]) {
                conversations[key] = {
                    otherUserId,
                    lastMessage: msg,
                    updatedAt: msg.timestamp,
                    unreadCount: 0
                };
            } else {
                // Actualizar solo si es más reciente
                if (new Date(msg.timestamp) > new Date(conversations[key].updatedAt)) {
                    conversations[key].lastMessage = msg;
                    conversations[key].updatedAt = msg.timestamp;
                }
            }
        }
    });
    
    // Contar mensajes no leídos
    Object.keys(conversations).forEach(key => {
        const conv = conversations[key];
        conv.unreadCount = messages.filter(msg => 
            msg.toUserId === currentUser.id && 
            msg.fromUserId === conv.otherUserId && 
            !msg.read
        ).length;
    });
    
    return Object.values(conversations).sort((a, b) => 
        new Date(b.updatedAt) - new Date(a.updatedAt)
    );
}

async function updateUnreadBadge() {
    const messages = await fetch(`${API_URL}/messages?toUserId=${currentUser.id}&read=false`).then(res => res.json());
    const badge = document.getElementById('unreadBadge');
    
    if (messages.length > 0) {
        badge.textContent = messages.length > 9 ? '9+' : messages.length;
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

// ==================== CHAT (PANTALLA COMPLETA) ====================
async function openChat(userId) {
    const user = await fetch(`${API_URL}/users/${userId}`).then(res => res.json());
    if (!user) return;
    
    currentChatUser = user;
    
    // Marcar mensajes como leídos
    const messages = await fetch(`${API_URL}/messages?fromUserId=${userId}&toUserId=${currentUser.id}&read=false`).then(res => res.json());
    
    for (const msg of messages) {
        await fetch(`${API_URL}/messages/${msg.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ read: true })
        });
    }
    
    // OCULTAR TODAS LAS SECCIONES Y MOSTRAR CHAT EN PANTALLA COMPLETA
    document.getElementById('encuentros-section').style.display = 'none';
    document.getElementById('muro-section').style.display = 'none';
    document.getElementById('mensajes-section').style.display = 'none';
    document.getElementById('perfil-section').style.display = 'none';
    
    // QUITAR LA CLASE 'content-area' DEL CHAT PARA QUE OCUPE TODA LA PANTALLA
    const chatSection = document.getElementById('chat-section');
    chatSection.style.display = 'flex';
    chatSection.style.flexDirection = 'column';
    chatSection.style.height = '100%';
    chatSection.style.width = '100%';
    chatSection.style.position = 'absolute';
    chatSection.style.top = '0';
    chatSection.style.left = '0';
    chatSection.style.right = '0';
    chatSection.style.bottom = '0';
    chatSection.style.backgroundColor = 'white';
    chatSection.style.zIndex = '1000';
    
    document.getElementById('chatAvatar').src = user.photo || 'https://via.placeholder.com/45';
    document.getElementById('chatUserName').textContent = user.name;
    document.getElementById('chatUserStatus').innerHTML = user.online ? '● En línea' : '○ Desconectado';
    document.getElementById('chatUserStatus').style.color = user.online ? '#4CAF50' : '#999';
    
    await loadMessages(userId);
    await updateUnreadBadge();
    
    setTimeout(() => {
        document.getElementById('chatInput').focus();
    }, 300);
}

function backToMessages() {
    // RESTAURAR EL CHAT A SU ESTADO NORMAL
    const chatSection = document.getElementById('chat-section');
    chatSection.style.display = 'none';
    chatSection.style.position = 'relative';
    chatSection.style.top = 'auto';
    chatSection.style.left = 'auto';
    chatSection.style.right = 'auto';
    chatSection.style.bottom = 'auto';
    chatSection.style.zIndex = 'auto';
    
    document.getElementById('mensajes-section').style.display = 'block';
    currentChatUser = null;
    loadMatchesAndConversations();
}

// ==================== RESTO DEL CÓDIGO (IGUAL) ====================
// ... (el resto de funciones: loadMessages, sendMessage, startMessageCheck, 
//      previewPublicacionFoto, crearPublicacion, loadPublicaciones, 
//      showSection, etc. SE QUEDAN IGUAL) ...

// ==================== EXPORTAR FUNCIONES GLOBALES ====================
window.showRegister = showRegister;
window.showLogin = showLogin;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.logout = logout;
window.handlePhotoUpload = handlePhotoUpload;
window.savePhoto = savePhoto;
window.showSection = showSection;
window.previewPublicacionFoto = previewPublicacionFoto;
window.crearPublicacion = crearPublicacion;
window.openChat = openChat;
window.sendMessage = sendMessage;
window.backToMessages = backToMessages;
window.closeMatchPopup = closeMatchPopup;
window.openChatFromMatch = openChatFromMatch;
