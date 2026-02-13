// ==================== CONFIGURACIÓN ====================
// Detectar si estamos en GitHub Pages o en Render
const BASE_URL = window.location.hostname.includes('github.io') 
    ? 'https://baduu-app.onrender.com'  // URL de Render
    : window.location.origin;

const API_URL = BASE_URL + '/api';

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
let isChatOpen = false;

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar si hay código de referido en la URL
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref');
    
    if (referralCode) {
        // Guardar en sessionStorage para usarlo en el registro
        sessionStorage.setItem('pending_referral', referralCode);
    }
    
    // Verificar si hay sesión guardada
    const savedUser = localStorage.getItem('baduu_current_user');
    
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            // Verificar que el usuario existe en el servidor
            const response = await fetch(`${API_URL}/users/${user.id}`);
            
            if (response.ok) {
                currentUser = await response.json();
                
                // Actualizar estado online
                await fetch(`${API_URL}/users/${currentUser.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ online: true })
                });
                
                localStorage.setItem('baduu_current_user', JSON.stringify(currentUser));
            } else {
                // Usuario no existe en servidor, limpiar localStorage
                localStorage.removeItem('baduu_current_user');
                currentUser = null;
            }
        } catch (error) {
            console.error('Error checking session:', error);
            localStorage.removeItem('baduu_current_user');
            currentUser = null;
        }
    }
    
    // Mostrar splash y luego la pantalla correspondiente
    setTimeout(() => {
        document.getElementById('splash-screen').classList.remove('active');
        
        if (currentUser) {
            if (!currentUser.photo) {
                document.getElementById('photo-screen').classList.add('active');
            } else {
                document.getElementById('main-screen').classList.add('active');
                loadMainScreen();
            }
        } else {
            document.getElementById('auth-screen').classList.add('active');
            // Si hay código de referido pendiente, mostrarlo en el campo
            const pendingReferral = sessionStorage.getItem('pending_referral');
            if (pendingReferral) {
                document.getElementById('regReferralCode').value = pendingReferral;
            }
        }
    }, 2000);
});

// ==================== AUTENTICACIÓN ====================
function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('authTitle').textContent = 'Crear Cuenta';
    document.getElementById('authSubtitle').textContent = 'Regístrate para comenzar';
    
    // Verificar si hay código de referido pendiente
    const pendingReferral = sessionStorage.getItem('pending_referral');
    if (pendingReferral) {
        document.getElementById('regReferralCode').value = pendingReferral;
        sessionStorage.removeItem('pending_referral');
    }
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
        const response = await fetch(`${API_URL}/users?email=${email}`);
        const users = await response.json();
        
        const user = users.find(u => u.password === password);
        
        if (user) {
            currentUser = user;
            
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
    const referralCode = document.getElementById('regReferralCode').value;

    if (!name || !email || !password) {
        alert('Por favor completa todos los campos');
        return;
    }

    if (!referralCode) {
        alert('El código de referido es obligatorio');
        return;
    }

    // Verificar código de referido (qwerty o códigos de usuarios)
    const validReferral = await verifyReferralCode(referralCode);
    
    if (!validReferral) {
        alert('Código de referido inválido');
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

        // Generar código único para el nuevo usuario
        const userReferralCode = generateReferralCode(name);
        
        // Obtener ID del referidor
        const referrerId = await getReferrerId(referralCode);

        const newUser = {
            id: Date.now().toString(),
            name,
            email,
            password,
            photo: '',
            online: true,
            referralCode: userReferralCode,
            referredBy: referrerId,
            referrals: [],
            createdAt: new Date().toISOString()
        };

        const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUser)
        });

        const user = await response.json();
        
        // Actualizar contador de referidos del referidor
        if (referrerId) {
            await updateReferralCount(referrerId, user.id);
        }
        
        currentUser = user;
        localStorage.setItem('baduu_current_user', JSON.stringify(user));
        
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('photo-screen').classList.add('active');
    } catch (error) {
        console.error('Error:', error);
        alert('Error al registrar usuario');
    }
}

// ==================== SISTEMA DE REFERIDOS ====================
function generateReferralCode(name) {
    // Generar código único basado en nombre y timestamp
    const base = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const random = Math.random().toString(36).substring(2, 6);
    return (base + random).substring(0, 10);
}

async function verifyReferralCode(code) {
    if (code === 'qwerty') return true; // Código de prueba
    
    // Verificar si es código de algún usuario
    const response = await fetch(`${API_URL}/users?referralCode=${code}`);
    const users = await response.json();
    
    return users.length > 0;
}

async function getReferrerId(referralCode) {
    if (referralCode === 'qwerty') return null; // Código de prueba
    
    const response = await fetch(`${API_URL}/users?referralCode=${referralCode}`);
    const users = await response.json();
    
    return users.length > 0 ? users[0].id : null;
}

async function updateReferralCount(referrerId, newUserId) {
    const response = await fetch(`${API_URL}/users/${referrerId}`);
    const referrer = await response.json();
    
    const referrals = referrer.referrals || [];
    referrals.push(newUserId);
    
    await fetch(`${API_URL}/users/${referrerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referrals })
    });
}

