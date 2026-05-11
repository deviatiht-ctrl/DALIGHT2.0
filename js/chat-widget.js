/**
 * WhatsApp-Style Chat Widget
 * Real-time chat between clients and admin using Supabase
 */

import { getSupabase } from './main.js?v=5.0.0';

// Get Supabase client - but it might not be initialized yet
let supabase = getSupabase();
let currentUser = null;
let currentReservationId = null;
let chatSubscription = null;

// If supabase is not ready yet, wait for it
async function waitForSupabase() {
  let attempts = 0;
  while (!supabase && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    supabase = getSupabase();
    attempts++;
  }
  
  if (!supabase) {
    console.error('❌ Supabase failed to initialize in chat-widget');
    return false;
  }
  
  return true;
}

/**
 * Initialize chat widget
 */
export function initChatWidget() {
  const chatBubble = document.getElementById('chat-bubble');
  const chatWindow = document.getElementById('chat-window');
  const chatClose = document.getElementById('chat-close');
  const chatSend = document.getElementById('chat-send');
  const chatInput = document.getElementById('chat-input');

  if (!chatBubble || !chatWindow) {
    console.warn('⚠️ Chat widget elements not found');
    return;
  }

  console.log('✅ Chat widget initialized');

  // Toggle chat window
  chatBubble.addEventListener('click', async () => {
    const isVisible = chatWindow.style.display === 'flex';
    
    if (isVisible) {
      chatWindow.style.display = 'none';
      chatBubble.style.display = 'flex';
    } else {
      chatWindow.style.display = 'flex';
      chatBubble.style.display = 'none';
      console.log('💬 Opening chat, initializing...');
      await initializeChat();
    }
  });

  // Close chat
  if (chatClose) {
    chatClose.addEventListener('click', () => {
      chatWindow.style.display = 'none';
      chatBubble.style.display = 'flex';
    });
  }

  // Send message
  if (chatSend && chatInput) {
    chatSend.addEventListener('click', () => sendMessage());
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }
  
  // Export for external access
  window.ChatWidget = {
    open: async (options = {}) => {
      console.log('💬 Opening chat widget from external call', options);
      chatWindow.style.display = 'flex';
      chatBubble.style.display = 'none';
      await initializeChat();
      
      if (options.reservationId) {
        currentReservationId = options.reservationId;
        loadMessages();
      }
    },
    close: () => {
      chatWindow.style.display = 'none';
      chatBubble.style.display = 'flex';
    }
  };
}

/**
 * Initialize chat session
 */
async function initializeChat() {
  console.log('💬 Initializing chat...');
  
  // Wait for Supabase to be initialized
  const ready = await waitForSupabase();
  if (!ready) {
    console.error('❌ Supabase not available in chat');
    return;
  }
  
  console.log('✅ Supabase ready in chat');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('⚠️ No session found, showing login prompt');
      showLoginPrompt();
      return;
    }

    currentUser = session.user;
    console.log('👤 Current user:', currentUser.email);
    
    // Get user's most recent reservation for context
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('id, service, date')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (resError) {
      console.error('❌ Error fetching reservations:', resError);
    }

    if (reservations && reservations.length > 0) {
      currentReservationId = reservations[0].id;
      console.log('📋 Using reservation:', currentReservationId);
    } else {
      console.log('ℹ️ No reservations found, using email-based chat');
    }

    loadMessages();
    subscribeToMessages();
    updateOnlineStatus();
    
    console.log('✅ Chat initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing chat:', error);
    alert('Erè initializasyon chat: ' + error.message);
  }
}

/**
 * Load chat messages
 */
