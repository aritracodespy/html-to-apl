// --- IndexedDB Setup ---
let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('aiChatAppDB', 1);

        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains('chats')) {
                db.createObjectStore('chats', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('saved_messages')) {
                db.createObjectStore('saved_messages', { keyPath: 'id' });
            }
        };

        request.onsuccess = event => {
            db = event.target.result;
            resolve();
        };

        request.onerror = event => {
            console.error('IndexedDB error:', event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

function dbGet(storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName]);
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbSet(storeName, value) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbGetAll(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName]);
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbDelete(storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbClear(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}


// --- Global variables ---
let currentChatId = null;
let chats = {};
let savedMessages = {};
let apiKey = '';
let selectedModel = 'google/gemma-3-27b-it:free';

// --- Initialize app ---
window.onload = async function() {
    try {
        await initDB();
        await loadSettings();
        setupMarked();
        if (apiKey) {
            document.getElementById('setupModal').style.display = 'none';
            initializeApp();
        } else {
            document.getElementById('setupModal').style.display = 'block';
        }
    } catch (error) {
        console.error("Failed to initialize the app:", error);
        alert("Could not load database. Please ensure you're not in private browsing mode and that your browser supports IndexedDB.");
    }
};

function setupMarked() {
    // Configure marked for better code highlighting
    marked.setOptions({
        highlight: function(code, lang) {
            if (lang && Prism.languages[lang]) {
                return Prism.highlight(code, Prism.languages[lang], lang);
            }
            return code;
        },
        breaks: true,
        gfm: true
    });
}

async function loadSettings() {
    const apiKeySetting = await dbGet('settings', 'apiKey');
    const modelSetting = await dbGet('settings', 'model');
    apiKey = apiKeySetting ? apiKeySetting.value : '';
    selectedModel = modelSetting ? modelSetting.value : 'google/gemma-3-27b-it:free';

    // Load chat history
    const savedChatsArray = await dbGetAll('chats');
    chats = {};
    savedChatsArray.forEach(chat => {
        chats[chat.id] = chat;
    });

    // Load saved messages
    const savedMsgsArray = await dbGetAll('saved_messages');
    savedMessages = {};
    savedMsgsArray.forEach(msg => {
        savedMessages[msg.id] = msg;
    });
}

async function saveSettings() {
    const newApiKey = document.getElementById('apiKey').value;
    const newModel = document.getElementById('modelSelect').value.trim();

    if (!newApiKey.trim()) {
        alert('Please enter your OpenRouter API key');
        return;
    }

    apiKey = newApiKey;
    selectedModel = newModel;

    await dbSet('settings', { key: 'apiKey', value: apiKey });
    await dbSet('settings', { key: 'model', value: selectedModel });

    updateModelDisplay();
    closeSettings();
}

async function completeSetup() {
    const setupApiKey = document.getElementById('setupApiKey').value;
    const setupModel = document.getElementById('setupModel').value;

    if (!setupApiKey.trim()) {
        alert('Please enter your OpenRouter API key');
        return;
    }

    apiKey = setupApiKey;
    selectedModel = setupModel;

    await dbSet('settings', { key: 'apiKey', value: apiKey });
    await dbSet('settings', { key: 'model', value: selectedModel });

    document.getElementById('setupModal').style.display = 'none';
    initializeApp();
}

function initializeApp() {
    updateModelDisplay();
    loadChatHistory();
    loadSavedMessages();
    if (Object.keys(chats).length === 0) {
        startNewChat();
    } else {
        // Load the most recent chat based on created date
        const chatIds = Object.keys(chats).sort((a, b) => new Date(chats[b].created) - new Date(chats[a].created));
        currentChatId = chatIds[0];
        loadChat(currentChatId);
    }
}

function updateModelDisplay() {
    const modelDisplay = document.getElementById('modelName');
    const modelName = selectedModel.split('/').pop().split(':')[0];
    modelDisplay.textContent = modelName.charAt(0).toUpperCase() + modelName.slice(1);
}

function openSettings() {
    document.getElementById('apiKey').value = apiKey;
    document.getElementById('modelSelect').value = selectedModel;
    const modal = document.getElementById('settingsModal');
    modal.style.display = 'block';
    setTimeout(() => modal.classList.add('visible'), 10);
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('visible');
    setTimeout(() => modal.style.display = 'none', 300);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('visible');
}

function startNewChat() {
    currentChatId = 'chat_' + Date.now();
    const newChat = {
        id: currentChatId,
        title: 'New Chat',
        messages: [],
        created: new Date().toISOString()
    };
    chats[currentChatId] = newChat;

    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = `
        <div class="message assistant">
            <div class="message-content">
                <p>Hello! I'm your AI assistant. How can I help you today?</p>
            </div>
        </div>
    `;

    saveChat(currentChatId);
    loadChatHistory();

    // Highlight current chat
    const chatItems = document.querySelectorAll('.chat-item');
    chatItems.forEach(item => item.classList.remove('active'));
    const currentItem = document.querySelector(`[data-chat-id="${currentChatId}"]`);
    if (currentItem) currentItem.classList.add('active');
}

function loadChatHistory() {
    const chatList = document.getElementById('chatList');
    chatList.innerHTML = '';

    const sortedChats = Object.values(chats).sort((a, b) => new Date(b.created) - new Date(a.created));

    sortedChats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.setAttribute('data-chat-id', chat.id);
        chatItem.textContent = chat.title;
        chatItem.onclick = () => loadChat(chat.id);

        if (chat.id === currentChatId) {
            chatItem.classList.add('active');
        }

        chatList.appendChild(chatItem);
    });
}