async function getReferralCount(userId) {
    const response = await fetch(`${API_URL}/users/${userId}`);
    const user = await response.json();
    return user.referrals ? user.referrals.length : 0;
}

function copyReferralLink() {
    const referralCode = document.getElementById('referralCode').value;
    const link = `${window.location.origin}${window.location.pathname}?ref=${referralCode}`;
    
    navigator.clipboard.writeText(link).then(() => {
        alert('¡Enlace de invitación copiado!');
    }).catch(() => {
        alert('Error al copiar. Código: ' + referralCode);
    });
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
        
        stopMessageCheck();
        
        localStorage.removeItem('baduu_current_user');
        currentUser = null;
        currentChatUser = null;
        isChatOpen = false;
        
        // Resetear formularios
        document.getElementById('loginEmail').value = 'ana@email.com';
        document.getElementById('loginPassword').value = '123456';
        document.getElementById('regName').value = '';
        document.getElementById('regEmail').value = '';
        document.getElementById('regPassword').value = '';
        document.getElementById('regReferralCode').value = '';
        
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
    
    // Mostrar código de referido
    document.getElementById('referralCode').value = currentUser.referralCode || 'baduu-' + currentUser.id.slice(-4);
    
    // Mostrar estadísticas de referidos
    const referralCount = await getReferralCount(currentUser.id);
    document.getElementById('referralStats').innerHTML = `👥 ${referralCount} amigos invitados`;
    
    await loadUserStats();
    loadCards();
    await loadMatchesAndConversations();
    loadPublicaciones();
    
    startMessageCheck();
}

async function loadUserStats() {
    try {
        const messagesResponse = await fetch(`${API_URL}/messages?fromUserId=${currentUser.id}&toUserId=${currentUser.id}`);
        const messages = await messagesResponse.json();
        
        const postsResponse = await fetch(`${API_URL}/posts?userId=${currentUser.id}`);
        const posts = await postsResponse.json();
        
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
        const usersResponse = await fetch(`${API_URL}/users`);
        const users = await usersResponse.json();
        
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
    const likesResponse = await fetch(`${API_URL}/likes?userId=${currentUser.id}`);
    const likes = await likesResponse.json();
    return likes.map(l => l.targetUserId);
}

async function getMatches() {
    const matchesResponse = await fetch(`${API_URL}/matches?users_like=${currentUser.id}`);
    const matches = await matchesResponse.json();
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

function attachSwipeListeners() {
    if (!currentCard) return;

    currentCard.addEventListener('touchstart', handleTouchStart);
    currentCard.addEventListener('touchmove', handleTouchMove);
    currentCard.addEventListener('touchend', handleTouchEnd);
    currentCard.addEventListener('mousedown', handleMouseStart);
    currentCard.addEventListener('mousemove', handleMouseMove);
    currentCard.addEventListener('mouseup', handleMouseEnd);
    currentCard.addEventListener('mouseleave', handleMouseEnd);
}

function handleTouchStart(e) {
    e.preventDefault();
    isDragging = true;
    startX = e.touches[0].clientX;
    currentCard.style.transition = 'none';
}

function handleTouchMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    updateCardPosition(diff);
}

function handleTouchEnd(e) {
    if (!isDragging) return;
    e.preventDefault();
    const diff = currentX - startX;
    handleSwipeEnd(diff);
}

function handleMouseStart(e) {
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    currentCard.style.transition = 'none';
}

function handleMouseMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    currentX = e.clientX;
    const diff = currentX - startX;
    updateCardPosition(diff);
}