async function loadMessages() {
  if (!currentUser) {
    console.warn('⚠️ No user loaded yet');
    return;
  }
  
  // Wait for Supabase to be ready
  const ready = await waitForSupabase();
  if (!ready) {
    console.error('❌ Supabase not available for loading messages');
    return;
  }

  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) {
    console.error('❌ Chat messages container not found');
    return;
  }

  try {
    console.log('📥 Loading messages...');
    
    let query = supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true });

    // If user has a reservation, show messages for that reservation
    // Otherwise show messages where sender_email matches
    if (currentReservationId) {
      console.log('🔗 Filtering by reservation:', currentReservationId);
      query = query.eq('reservation_id', currentReservationId);
    } else {
      console.log('📧 Filtering by email:', currentUser.email);
      query = query.or(`sender_email.eq.${currentUser.email},receiver_email.eq.${currentUser.email}`);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('❌ Error fetching messages:', error);
      throw error;
    }

    console.log(`✅ Loaded ${messages?.length || 0} messages`);

    messagesContainer.innerHTML = '';
    
    if (!messages || messages.length === 0) {
      messagesContainer.innerHTML = `
        <div class="chat-empty">
          <p>👋 Bonjour! Comment pouvons-nous vous aider?</p>
        </div>
      `;
      return;
    }

    messages.forEach(msg => displayMessage(msg));
    scrollToBottom();
  } catch (error) {
    console.error('❌ Error loading messages:', error);
    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div class="chat-empty">
          <p>❌ Erè chajman message yo. Eseye ankò.</p>
        </div>
      `;
    }
  }
}

/**
 * Subscribe to real-time messages
 */
function subscribeToMessages() {
  if (!supabase || !currentUser) return;

  // Unsubscribe from previous subscription
  if (chatSubscription) {
    chatSubscription.unsubscribe();
  }

  let channel = supabase.channel('chat');

  if (currentReservationId) {
    channel = channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `reservation_id=eq.${currentReservationId}`,
      },
      (payload) => {
        displayMessage(payload.new);
        scrollToBottom();
        markAsRead(payload.new.id);
      }
    );
  } else {
    // Listen for messages to/from this user
    channel = channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      },
      (payload) => {
        const msg = payload.new;
        if (msg.sender_email === currentUser.email || 
            msg.sender_role === 'admin') {
          displayMessage(msg);
          scrollToBottom();
          markAsRead(msg.id);
        }
      }
    );
  }

  channel.subscribe();
  chatSubscription = channel;
}

/**
 * Send a message
 */
async function sendMessage() {
  const chatInput = document.getElementById('chat-input');
  
  // Wait for Supabase to be initialized
  const ready = await waitForSupabase();
  if (!ready) {
    console.error('❌ Supabase not available in chat');
    alert('Erè: Supabase pa konekte. Eseye ankò.');
    return;
  }
  
  if (!chatInput) {
    console.error('❌ Chat input not found');
    return;
  }
  
  if (!currentUser) {
    console.error('❌ User not authenticated');
    alert('Ou dwe konekte anvan ou ka voye message.');
    return;
  }

  const messageText = chatInput.value.trim();
  if (!messageText) {
    console.log('⚠️ Empty message');
    return;
  }

  console.log('📤 Sending message:', messageText);

  try {
    const { data, error } = await supabase.from('chat_messages').insert({
      reservation_id: currentReservationId,
      sender_id: currentUser.id,
      sender_email: currentUser.email,
      sender_role: 'client',
      message: messageText,
      is_read: false,
    }).select(); // Add .select() to get the inserted message back

    if (error) {
      console.error('❌ Insert error:', error);
      throw error;
    }
    
    console.log('✅ Message sent successfully:', data);

    // Clear input
    chatInput.value = '';
    
    // Display the message immediately
    if (data && data[0]) {
      displayMessage(data[0]);
      scrollToBottom();
    }
  } catch (error) {
    console.error('❌ Error sending message:', error);
    alert('Erreur lors de l\'envoi du message: ' + error.message);
  }
}

/**
 * Display a message in the chat
 */
function displayMessage(msg) {
  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;

  // Remove empty state if exists
  const emptyState = messagesContainer.querySelector('.chat-empty');
  if (emptyState) emptyState.remove();

  const isOwnMessage = msg.sender_email === currentUser?.email;

  const messageEl = document.createElement('div');
  messageEl.className = `chat-message ${isOwnMessage ? 'sent' : 'received'}`;
  
  const time = new Date(msg.created_at).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  messageEl.innerHTML = `
    <div class="message-content">
      <p>${escapeHtml(msg.message)}</p>
      <span class="message-time">${time}</span>
    </div>
  `;

  messagesContainer.appendChild(messageEl);
}

/**
 * Mark message as read
 */
async function markAsRead(messageId) {
  if (!supabase || !currentUser) return;

  await supabase
    .from('chat_messages')
    .update({ is_read: true })
    .eq('id', messageId)
    .eq('sender_role', 'admin'); // Only mark admin messages as read
}

/**
 * Scroll to bottom of messages
 */
function scrollToBottom() {
  const messagesContainer = document.getElementById('chat-messages');
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

/**
 * Update online status
 */
function updateOnlineStatus() {
  const statusEl = document.querySelector('.chat-status');
  if (!statusEl) return;

  // For now, always show online (can be enhanced with admin presence tracking)
  statusEl.textContent = 'En ligne';
  statusEl.classList.add('online');
}

/**
 * Show login prompt if user not authenticated
 */
function showLoginPrompt() {
  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;

  messagesContainer.innerHTML = `
    <div class="chat-empty">
      <p>🔒 Connectez-vous pour discuter avec nous</p>
      <a href="./login.html" class="chat-login-btn">Se connecter</a>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