function loadChat(chatId) {
    currentChatId = chatId;
    const chat = chats[chatId];
    const chatMessages = document.getElementById('chatMessages');

    chatMessages.innerHTML = `
        <div class="message assistant">
            <div class="message-content">
                <p>Hello! I'm your AI assistant. How can I help you today?</p>
            </div>
        </div>
    `;

    if (chat && chat.messages) {
        chat.messages.forEach(message => {
            addMessageToChat(message.role, message.content, false);
        });
    }

    // Update active chat
    const chatItems = document.querySelectorAll('.chat-item');
    chatItems.forEach(item => item.classList.remove('active'));
    const currentItem = document.querySelector(`[data-chat-id="${chatId}"]`);
    if (currentItem) currentItem.classList.add('active');

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function saveChat(chatId) {
    if (chats[chatId]) {
        await dbSet('chats', chats[chatId]);
    }
}

async function deleteChatHistory() {
    const confirmDelete = confirm("Want to delete all chat history?")
    if (confirmDelete) {
        chats = {}
        await dbClear('chats');
        startNewChat();
        loadChatHistory();
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (!message) return;

    addMessageToChat('user', message);
    input.value = '';

    if (!chats[currentChatId]) {
        chats[currentChatId] = {
            id: currentChatId,
            title: 'New Chat',
            messages: [],
            created: new Date().toISOString()
        };
    }

    chats[currentChatId].messages.push({ role: 'user', content: message });

    if (chats[currentChatId].messages.length === 1) {
        chats[currentChatId].title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
        loadChatHistory();
    }

    showTypingIndicator();

    try {
        const response = await callOpenRouter(message);
        removeTypingIndicator();
        addMessageToChat('assistant', response);

        chats[currentChatId].messages.push({ role: 'assistant', content: response });
        await saveChat(currentChatId);

    } catch (error) {
        removeTypingIndicator();
        addMessageToChat('assistant', 'Sorry, I encountered an error while processing your request. Please check your API key and try again.');
        console.error('Error:', error);
    }
}

async function callOpenRouter(message) {
    const messages = [
        ...chats[currentChatId].messages.slice(-10),
        { role: 'user', content: message }
    ];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: selectedModel,
            messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content
            }))
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP error! status: ${response.status} - ${errorData.error.message}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