function handleMouseEnd(e) {
    if (!isDragging) return;
    e.preventDefault();
    const diff = currentX - startX;
    handleSwipeEnd(diff);
}

function updateCardPosition(diff) {
    if (!currentCard) return;
    
    const rotate = diff * 0.1;
    const opacity = Math.min(Math.abs(diff) / 300, 0.5);
    
    currentCard.style.transform = `translateX(${diff}px) rotate(${rotate}deg)`;
    currentCard.style.opacity = 1 - opacity;
    
    if (diff > 50) {
        currentCard.querySelector('.card-swipe-indicator.right').style.display = 'block';
        currentCard.querySelector('.card-swipe-indicator.left').style.display = 'none';
    } else if (diff < -50) {
        currentCard.querySelector('.card-swipe-indicator.right').style.display = 'none';
        currentCard.querySelector('.card-swipe-indicator.left').style.display = 'block';
    } else {
        currentCard.querySelector('.card-swipe-indicator.right').style.display = 'none';
        currentCard.querySelector('.card-swipe-indicator.left').style.display = 'none';
    }
}

function handleSwipeEnd(diff) {
    isDragging = false;
    currentCard.style.transition = 'all 0.3s';
    
    if (Math.abs(diff) > 100) {
        if (diff > 0) {
            likeUser();
        } else {
            dislikeUser();
        }
    } else {
        currentCard.style.transform = 'translateX(0) rotate(0)';
        currentCard.style.opacity = '1';
        currentCard.querySelector('.card-swipe-indicator.right').style.display = 'none';
        currentCard.querySelector('.card-swipe-indicator.left').style.display = 'none';
    }
}

