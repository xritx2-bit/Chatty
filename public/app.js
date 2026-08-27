/**
 * Chatty — Frontend Application
 * Handles chat logic, streaming, markdown rendering, and UI interactions.
 */

(function () {
  'use strict';

  // --------------- DOM Elements ---------------
  const $ = (sel) => document.querySelector(sel);
  const messagesContainer = $('#messagesContainer');
  const welcomeScreen = $('#welcomeScreen');
  const messageInput = $('#messageInput');
  const sendBtn = $('#sendBtn');
  const charCount = $('#charCount');
  const chatTitle = $('#chatTitle');
  const chatStatus = $('#chatStatus');
  const newChatBtn = $('#newChatBtn');
  const clearChatBtn = $('#clearChatBtn');
  const sidebar = $('#sidebar');
  const sidebarToggle = $('#sidebarToggle');
  const sidebarOverlay = $('#sidebarOverlay');

  // --------------- State ---------------
  let conversationHistory = [];
  let isGenerating = false;
  let currentController = null;

  // --------------- Marked Configuration ---------------
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      gfm: true,
      breaks: true,
      pedantic: false,
    });
  }

  // --------------- Utility Functions ---------------

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function renderMarkdown(text) {
    if (typeof marked !== 'undefined') {
      try {
        return marked.parse(text);
      } catch (e) {
        return escapeHtml(text).replace(/\n/g, '<br>');
      }
    }
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }

  function scrollToBottom(smooth = true) {
    messagesContainer.scrollTo({
      top: messagesContainer.scrollHeight,
      behavior: smooth ? 'smooth' : 'instant',
    });
  }

  function setStatus(text, type = 'online') {
    chatStatus.innerHTML = `<span class="status-dot ${type}"></span>${text}`;
  }

  function updateSendButton() {
    const hasText = messageInput.value.trim().length > 0;
    sendBtn.disabled = !hasText || isGenerating;
  }

  function updateCharCount() {
    const len = messageInput.value.length;
    charCount.textContent = `${len.toLocaleString()} / 10,000`;
  }

  // --------------- Message Rendering ---------------

  function createMessageElement(role, content, isStreaming = false) {
    const div = document.createElement('div');
    div.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? '👤' : '⚛';

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (role === 'user') {
      bubble.textContent = content;
    } else {
      if (isStreaming) {
        bubble.innerHTML = '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
      } else {
        bubble.innerHTML = renderMarkdown(content);
      }
    }

    contentWrapper.appendChild(bubble);
    div.appendChild(avatar);
    div.appendChild(contentWrapper);

    return div;
  }

  function hideWelcomeScreen() {
    if (welcomeScreen) {
      welcomeScreen.style.display = 'none';
    }
  }

  function showWelcomeScreen() {
    if (welcomeScreen) {
      welcomeScreen.style.display = '';
    }
  }

  // --------------- Chat Logic ---------------

  async function sendMessage(text) {
    if (!text.trim() || isGenerating) return;

    const userMessage = text.trim();
    isGenerating = true;
    updateSendButton();

    // Hide welcome screen
    hideWelcomeScreen();

    // Update title on first message
    if (conversationHistory.length === 0) {
      const shortTitle = userMessage.length > 50
        ? userMessage.substring(0, 50) + '...'
        : userMessage;
      chatTitle.textContent = shortTitle;
    }

    // Add user message to DOM
    const userEl = createMessageElement('user', userMessage);
    messagesContainer.appendChild(userEl);
    scrollToBottom();

    // Add to history
    conversationHistory.push({ role: 'user', content: userMessage });

    // Clear input
    messageInput.value = '';
    autoResize(messageInput);
    updateCharCount();
    updateSendButton();

    // Create assistant message placeholder
    const assistantEl = createMessageElement('assistant', '', true);
    messagesContainer.appendChild(assistantEl);
    scrollToBottom();

    const bubble = assistantEl.querySelector('.message-bubble');
    setStatus('Thinking...', 'thinking');

    try {
      currentController = new AbortController();

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: conversationHistory.slice(0, -1), // Exclude the message we just added
        }),
        signal: currentController.signal,
      });

      if (!response.ok) {
        let errorMsg = 'Something went wrong. Please try again.';
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {
          // Response wasn't JSON
        }
        throw new Error(errorMsg);
      }

      // Stream the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let isFirstChunk = true;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const text = decoder.decode(value, { stream: true });
        fullResponse += text;

        // Update bubble with rendered markdown
        if (isFirstChunk) {
          setStatus('Responding...', 'thinking');
          isFirstChunk = false;
        }

        bubble.innerHTML = renderMarkdown(fullResponse);
        scrollToBottom(false);
      }

      // Final render
      bubble.innerHTML = renderMarkdown(fullResponse);

      // Add to history
      conversationHistory.push({ role: 'assistant', content: fullResponse });

      setStatus('Ready', 'online');
    } catch (error) {
      if (error.name === 'AbortError') {
        bubble.innerHTML = '<em style="color: var(--text-tertiary);">Response cancelled.</em>';
        setStatus('Ready', 'online');
      } else {
        console.error('Chat error:', error);
        bubble.className = 'message-bubble error-bubble';
        bubble.innerHTML = `<strong>Error:</strong> ${escapeHtml(error.message)}`;
        setStatus('Error', 'online');
      }
    } finally {
      isGenerating = false;
      currentController = null;
      updateSendButton();
      scrollToBottom();
    }
  }

  function clearChat() {
    conversationHistory = [];
    // Remove all messages
    const messages = messagesContainer.querySelectorAll('.message');
    messages.forEach((msg) => msg.remove());
    // Show welcome screen
    showWelcomeScreen();
    chatTitle.textContent = 'New Conversation';
    setStatus('Ready', 'online');
    messageInput.focus();
  }

  // --------------- Event Listeners ---------------

  // Input handling
  messageInput.addEventListener('input', () => {
    autoResize(messageInput);
    updateCharCount();
    updateSendButton();
  });

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) {
        sendMessage(messageInput.value);
      }
    }
  });

  // Send button
  sendBtn.addEventListener('click', () => {
    sendMessage(messageInput.value);
  });

  // New chat
  newChatBtn.addEventListener('click', clearChat);
  clearChatBtn.addEventListener('click', clearChat);

  // Welcome cards
  document.querySelectorAll('.welcome-card').forEach((card) => {
    card.addEventListener('click', () => {
      const prompt = card.dataset.prompt;
      if (prompt) {
        messageInput.value = prompt;
        sendMessage(prompt);
      }
    });
  });

  // Topic chips
  document.querySelectorAll('.topic-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const prompt = chip.dataset.prompt;
      if (prompt) {
        messageInput.value = prompt;
        sendMessage(prompt);
        // Close sidebar on mobile
        closeSidebar();
      }
    });
  });

  // Mobile sidebar
  function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('visible');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('visible');
  }

  sidebarToggle.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  sidebarOverlay.addEventListener('click', closeSidebar);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape to cancel generation
    if (e.key === 'Escape' && isGenerating && currentController) {
      currentController.abort();
    }
    // Ctrl+Shift+N for new chat
    if (e.ctrlKey && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      clearChat();
    }
  });

  // --------------- Initialize ---------------
  messageInput.focus();
  updateSendButton();
  updateCharCount();
})();
