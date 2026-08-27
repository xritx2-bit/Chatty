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

  // File Upload Elements
  const fileInput = $('#fileInput');
  const attachBtn = $('#attachBtn');
  const filePreviewContainer = $('#filePreviewContainer');
  const imagePreview = $('#imagePreview');
  const fileIconPreview = $('#fileIconPreview');
  const fileName = $('#fileName');
  const fileSize = $('#fileSize');
  const removeFileBtn = $('#removeFileBtn');

  // --------------- State ---------------
  let conversationHistory = [];
  let isGenerating = false;
  let currentController = null;
  let currentMedia = null; // { data: base64, mimeType: string, name: string, isImage: boolean }

  const MAX_FILE_SIZE = 3.5 * 1024 * 1024; // 3.5 MB limit for Vercel Hobby

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
    const hasMedia = currentMedia !== null;
    sendBtn.disabled = (!hasText && !hasMedia) || isGenerating;
  }

  function updateCharCount() {
    const len = messageInput.value.length;
    charCount.textContent = `${len.toLocaleString()} / 10,000`;
  }

  // --------------- Message Rendering ---------------

  function createMessageElement(role, content, isStreaming = false, media = null) {
    const div = document.createElement('div');
    div.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? '👤' : '⚛';

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    // Add media if present
    if (media && role === 'user') {
      const mediaContainer = document.createElement('div');
      
      if (media.isImage) {
        mediaContainer.className = 'message-media-container';
        const img = document.createElement('img');
        img.src = `data:${media.mimeType};base64,${media.data}`;
        mediaContainer.appendChild(img);
      } else {
        mediaContainer.className = 'message-file-attachment';
        mediaContainer.innerHTML = `
          <div class="message-file-icon">📄</div>
          <div class="message-file-name">${escapeHtml(media.name)}</div>
        `;
      }
      contentWrapper.appendChild(mediaContainer);
    }

    if (role === 'user') {
      if (content) {
        bubble.textContent = content;
        contentWrapper.appendChild(bubble);
      }
    } else {
      if (isStreaming) {
        bubble.innerHTML = '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
      } else {
        bubble.innerHTML = renderMarkdown(content);
      }
      contentWrapper.appendChild(bubble);
    }

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
    if ((!text.trim() && !currentMedia) || isGenerating) return;

    const userMessage = text.trim();
    isGenerating = true;
    updateSendButton();

    // Hide welcome screen
    hideWelcomeScreen();

    // Update title on first message
    if (conversationHistory.length === 0) {
      const titleText = userMessage || (currentMedia ? currentMedia.name : 'New Conversation');
      const shortTitle = titleText.length > 50
        ? titleText.substring(0, 50) + '...'
        : titleText;
      chatTitle.textContent = shortTitle;
    }

    // Add user message to DOM
    const userEl = createMessageElement('user', userMessage, false, currentMedia);
    messagesContainer.appendChild(userEl);
    scrollToBottom();

    // Add to history
    const historyEntry = { role: 'user', content: userMessage };
    if (currentMedia) {
      historyEntry.media = currentMedia;
    }
    conversationHistory.push(historyEntry);

    // Save media to send, then clear UI
    const mediaToSend = currentMedia;
    clearFile();

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

      const payload = {
        message: userMessage,
        history: conversationHistory.slice(0, -1).map(h => ({
          role: h.role,
          content: h.content,
          // Exclude media from history to save bandwidth, Gemini handles it poorly in history anyway
        }))
      };

      if (mediaToSend) {
        payload.media = {
          data: mediaToSend.data,
          mimeType: mediaToSend.mimeType
        };
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    clearFile();
    // Remove all messages
    const messages = messagesContainer.querySelectorAll('.message');
    messages.forEach((msg) => msg.remove());
    // Show welcome screen
    showWelcomeScreen();
    chatTitle.textContent = 'New Conversation';
    setStatus('Ready', 'online');
    messageInput.focus();
  }

  // --------------- File Handling Logic ---------------

  function clearFile() {
    currentMedia = null;
    fileInput.value = '';
    filePreviewContainer.style.display = 'none';
    imagePreview.src = '';
    updateSendButton();
    messageInput.focus();
  }

  attachBtn.addEventListener('click', () => {
    fileInput.click();
  });

  removeFileBtn.addEventListener('click', clearFile);

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert(`File is too large. Max size is 3.5 MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)} MB.`);
      clearFile();
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target.result.split(',')[1];
      const isImage = file.type.startsWith('image/');
      
      currentMedia = {
        data: base64Data,
        mimeType: file.type || 'text/plain',
        name: file.name,
        isImage: isImage
      };

      // Update UI
      fileName.textContent = file.name;
      fileSize.textContent = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
      
      if (isImage) {
        imagePreview.src = event.target.result;
        imagePreview.style.display = 'block';
        fileIconPreview.style.display = 'none';
      } else {
        imagePreview.style.display = 'none';
        fileIconPreview.style.display = 'flex';
      }

      filePreviewContainer.style.display = 'block';
      updateSendButton();
      messageInput.focus();
    };
    reader.readAsDataURL(file);
  });

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