async function likeUser() {
    if (currentCardIndex >= availableUsers.length) return;
    
    const user = availableUsers[currentCardIndex];
    
    try {
        const likeResponse = await fetch(`${API_URL}/likes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                targetUserId: user.id,
                timestamp: new Date().toISOString()
            })
        });
        
        const result = await likeResponse.json();
        
        currentCard.style.transform = 'translateX(1000px) rotate(30deg)';
        currentCard.style.opacity = '0';
        
        setTimeout(() => {
            if (result.match) {
                matchUserId = user.id;
                showMatchPopup(user.name);
                loadUserStats();
            }
            currentCardIndex++;
            renderCurrentCard();
        }, 300);
        
    } catch (error) {
        console.error('Error liking user:', error);
    }
}

function dislikeUser() {
    if (currentCardIndex >= availableUsers.length) return;
    
    currentCard.style.transform = 'translateX(-1000px) rotate(-30deg)';
    currentCard.style.opacity = '0';
    
    setTimeout(() => {
        currentCardIndex++;
        renderCurrentCard();
    }, 300);
}

function showMatchPopup(userName) {
    const popup = document.getElementById('matchPopup');
    document.getElementById('matchUserName').textContent = `¡Te gusta ${userName}!`;
    popup.style.display = 'block';
}

function closeMatchPopup() {
    document.getElementById('matchPopup').style.display = 'none';
    matchUserId = null;
}

function openChatFromMatch() {
    if (matchUserId) {
        closeMatchPopup();
        openChat(matchUserId);
        showSection('mensajes');
    }
}

// ==================== MATCHES Y CONVERSACIONES ====================
async function loadMatchesAndConversations() {
    try {
        const matchesResponse = await fetch(`${API_URL}/matches?users_like=${currentUser.id}`);
        const matches = await matchesResponse.json();
        const matchesList = document.getElementById('matchesList');
        const conversationsList = document.getElementById('conversationsList');
        
        matchesList.innerHTML = '';
        conversationsList.innerHTML = '';
        
        if (matches.length > 0) {
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
                const userResponse = await fetch(`${API_URL}/users/${otherUserId}`);
                const user = await userResponse.json();
                
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
        
        const conversations = await loadConversations();
        
        if (conversations.length > 0) {
            const uniqueConversations = new Map();
            
            conversations.forEach(conv => {
                if (!uniqueConversations.has(conv.otherUserId)) {
                    uniqueConversations.set(conv.otherUserId, conv);
                }
            });
            
            let conversationsHtml = '';
            for (const [otherUserId, conv] of uniqueConversations) {
                const userResponse = await fetch(`${API_URL}/users/${otherUserId}`);
                const otherUser = await userResponse.json();
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
        
        await updateUnreadBadge();
        
    } catch (error) {
        console.error('Error loading matches:', error);
    }
}

async function loadConversations() {
    const messagesResponse = await fetch(`${API_URL}/messages`);
    const messages = await messagesResponse.json();
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
                if (new Date(msg.timestamp) > new Date(conversations[key].updatedAt)) {
                    conversations[key].lastMessage = msg;
                    conversations[key].updatedAt = msg.timestamp;
                }
            }
        }
    });
    
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
    const messagesResponse = await fetch(`${API_URL}/messages?toUserId=${currentUser.id}&read=false`);
    const messages = await messagesResponse.json();
    const badge = document.getElementById('unreadBadge');
    
    if (messages.length > 0) {
        badge.textContent = messages.length > 9 ? '9+' : messages.length;
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

// ==================== CHAT ====================
async function openChat(userId) {
    const userResponse = await fetch(`${API_URL}/users/${userId}`);
    const user = await userResponse.json();
    if (!user) return;
    
    currentChatUser = user;
    isChatOpen = true;
    
    const messagesResponse = await fetch(`${API_URL}/messages?fromUserId=${userId}&toUserId=${currentUser.id}&read=false`);
    const messages = await messagesResponse.json();
    
    for (const msg of messages) {
        await fetch(`${API_URL}/messages/${msg.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ read: true })
        });
    }
    
    document.getElementById('encuentros-section').style.display = 'none';
    document.getElementById('muro-section').style.display = 'none';
    document.getElementById('mensajes-section').style.display = 'none';
    document.getElementById('perfil-section').style.display = 'none';
    
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

async function loadMessages(userId) {
    const messagesResponse = await fetch(`${API_URL}/messages?fromUserId=${currentUser.id}&toUserId=${userId}`);
    const messages = await messagesResponse.json();
    const messagesResponse2 = await fetch(`${API_URL}/messages?fromUserId=${userId}&toUserId=${currentUser.id}`);
    const messages2 = await messagesResponse2.json();
    
    const allMessages = [...messages, ...messages2].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    const container = document.getElementById('chatMessages');
    
    container.innerHTML = allMessages.map(msg => {
        const isSent = msg.fromUserId === currentUser.id;
        return `
            <div class="message ${isSent ? 'sent' : 'received'}">
                ${msg.text}
                <div class="message-time">
                    ${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        `;
    }).join('');
    
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    
    if (!text || !currentChatUser) return;
    
    try {
        await fetch(`${API_URL}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: Date.now().toString(),
                fromUserId: currentUser.id,
                toUserId: currentChatUser.id,
                text,
                timestamp: new Date().toISOString(),
                read: false
            })
        });
        
        await loadMessages(currentChatUser.id);
        await updateUnreadBadge();
        
        input.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

function backToMessages() {
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
    isChatOpen = false;
    loadMatchesAndConversations();
}

// ==================== VERIFICACIÓN DE MENSAJES ====================
function startMessageCheck() {
    if (messageCheckInterval) {
        clearInterval(messageCheckInterval);
    }
    
    messageCheckInterval = setInterval(async () => {
        if (!currentUser) return;
        
        try {
            await updateUnreadBadge();
            
            if (isChatOpen && currentChatUser) {
                await loadMessages(currentChatUser.id);
            }
            
        } catch (error) {
            console.error('Error in message check:', error);
        }
    }, 5000);
}

function stopMessageCheck() {
    if (messageCheckInterval) {
        clearInterval(messageCheckInterval);
        messageCheckInterval = null;
    }
}

// ==================== MURO SOCIAL ====================
function previewPublicacionFoto(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            publicacionFotoData = e.target.result;
            const container = document.getElementById('fotoPreviewContainer');
            const preview = document.getElementById('fotoPreview');
            preview.src = e.target.result;
            container.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

async function crearPublicacion() {
    const texto = document.getElementById('publicacionTexto').value.trim();
    
    if (!texto && !publicacionFotoData) {
        alert('Escribe algo o selecciona una foto');
        return;
    }

    try {
        await fetch(`${API_URL}/posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: Date.now().toString(),
                userId: currentUser.id,
                userName: currentUser.name,
                userPhoto: currentUser.photo,
                texto,
                imagen: publicacionFotoData,
                fecha: new Date().toISOString(),
                likes: [],
                comments: []
            })
        });
        
        document.getElementById('publicacionTexto').value = '';
        document.getElementById('fotoPreviewContainer').style.display = 'none';
        publicacionFotoData = null;
        document.getElementById('publicacionFoto').value = '';
        
        await loadPublicaciones();
        await loadUserStats();
        
    } catch (error) {
        console.error('Error creating post:', error);
    }
}