function addMessageToChat(role, content, scroll = true) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    if (role === 'assistant') {
        const htmlContent = marked.parse(content);
        contentDiv.innerHTML = htmlContent;

        const codeBlocks = contentDiv.querySelectorAll('pre');
        codeBlocks.forEach((pre) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'code-block-wrapper';
            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);

            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.textContent = 'Copy';
            copyBtn.onclick = function() {
                const code = pre.querySelector('code');
                const text = code ? code.textContent : pre.textContent;
                navigator.clipboard.writeText(text).then(() => {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1000);
                });
            };
            pre.appendChild(copyBtn);
        });

        const buttonContainer = document.createElement('div');
        buttonContainer.style.textAlign = 'right';
        buttonContainer.style.marginTop = '10px';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-btn';
        saveBtn.textContent = '⎙';
        saveBtn.title = 'save';
        saveBtn.onclick = function() {
            saveMessage(content);
        };
        buttonContainer.appendChild(saveBtn);

        contentDiv.appendChild(buttonContainer);

        setTimeout(() => {
            if (typeof Prism !== 'undefined') {
                Prism.highlightAllUnder(contentDiv);
            }
        }, 100);

    } else {
        contentDiv.textContent = content;
    }

    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);

    if (scroll) {
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);
    }
}

function showTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant';
    typingDiv.id = 'typing-indicator';

    typingDiv.innerHTML = `
        <div class="typing-indicator">
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;

    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

window.onclick = function(event) {
    const settingsModal = document.getElementById('settingsModal');
    const viewMessageModal = document.getElementById('viewMessageModal');
    const sidebar = document.getElementById('sidebar');

    if (event.target == settingsModal) {
        closeSettings();
    }
    
    if (event.target == viewMessageModal) {
        closeViewMessageModal();
    }

    if (!sidebar.contains(event.target) && !event.target.closest('.toggle-sidebar')) {
        sidebar.classList.remove('visible');
    }
}

async function saveMessage(content) {
    const messageId = 'msg_' + Date.now();
    const title = content.substring(0, 20) + (content.length > 20 ? '...' : '');
    const newMessage = {
        id: messageId,
        title: title,
        content: content,
        created: new Date().toISOString()
    };
    savedMessages[messageId] = newMessage;
    await dbSet('saved_messages', newMessage);
    loadSavedMessages();
}

function loadSavedMessages() {
    const savedMessageList = document.getElementById('savedMessageList');
    savedMessageList.innerHTML = '';

    const sortedMessages = Object.values(savedMessages).sort((a, b) => new Date(b.created) - new Date(a.created));

    sortedMessages.forEach(message => {
        const messageItem = document.createElement('div');
        messageItem.className = 'chat-item';
        
        const titleSpan = document.createElement('span');
        titleSpan.textContent = message.title;
        titleSpan.onclick = () => viewMessage(message.id);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-saved-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteSavedMessage(message.id);
        };

        messageItem.appendChild(titleSpan);
        messageItem.appendChild(deleteBtn);
        savedMessageList.appendChild(messageItem);
    });
}

function viewMessage(messageId) {
    const message = savedMessages[messageId];
    document.getElementById('viewMessageTitle').textContent = message.title;
    const contentDiv = document.getElementById('viewMessageContent');
    contentDiv.innerHTML = marked.parse(message.content);
    
    if (typeof Prism !== 'undefined') {
        Prism.highlightAllUnder(contentDiv);
    }
    
    const modal = document.getElementById('viewMessageModal');
    modal.style.display = 'block';
    setTimeout(() => modal.classList.add('visible'), 10);
}

function closeViewMessageModal() {
    const modal = document.getElementById('viewMessageModal');
    modal.classList.remove('visible');
    setTimeout(() => modal.style.display = 'none', 300);
}

async function deleteSavedMessage(messageId) {
    if (confirm('Are you sure you want to delete this saved message?')) {
        delete savedMessages[messageId];
        await dbDelete('saved_messages', messageId);
        loadSavedMessages();
    }
}