async function loadPublicaciones() {
    try {
        const postsResponse = await fetch(`${API_URL}/posts`);
        const posts = await postsResponse.json();
        const matches = await getMatches();
        
        const filteredPosts = posts.filter(post => 
            post.userId === currentUser.id || matches.includes(post.userId)
        ).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        const container = document.getElementById('publicacionesList');
        
        if (filteredPosts.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #999;">
                    <span style="font-size: 48px;">📝</span>
                    <p>No hay publicaciones aún</p>
                    <p style="margin-top: 10px;">¡Sé el primero en publicar algo!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredPosts.map(post => `
            <div class="publicacion-card">
                <div class="publicacion-header">
                    <img src="${post.userPhoto || 'https://via.placeholder.com/40'}" class="publicacion-avatar">
                    <div>
                        <div class="publicacion-user">${post.userName}</div>
                        <div class="publicacion-date">${new Date(post.fecha).toLocaleDateString()}</div>
                    </div>
                </div>
                ${post.imagen ? `<img src="${post.imagen}" class="publicacion-imagen">` : ''}
                ${post.texto ? `<div class="publicacion-texto">${post.texto}</div>` : ''}
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading posts:', error);
    }
}

// ==================== NAVEGACIÓN ====================
function showSection(section) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');

    document.getElementById('encuentros-section').style.display = 'none';
    document.getElementById('muro-section').style.display = 'none';
    document.getElementById('mensajes-section').style.display = 'none';
    document.getElementById('perfil-section').style.display = 'none';
    document.getElementById('chat-section').style.display = 'none';

    if (section === 'encuentros') {
        document.getElementById('encuentros-section').style.display = 'block';
        loadCards();
    } else if (section === 'muro') {
        document.getElementById('muro-section').style.display = 'block';
        loadPublicaciones();
    } else if (section === 'mensajes') {
        document.getElementById('mensajes-section').style.display = 'block';
        loadMatchesAndConversations();
    } else if (section === 'perfil') {
        document.getElementById('perfil-section').style.display = 'block';
        loadUserStats();
    }
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && document.getElementById('chat-section').style.display === 'block') {
        e.preventDefault();
        sendMessage();
    }
});

window.addEventListener('beforeunload', async () => {
    if (currentUser) {
        try {
            await fetch(`${API_URL}/users/${currentUser.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ online: false })
            });
        } catch (error) {
            console.error('Error updating status:', error);
        }
    }
    stopMessageCheck();
});

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
window.copyReferralLink = copyReferralLink;
