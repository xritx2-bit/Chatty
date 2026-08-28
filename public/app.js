/**
 * Chatty — Precision AI Study Buddy
 * Features:
 * - Google Account Sign-In & Email/Password Authentication (Firebase Auth)
 * - Real-time Cloud Synchronization with Firestore (Cross-Device Study Continuity)
 * - Multi-Session Chat History with Search, Renaming & Export
 * - Streaming Gemini 3.7 Flash responses via Express backend
 * - Blue Gradient & Editorial Sapphire aesthetic
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

// --------------- DOM Selectors ---------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Chat & UI elements
const messagesContainer = $('#messagesContainer');
const welcomeScreen = $('#welcomeScreen');
const messageInput = $('#messageInput');
const sendBtn = $('#sendBtn');
const charCount = $('#charCount');
const chatTitle = $('#chatTitle');
const chatStatusText = $('#chatStatusText');
const sidebar = $('#sidebar');
const sidebarToggle = $('#sidebarToggle');
const sidebarOverlay = $('#sidebarOverlay');

// History & Session Elements
const historySessionsList = $('#historySessionsList');
const historyEmptyState = $('#historyEmptyState');
const historyCountBadge = $('#historyCountBadge');
const historySearchInput = $('#historySearchInput');
const clearSearchBtn = $('#clearSearchBtn');
const sidebarNewChatBtn = $('#sidebarNewChatBtn');
const topNewChatBtn = $('#topNewChatBtn');
const clearAllHistoryBtn = $('#clearAllHistoryBtn');
const clearActiveChatBtn = $('#clearActiveChatBtn');
const renameSessionBtn = $('#renameSessionBtn');
const exportChatBtn = $('#exportChatBtn');
const manualSyncBtn = $('#manualSyncBtn');

// File Upload Elements
const fileInput = $('#fileInput');
const attachBtn = $('#attachBtn');
const filePreviewContainer = $('#filePreviewContainer');
const imagePreview = $('#imagePreview');
const fileIconPreview = $('#fileIconPreview');
const fileName = $('#fileName');
const fileSize = $('#fileSize');
const removeFileBtn = $('#removeFileBtn');

// Auth & Profile Header Elements
const navAuthBtn = $('#navAuthBtn');
const userAvatarWrap = $('#userAvatarWrap');
const userAvatarBtn = $('#userAvatarBtn');
const userAvatarImg = $('#userAvatarImg');
const userAvatarFallback = $('#userAvatarFallback');
const cloudSyncStatus = $('#cloudSyncStatus');
const syncStatusText = $('#syncStatusText');

// Sidebar User Elements
const sidebarUserCard = $('#sidebarUserCard');
const sidebarUserAvatar = $('#sidebarUserAvatar');
const sidebarUserName = $('#sidebarUserName');
const sidebarUserEmail = $('#sidebarUserEmail');
const sidebarAuthActionBtn = $('#sidebarAuthActionBtn');

// Modals
const authModal = $('#authModal');
const closeAuthModalBtn = $('#closeAuthModalBtn');
const googleSignInActionBtn = $('#googleSignInActionBtn');
const authEmailForm = $('#authEmailForm');
const authEmailInput = $('#authEmailInput');
const authPasswordInput = $('#authPasswordInput');
const emailSignInBtn = $('#emailSignInBtn');
const emailSignUpBtn = $('#emailSignUpBtn');
const authErrorMsg = $('#authErrorMsg');
const continueAsGuestBtn = $('#continueAsGuestBtn');

const userProfileModal = $('#userProfileModal');
const closeProfileModalBtn = $('#closeProfileModalBtn');
const modalUserAvatarLarge = $('#modalUserAvatarLarge');
const modalUserAvatarImg = $('#modalUserAvatarImg');
const modalUserAvatarText = $('#modalUserAvatarText');
const modalUserName = $('#modalUserName');
const modalUserEmail = $('#modalUserEmail');
const modalAuthProvider = $('#modalAuthProvider');
const statCloudSessionsCount = $('#statCloudSessionsCount');
const statTotalMessagesCount = $('#statTotalMessagesCount');
const statSyncStatusText = $('#statSyncStatusText');
const modalForceSyncBtn = $('#modalForceSyncBtn');
const signOutBtn = $('#signOutBtn');

const githubModal = $('#githubModal');
const githubInfoBtn = $('#githubInfoBtn');
const closeGithubModalBtn = $('#closeGithubModalBtn');
const modalOkBtn = $('#modalOkBtn');

const renameModal = $('#renameModal');
const renameSessionInput = $('#renameSessionInput');
const closeRenameModalBtn = $('#closeRenameModalBtn');
const cancelRenameBtn = $('#cancelRenameBtn');
const saveRenameBtn = $('#saveRenameBtn');

// Confirmation Modal (In-App Confirm Replacement)
const confirmModal = $('#confirmModal');
const confirmModalTitle = $('#confirmModalTitle');
const confirmModalSubtitle = $('#confirmModalSubtitle');
const confirmModalMessage = $('#confirmModalMessage');
const confirmModalCancelBtn = $('#confirmModalCancelBtn');
const confirmModalOkBtn = $('#confirmModalOkBtn');
const closeConfirmModalBtn = $('#closeConfirmModalBtn');

// Privacy Policy Modal
const privacyModal = $('#privacyModal');
const closePrivacyModalBtn = $('#closePrivacyModalBtn');
const privacyModalAcceptBtn = $('#privacyModalAcceptBtn');
const privacyPolicyBtn = $('#privacyPolicyBtn');
const sidebarPrivacyBtn = $('#sidebarPrivacyBtn');
const sidebarTermsBtn = $('#sidebarTermsBtn');

// Report AI Message Modal
const reportModal = $('#reportModal');
const closeReportModalBtn = $('#closeReportModalBtn');
const cancelReportBtn = $('#cancelReportBtn');
const submitReportBtn = $('#submitReportBtn');
const reportReasonSelect = $('#reportReasonSelect');
const reportDetailsInput = $('#reportDetailsInput');

// Account Deletion Button (Google Play Data Safety)
const deleteAccountBtn = $('#deleteAccountBtn');

// Toast
const toastNotification = $('#toastNotification');
const toastIcon = $('#toastIcon');
const toastMessage = $('#toastMessage');

// Hero CTAs
const heroStartBtn = $('#heroStartBtn');
const heroExamBtn = $('#heroExamBtn');

// --------------- Application State ---------------
const STORAGE_KEY = 'chatty_chat_sessions_v2';
let sessions = [];
let activeSessionId = null;
let isGenerating = false;
let currentController = null;
let currentMedia = null; // { data: base64, mimeType: string, name: string, isImage: boolean }
let renameTargetSessionId = null;
let toastTimeout = null;

// Firebase Auth & Firestore Instances
let firebaseApp = null;
let auth = null;
let db = null;
let currentUser = null;
let firestoreUnsubscribe = null;
let isSyncingToCloud = false;

const MAX_FILE_SIZE = 3.5 * 1024 * 1024; // 3.5 MB

// --------------- Marked Configuration ---------------
if (typeof marked !== 'undefined') {
  marked.setOptions({
    gfm: true,
    breaks: true,
    pedantic: false,
  });
}

// --------------- Toast Notification Utility ---------------
function showToast(message, icon = '☁️', duration = 3200) {
  if (!toastNotification) return;
  if (toastTimeout) clearTimeout(toastTimeout);
  toastIcon.textContent = icon;
  toastMessage.textContent = message;
  toastNotification.style.display = 'flex';
  toastTimeout = setTimeout(() => {
    toastNotification.style.display = 'none';
  }, duration);
}

// --------------- In-App Confirmation Modal Manager (Replaces blocked window.confirm) ---------------
let pendingConfirmCallback = null;

function openConfirmDialog({
  title = 'Confirm Action',
  subtitle = 'Please confirm to proceed.',
  message = 'Are you sure?',
  okText = 'Confirm',
  isDanger = true,
  onConfirm = null,
}) {
  if (!confirmModal) return;
  confirmModalTitle.textContent = title;
  confirmModalSubtitle.textContent = subtitle;
  confirmModalMessage.textContent = message;
  confirmModalOkBtn.textContent = okText;

  if (isDanger) {
    confirmModalOkBtn.className = 'confirm-danger-btn';
  } else {
    confirmModalOkBtn.className = 'auth-primary-btn';
  }

  pendingConfirmCallback = onConfirm;
  confirmModal.style.display = 'flex';
}

function closeConfirmDialog() {
  if (confirmModal) {
    confirmModal.style.display = 'none';
  }
  pendingConfirmCallback = null;
}

// --------------- Background Bokeh Generation ---------------
function initBokeh() {
  const container = $('#bokehContainer');
  if (!container) return;
  container.innerHTML = '';
  const count = 18;
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    dot.className = 'bokeh-dot';
    const size = Math.random() * 28 + 8;
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.left = `${Math.random() * 100}%`;
    dot.style.top = `${Math.random() * 100}%`;
    dot.style.animationDuration = `${Math.random() * 14 + 10}s`;
    dot.style.animationDelay = `${Math.random() * 5}s`;
    dot.style.opacity = (Math.random() * 0.35 + 0.1).toFixed(2);
    container.appendChild(dot);
  }
}

// --------------- Firebase & Cloud Sync Initialization ---------------
function initFirebase() {
  try {
    firebaseApp = initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
    // Custom database ID support if configured
    if (firebaseConfig.firestoreDatabaseId) {
      db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    } else {
      db = getFirestore(firebaseApp);
    }

    onAuthStateChanged(auth, (user) => {
      handleAuthStateChanged(user);
    });
  } catch (err) {
    console.error('Firebase initialization error:', err);
    updateSyncStatusUI('offline', 'Sync Offline');
  }
}

function handleAuthStateChanged(user) {
  currentUser = user;

  if (user) {
    // Logged in
    updateUserInterfaceLoggedIn(user);
    subscribeToUserFirestore(user.uid);
    showToast(`Signed in as ${user.displayName || user.email}. Cloud sync active!`, '✓');
  } else {
    // Guest mode
    if (firestoreUnsubscribe) {
      firestoreUnsubscribe();
      firestoreUnsubscribe = null;
    }
    updateUserInterfaceLoggedOut();
    loadSessionsFromLocalStorage();
    renderHistoryList();
    if (sessions.length > 0) {
      if (!sessions.some((s) => s.id === activeSessionId)) {
        activeSessionId = sessions[0].id;
      }
      loadSessionIntoUI(activeSessionId);
    }
  }
}

function updateUserInterfaceLoggedIn(user) {
  const name = user.displayName || user.email.split('@')[0] || 'Student';
  const email = user.email || 'Google User';
  const photo = user.photoURL;

  // Top Nav UI
  navAuthBtn.style.display = 'none';
  userAvatarWrap.style.display = 'flex';

  if (photo) {
    userAvatarImg.src = photo;
    userAvatarImg.style.display = 'block';
    userAvatarFallback.style.display = 'none';
  } else {
    userAvatarImg.style.display = 'none';
    userAvatarFallback.textContent = name.charAt(0).toUpperCase();
    userAvatarFallback.style.display = 'block';
  }

  // Sidebar User Card
  sidebarUserName.textContent = name;
  sidebarUserEmail.textContent = email;
  if (photo) {
    sidebarUserAvatar.innerHTML = `<img src="${photo}" alt="${name}">`;
  } else {
    sidebarUserAvatar.innerHTML = `<span>${name.charAt(0).toUpperCase()}</span>`;
  }

  // Sync Indicator
  updateSyncStatusUI('active', 'Cloud Synced');

  // Profile Modal Elements
  modalUserName.textContent = name;
  modalUserEmail.textContent = email;
  modalAuthProvider.textContent = user.providerData && user.providerData[0]
    ? (user.providerData[0].providerId === 'google.com' ? 'Google Account' : 'Email Account')
    : 'Authenticated';

  if (photo) {
    modalUserAvatarImg.src = photo;
    modalUserAvatarImg.style.display = 'block';
    modalUserAvatarText.style.display = 'none';
  } else {
    modalUserAvatarImg.style.display = 'none';
    modalUserAvatarText.textContent = name.charAt(0).toUpperCase();
    modalUserAvatarText.style.display = 'block';
  }
}

function updateUserInterfaceLoggedOut() {
  navAuthBtn.style.display = 'inline-flex';
  userAvatarWrap.style.display = 'none';

  sidebarUserName.textContent = 'Guest Student';
  sidebarUserEmail.textContent = 'Sign in to sync across devices';
  sidebarUserAvatar.innerHTML = `<span>👤</span>`;

  updateSyncStatusUI('offline', 'Local Only');
}

function updateSyncStatusUI(state, text) {
  if (!cloudSyncStatus) return;
  cloudSyncStatus.className = `cloud-sync-status ${state}`;
  syncStatusText.textContent = text;
}

// --------------- Cloud Firestore Sync Engine ---------------

function subscribeToUserFirestore(userId) {
  if (!db || !userId) return;

  try {
    updateSyncStatusUI('syncing', 'Syncing...');
    const sessionsCol = collection(db, 'users', userId, 'sessions');
    const q = query(sessionsCol, orderBy('updatedAt', 'desc'));

    firestoreUnsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const cloudSessions = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          cloudSessions.push({
            id: docSnap.id,
            title: data.title || 'Study Session',
            createdAt: data.createdAt ? (data.createdAt.toMillis ? data.createdAt.toMillis() : data.createdAt) : Date.now(),
            updatedAt: data.updatedAt ? (data.updatedAt.toMillis ? data.updatedAt.toMillis() : data.updatedAt) : Date.now(),
            messages: Array.isArray(data.messages) ? data.messages : [],
          });
        });

        // If cloud has sessions, merge or set
        if (cloudSessions.length > 0) {
          sessions = cloudSessions;
          saveSessionsToLocalStorageOnly();
          if (!activeSessionId || !sessions.some((s) => s.id === activeSessionId)) {
            activeSessionId = sessions[0].id;
          }
          loadSessionIntoUI(activeSessionId);
          renderHistoryList();
        } else if (sessions.length > 0) {
          // If user had local sessions before signing in, push them to cloud!
          pushLocalSessionsToCloud(userId);
        } else {
          // Both empty: create a new session
          createNewSession();
        }

        updateSyncStatusUI('active', 'Cloud Synced');
        updateStatsModal();
      },
      (error) => {
        console.error('Firestore subscription error:', error);
        updateSyncStatusUI('offline', 'Sync Error');
      }
    );
  } catch (err) {
    console.error('Failed to setup Firestore listener:', err);
    updateSyncStatusUI('offline', 'Sync Error');
  }
}

async function pushLocalSessionsToCloud(userId) {
  if (!db || !userId) return;
  try {
    updateSyncStatusUI('syncing', 'Uploading...');
    for (const session of sessions) {
      await saveSessionToCloud(session);
    }
    updateSyncStatusUI('active', 'Cloud Synced');
    showToast('Local conversations uploaded to your Google cloud profile', '☁️');
  } catch (e) {
    console.error('Error syncing local data to cloud:', e);
  }
}

async function saveSessionToCloud(session) {
  if (!db || !currentUser) return;
  try {
    const sessionDocRef = doc(db, 'users', currentUser.uid, 'sessions', session.id);
    // Sanitize message payloads (avoid undefined)
    const sanitizedMessages = (session.messages || []).map((m) => ({
      role: m.role || 'user',
      content: m.content || '',
      timestamp: m.timestamp || Date.now(),
      ...(m.media ? { media: { name: m.media.name || '', mimeType: m.media.mimeType || '', isImage: !!m.media.isImage } } : {}),
    }));

    await setDoc(
      sessionDocRef,
      {
        title: session.title || 'Study Session',
        createdAt: session.createdAt || Date.now(),
        updatedAt: session.updatedAt || Date.now(),
        messages: sanitizedMessages,
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Failed to write session to Firestore:', err);
  }
}

async function deleteSessionFromCloud(sessionId) {
  if (!db || !currentUser) return;
  try {
    const sessionDocRef = doc(db, 'users', currentUser.uid, 'sessions', sessionId);
    await deleteDoc(sessionDocRef);
  } catch (err) {
    console.error('Failed to delete session from Firestore:', err);
  }
}

// --------------- Local Storage & Session State ---------------

function loadSessionsFromLocalStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      sessions = JSON.parse(data);
      if (!Array.isArray(sessions)) sessions = [];
    } else {
      sessions = [];
    }
  } catch (e) {
    console.warn('Failed to parse saved sessions from localStorage:', e);
    sessions = [];
  }
}

function saveSessionsToLocalStorageOnly() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

function saveSessionState(session) {
  saveSessionsToLocalStorageOnly();
  renderHistoryList(historySearchInput ? historySearchInput.value : '');
  if (currentUser && session) {
    saveSessionToCloud(session);
  }
}

function createNewSession(initialTitle = 'New Conversation') {
  const newSession = {
    id: 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    title: initialTitle,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
  sessions.unshift(newSession);
  activeSessionId = newSession.id;
  saveSessionState(newSession);
  loadSessionIntoUI(activeSessionId);
  return newSession;
}

function getActiveSession() {
  return sessions.find((s) => s.id === activeSessionId);
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function renderHistoryList(filterQuery = '') {
  const query = filterQuery.trim().toLowerCase();
  const filtered = query
    ? sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(query) ||
          (s.messages && s.messages.some((m) => m.content.toLowerCase().includes(query)))
      )
    : sessions;

  historyCountBadge.textContent = `${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}`;

  if (filtered.length === 0) {
    historySessionsList.innerHTML = '';
    historyEmptyState.style.display = 'flex';
    return;
  }

  historyEmptyState.style.display = 'none';
  historySessionsList.innerHTML = '';

  filtered.forEach((session) => {
    const item = document.createElement('div');
    item.className = `history-item ${session.id === activeSessionId ? 'active' : ''}`;
    item.setAttribute('data-id', session.id);

    const msgCount = session.messages ? session.messages.length : 0;

    item.innerHTML = `
      <div class="history-item-left">
        <div class="history-item-title" title="${escapeHtml(session.title)}">${escapeHtml(session.title)}</div>
        <div class="history-item-meta">
          <span>${formatTime(session.updatedAt || session.createdAt)}</span>
          <span>&middot;</span>
          <span>${msgCount} ${msgCount === 1 ? 'msg' : 'msgs'}</span>
        </div>
      </div>
      <div class="history-item-actions">
        <button class="history-action-btn edit-btn" title="Rename conversation" data-action="rename" data-id="${session.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="history-action-btn delete-btn" title="Delete conversation" data-action="delete" data-id="${session.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    item.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        const action = actionBtn.getAttribute('data-action');
        const sid = actionBtn.getAttribute('data-id');
        if (action === 'rename') {
          e.stopPropagation();
          openRenameModal(sid);
        } else if (action === 'delete') {
          e.stopPropagation();
          deleteSession(sid);
        }
        return;
      }

      switchSession(session.id);
      if (window.innerWidth <= 768) {
        closeSidebar();
      }
    });

    historySessionsList.appendChild(item);
  });
}

function switchSession(sessionId) {
  if (activeSessionId === sessionId) return;
  if (isGenerating && currentController) {
    currentController.abort();
    isGenerating = false;
  }
  activeSessionId = sessionId;
  loadSessionIntoUI(sessionId);
  renderHistoryList(historySearchInput.value);
}

function deleteSession(sessionId) {
  const session = sessions.find((s) => s.id === sessionId);
  const title = session ? session.title : 'this session';

  openConfirmDialog({
    title: 'Delete Conversation?',
    subtitle: 'This will remove the chat from local and cloud history.',
    message: `Are you sure you want to delete "${title}"? This action cannot be undone.`,
    okText: 'Delete',
    isDanger: true,
    onConfirm: async () => {
      sessions = sessions.filter((s) => s.id !== sessionId);

      if (currentUser) {
        await deleteSessionFromCloud(sessionId);
      }

      saveSessionsToLocalStorageOnly();

      if (activeSessionId === sessionId) {
        if (sessions.length > 0) {
          activeSessionId = sessions[0].id;
          loadSessionIntoUI(activeSessionId);
        } else {
          createNewSession();
        }
      }

      renderHistoryList(historySearchInput ? historySearchInput.value : '');
      showToast('Conversation deleted', '🗑️');
    },
  });
}

function loadSessionIntoUI(sessionId) {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;

  chatTitle.textContent = session.title || 'New Conversation';

  // Clear messages area
  messagesContainer.innerHTML = '';

  if (!session.messages || session.messages.length === 0) {
    welcomeScreen.style.display = 'flex';
    messagesContainer.appendChild(welcomeScreen);
  } else {
    welcomeScreen.style.display = 'none';
    session.messages.forEach((msg) => {
      const el = createMessageElement(msg.role, msg.content, false, msg.media, msg.timestamp);
      messagesContainer.appendChild(el);
    });
    scrollToBottom();
  }

  renderHistoryList(historySearchInput ? historySearchInput.value : '');
}

// --------------- Markdown & Formatting Helper ---------------
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarkdown(rawText) {
  if (!rawText) return '';
  if (typeof marked !== 'undefined') {
    try {
      return marked.parse(rawText);
    } catch (e) {
      console.warn('Marked parse error:', e);
      return escapeHtml(rawText).replace(/\n/g, '<br>');
    }
  }
  return escapeHtml(rawText).replace(/\n/g, '<br>');
}

function createMessageElement(role, content, isStreaming = false, media = null, timestamp = null) {
  const div = document.createElement('div');
  div.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'user' ? '👤' : '⚛';

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'message-content';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  // Media attachment preview for user message
  if (media && role === 'user') {
    if (media.isImage && media.data) {
      const mediaContainer = document.createElement('div');
      mediaContainer.className = 'message-media-container';
      const img = document.createElement('img');
      img.src = `data:${media.mimeType};base64,${media.data}`;
      img.alt = media.name || 'Attached Image';
      mediaContainer.appendChild(img);
      bubble.appendChild(mediaContainer);
    } else if (media.name) {
      const fileBadge = document.createElement('div');
      fileBadge.className = 'message-file-badge';
      fileBadge.innerHTML = `<span>📄</span> <strong>${escapeHtml(media.name)}</strong>`;
      bubble.appendChild(fileBadge);
    }
  }

  const textDiv = document.createElement('div');
  textDiv.className = 'message-text';

  if (isStreaming) {
    textDiv.innerHTML = renderMarkdown(content) + '<span class="typing-cursor"></span>';
  } else {
    textDiv.innerHTML = renderMarkdown(content);
  }
  bubble.appendChild(textDiv);

  // Meta footer
  const meta = document.createElement('div');
  meta.className = 'message-meta';

  const timeSpan = document.createElement('span');
  timeSpan.className = 'message-time';
  timeSpan.textContent = formatTime(timestamp || Date.now());
  meta.appendChild(timeSpan);

  if (role === 'model' && !isStreaming) {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'message-copy-btn';
    copyBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span>Copy</span>
    `;
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(content).then(() => {
        copyBtn.innerHTML = `<span>✓ Copied</span>`;
        setTimeout(() => {
          copyBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy</span>
          `;
        }, 2000);
      });
    });
    meta.appendChild(copyBtn);

    const reportBtn = document.createElement('button');
    reportBtn.className = 'message-report-btn';
    reportBtn.title = 'Report inaccurate or unsafe AI content';
    reportBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>Report</span>
    `;
    reportBtn.addEventListener('click', () => {
      openReportModal(content);
    });
    meta.appendChild(reportBtn);
  }

  contentWrapper.appendChild(bubble);
  contentWrapper.appendChild(meta);

  div.appendChild(avatar);
  div.appendChild(contentWrapper);

  return div;
}

// Auto-name untitled session based on the first prompt
function autoTitleSession(session, text) {
  if (!session || (session.title && session.title !== 'New Conversation' && session.title !== 'Untitled Session')) return;
  const clean = text.replace(/^[#\s*]+/, '').trim();
  let title = clean.split('\n')[0].slice(0, 45);
  if (clean.length > 45) title += '...';
  session.title = title || 'Study Session';
  chatTitle.textContent = session.title;
  saveSessionState(session);
}

// --------------- Send Message & Streaming Flow ---------------

async function sendMessage(textToSend = null) {
  const text = (textToSend !== null ? textToSend : messageInput.value).trim();
  const mediaToSend = currentMedia;

  if ((!text && !mediaToSend) || isGenerating) return;

  let session = getActiveSession();
  if (!session) {
    session = createNewSession();
  }

  // Hide welcome screen
  welcomeScreen.style.display = 'none';

  // Auto-generate title if this is the first message
  if (session.messages.length === 0 && text) {
    autoTitleSession(session, text);
  }

  // Add user message to state & UI
  const userMsg = {
    role: 'user',
    content: text,
    media: mediaToSend ? { ...mediaToSend } : null,
    timestamp: Date.now(),
  };
  session.messages.push(userMsg);
  session.updatedAt = Date.now();

  const userElem = createMessageElement('user', text, false, mediaToSend, userMsg.timestamp);
  messagesContainer.appendChild(userElem);

  // Clear input & media
  messageInput.value = '';
  autoResize(messageInput);
  clearCurrentMedia();
  updateSendButton();
  updateCharCount();
  scrollToBottom();

  // Prepare model streaming placeholder
  isGenerating = true;
  updateSendButton();
  setStatus('Thinking...');

  const modelElem = createMessageElement('model', '', true, null, Date.now());
  messagesContainer.appendChild(modelElem);
  const modelTextDiv = modelElem.querySelector('.message-text');
  scrollToBottom();

  currentController = new AbortController();
  let fullResponse = '';

  try {
    // Build history for backend
    const historyPayload = session.messages.slice(0, -1).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const bodyPayload = {
      message: text,
      history: historyPayload,
    };

    if (mediaToSend) {
      bodyPayload.media = {
        data: mediaToSend.data,
        mimeType: mediaToSend.mimeType,
      };
    }

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: currentController.signal,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(errData.error || `Server responded with status ${res.status}`);
    }

    setStatus('Generating...');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      fullResponse += chunk;
      modelTextDiv.innerHTML = renderMarkdown(fullResponse) + '<span class="typing-cursor"></span>';
      scrollToBottom();
    }

    // Finalize Model Message
    modelTextDiv.innerHTML = renderMarkdown(fullResponse);
    const cursor = modelElem.querySelector('.typing-cursor');
    if (cursor) cursor.remove();

    const modelMsg = {
      role: 'model',
      content: fullResponse,
      timestamp: Date.now(),
    };
    session.messages.push(modelMsg);
    session.updatedAt = Date.now();
    saveSessionState(session);

    // Refresh message element with final copy button
    const finalizedElem = createMessageElement('model', fullResponse, false, null, modelMsg.timestamp);
    messagesContainer.replaceChild(finalizedElem, modelElem);

    setStatus('Ready');
  } catch (err) {
    if (err.name === 'AbortError') {
      modelTextDiv.innerHTML = renderMarkdown(fullResponse + '\n\n*(Generation stopped)*');
      if (fullResponse) {
        session.messages.push({
          role: 'model',
          content: fullResponse + ' *(stopped)*',
          timestamp: Date.now(),
        });
        session.updatedAt = Date.now();
        saveSessionState(session);
      }
    } else {
      console.error('Chat error:', err);
      let displayError = err.message || 'An unexpected error occurred.';
      try {
        if (displayError.includes('{') && displayError.includes('}')) {
          const match = displayError.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.error?.message) {
              displayError = parsed.error.message;
              if (typeof displayError === 'string' && displayError.includes('{')) {
                try {
                  const inner = JSON.parse(displayError);
                  if (inner.error?.message) displayError = inner.error.message;
                } catch (_) {}
              }
            }
          }
        }
      } catch (_) {}

      modelTextDiv.innerHTML = `
        <div style="color: #f87171; padding: 8px 0; font-size: 14px; line-height: 1.5;">
          <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
            <span>⚠️</span>
            <span><strong>Connection Note:</strong> ${escapeHtml(displayError)}</span>
          </div>
          <button class="modal-action-btn" style="padding: 6px 14px; font-size: 12px; margin-top: 4px;" onclick="window.retryLastMessage && window.retryLastMessage()">
            🔄 Retry Question
          </button>
        </div>
      `;
    }
    setStatus('Ready');
  } finally {
    isGenerating = false;
    currentController = null;
    updateSendButton();
    scrollToBottom();
  }
}

// Retry helper for connection error blocks
window.retryLastMessage = function () {
  const session = getActiveSession();
  if (!session || session.messages.length === 0) return;
  // Find last user message
  const userMsgs = session.messages.filter((m) => m.role === 'user');
  if (userMsgs.length === 0) return;
  const lastUserMsg = userMsgs[userMsgs.length - 1];
  // Pop the last user message from state so sendMessage will re-add and re-send it
  const idx = session.messages.lastIndexOf(lastUserMsg);
  if (idx !== -1) {
    session.messages.splice(idx);
    saveSessionState(session);
    loadSessionIntoUI(session.id);
  }
  sendMessage(lastUserMsg.content);
};

// --------------- File Handling ---------------

function handleFileSelect(file) {
  if (!file) return;

  if (file.size > MAX_FILE_SIZE) {
    alert(`File size exceeds 3.5 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB). Please select a smaller file.`);
    fileInput.value = '';
    return;
  }

  const reader = new FileReader();
  const isImage = file.type.startsWith('image/');

  reader.onload = function (e) {
    const base64Data = e.target.result.split(',')[1];
    currentMedia = {
      data: base64Data,
      mimeType: file.type || 'application/octet-stream',
      name: file.name,
      size: file.size,
      isImage: isImage,
    };

    fileName.textContent = file.name;
    fileSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;

    if (isImage) {
      imagePreview.src = e.target.result;
      imagePreview.style.display = 'block';
      fileIconPreview.style.display = 'none';
    } else {
      imagePreview.style.display = 'none';
      fileIconPreview.style.display = 'block';
    }

    filePreviewContainer.style.display = 'flex';
    updateSendButton();
    messageInput.focus();
  };

  reader.readAsDataURL(file);
}

function clearCurrentMedia() {
  currentMedia = null;
  fileInput.value = '';
  filePreviewContainer.style.display = 'none';
  imagePreview.src = '';
  updateSendButton();
}

// --------------- UI Helpers & Modals ---------------

function setStatus(text) {
  if (chatStatusText) chatStatusText.textContent = text;
}

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
}

function updateSendButton() {
  const hasText = messageInput.value.trim().length > 0;
  const hasMedia = currentMedia !== null;
  sendBtn.disabled = (!hasText && !hasMedia) || isGenerating;
}

function updateCharCount() {
  const len = messageInput.value.length;
  charCount.textContent = `${len.toLocaleString()} / 10,000`;
  if (len > 9000) {
    charCount.style.color = '#f87171';
  } else {
    charCount.style.color = '';
  }
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('active');
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('active');
}

// Modals: Rename
function openRenameModal(sessionId) {
  renameTargetSessionId = sessionId;
  const session = sessions.find((s) => s.id === sessionId);
  if (session) {
    renameSessionInput.value = session.title;
    renameModal.style.display = 'flex';
    setTimeout(() => {
      renameSessionInput.focus();
      renameSessionInput.select();
    }, 50);
  }
}

function closeRenameModal() {
  renameModal.style.display = 'none';
  renameTargetSessionId = null;
}

function saveRename() {
  if (!renameTargetSessionId) return;
  const newTitle = renameSessionInput.value.trim();
  if (!newTitle) return;

  const session = sessions.find((s) => s.id === renameTargetSessionId);
  if (session) {
    session.title = newTitle;
    session.updatedAt = Date.now();
    saveSessionState(session);
    if (activeSessionId === session.id) {
      chatTitle.textContent = newTitle;
    }
  }
  closeRenameModal();
}

// Modals: GitHub
function openGithubModal() {
  githubModal.style.display = 'flex';
}

function closeGithubModal() {
  githubModal.style.display = 'none';
}

// Modals: Auth Modal
function openAuthModal() {
  authErrorMsg.style.display = 'none';
  authErrorMsg.textContent = '';
  authModal.style.display = 'flex';
}

function closeAuthModal() {
  authModal.style.display = 'none';
}

// Modals: User Profile
function openProfileModal() {
  updateStatsModal();
  userProfileModal.style.display = 'flex';
}

function closeProfileModal() {
  userProfileModal.style.display = 'none';
}

function updateStatsModal() {
  if (!currentUser) return;
  statCloudSessionsCount.textContent = sessions.length;
  const totalMsgs = sessions.reduce((acc, s) => acc + (s.messages ? s.messages.length : 0), 0);
  statTotalMessagesCount.textContent = totalMsgs;
  statSyncStatusText.textContent = 'Active (Live)';
}

// Modals: Privacy Policy
function openPrivacyModal() {
  if (privacyModal) privacyModal.style.display = 'flex';
}

function closePrivacyModal() {
  if (privacyModal) privacyModal.style.display = 'none';
}

// Modals: Report AI Response
let currentReportContent = '';

function openReportModal(content) {
  currentReportContent = content || '';
  if (reportDetailsInput) reportDetailsInput.value = '';
  if (reportModal) reportModal.style.display = 'flex';
}

function closeReportModal() {
  if (reportModal) reportModal.style.display = 'none';
  currentReportContent = '';
}

function handleReportSubmit() {
  const reason = reportReasonSelect ? reportReasonSelect.value : 'other';
  const details = reportDetailsInput ? reportDetailsInput.value.trim() : '';
  
  console.log('AI Content Report Submitted:', {
    reason,
    details,
    snippet: currentReportContent.slice(0, 100),
    timestamp: new Date().toISOString()
  });

  closeReportModal();
  showToast('Thank you. Feedback submitted for academic moderation.', '🛡️');
}

// Export conversation as Markdown
function exportCurrentConversation() {
  const session = getActiveSession();
  if (!session || session.messages.length === 0) {
    showToast('No messages in this conversation to export.', 'ℹ️');
    return;
  }

  let mdContent = `# ${session.title}\n*Exported from Chatty AI on ${new Date().toLocaleString()}*\n\n---\n\n`;
  session.messages.forEach((msg) => {
    const roleName = msg.role === 'user' ? '👤 Student' : '⚛ Chatty AI Tutor';
    mdContent += `### ${roleName} (${formatTime(msg.timestamp)})\n\n${msg.content}\n\n---\n\n`;
  });

  const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${session.title.replace(/[^a-z0-9_-]/gi, '_')}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --------------- Authentication Handlers (Google & Email) ---------------

async function handleGoogleSignIn() {
  if (!auth) {
    showToast('Firebase Authentication is not yet configured. Please check network setup.', '⚠️');
    return;
  }
  const provider = new GoogleAuthProvider();
  try {
    authErrorMsg.style.display = 'none';
    googleSignInActionBtn.disabled = true;
    googleSignInActionBtn.style.opacity = '0.7';

    await signInWithPopup(auth, provider);
    closeAuthModal();
  } catch (error) {
    console.error('Google Sign-In failed:', error);
    authErrorMsg.style.display = 'block';
    if (error.code === 'auth/unauthorized-domain') {
      authErrorMsg.innerHTML = `⚠️ <strong>Domain Not Authorized:</strong> Please add <code>${window.location.hostname}</code> to your Firebase Console under <strong>Authentication &rarr; Settings &rarr; Authorized domains</strong>.`;
    } else if (error.code === 'auth/popup-blocked') {
      authErrorMsg.textContent = 'Popup was blocked by your browser. Please allow popups for this site and try again.';
    } else if (error.code === 'auth/popup-closed-by-user') {
      authErrorMsg.textContent = 'Sign-in window was closed before completing.';
    } else {
      authErrorMsg.textContent = error.message ? error.message.replace('Firebase: ', '') : 'Google sign-in failed.';
    }
  } finally {
    googleSignInActionBtn.disabled = false;
    googleSignInActionBtn.style.opacity = '1';
  }
}

async function handleEmailSignIn(e) {
  if (e) e.preventDefault();
  if (!auth) return;

  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;

  if (!email || !password) {
    authErrorMsg.style.display = 'block';
    authErrorMsg.textContent = 'Please enter both your student email and password.';
    return;
  }

  try {
    authErrorMsg.style.display = 'none';
    emailSignInBtn.disabled = true;
    await signInWithEmailAndPassword(auth, email, password);
    closeAuthModal();
  } catch (error) {
    console.error('Email sign-in failed:', error);
    authErrorMsg.style.display = 'block';
    authErrorMsg.textContent = error.message.replace('Firebase: ', '');
  } finally {
    emailSignInBtn.disabled = false;
  }
}

async function handleEmailSignUp() {
  if (!auth) return;

  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;

  if (!email || !password) {
    authErrorMsg.style.display = 'block';
    authErrorMsg.textContent = 'Please enter an email and a secure password (min 6 characters).';
    return;
  }

  try {
    authErrorMsg.style.display = 'none';
    emailSignUpBtn.disabled = true;
    await createUserWithEmailAndPassword(auth, email, password);
    closeAuthModal();
  } catch (error) {
    console.error('Email sign-up failed:', error);
    authErrorMsg.style.display = 'block';
    authErrorMsg.textContent = error.message.replace('Firebase: ', '');
  } finally {
    emailSignUpBtn.disabled = false;
  }
}

async function handleSignOut() {
  if (!auth) return;
  try {
    await signOut(auth);
    closeProfileModal();
    showToast('Signed out. Continuing in local guest mode.', 'ℹ️');
  } catch (error) {
    console.error('Sign out error:', error);
  }
}

// --------------- Event Listeners Binding ---------------

function setupEventListeners() {
  // Textarea input & keybindings
  messageInput.addEventListener('input', () => {
    autoResize(messageInput);
    updateSendButton();
    updateCharCount();
  });

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', () => sendMessage());

  // Attachments
  attachBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  });
  removeFileBtn.addEventListener('click', clearCurrentMedia);

  // Drag & drop into chat
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  // History Actions
  sidebarNewChatBtn.addEventListener('click', () => {
    createNewSession();
    if (window.innerWidth <= 768) closeSidebar();
  });

  topNewChatBtn.addEventListener('click', () => {
    createNewSession();
  });

  clearActiveChatBtn.addEventListener('click', () => {
    const session = getActiveSession();
    if (!session || !session.messages || session.messages.length === 0) {
      showToast('No messages to clear in this conversation.', 'ℹ️');
      return;
    }
    openConfirmDialog({
      title: 'Clear Active Chat?',
      subtitle: 'Remove messages in current conversation.',
      message: `Are you sure you want to clear all messages in "${escapeHtml(session.title)}"? The session title will remain in your history.`,
      okText: 'Clear Messages',
      isDanger: true,
      onConfirm: () => {
        session.messages = [];
        session.updatedAt = Date.now();
        saveSessionState(session);
        loadSessionIntoUI(activeSessionId);
        showToast('Messages cleared', '🧹');
      },
    });
  });

  clearAllHistoryBtn.addEventListener('click', () => {
    if (sessions.length === 0) {
      showToast('No chat history to clear.', 'ℹ️');
      return;
    }
    openConfirmDialog({
      title: 'Clear All Chat History?',
      subtitle: 'Permanently remove all conversations.',
      message: 'Are you sure you want to clear ALL saved conversations from both this device and your Cloud account? This action cannot be undone.',
      okText: 'Clear All History',
      isDanger: true,
      onConfirm: async () => {
        if (currentUser) {
          for (const s of sessions) {
            await deleteSessionFromCloud(s.id);
          }
        }
        sessions = [];
        localStorage.removeItem(STORAGE_KEY);
        createNewSession();
        showToast('All chat history cleared', '🗑️');
      },
    });
  });

  renameSessionBtn.addEventListener('click', () => {
    if (activeSessionId) openRenameModal(activeSessionId);
  });

  exportChatBtn.addEventListener('click', exportCurrentConversation);

  // Manual Sync Button
  manualSyncBtn.addEventListener('click', () => {
    if (!currentUser) {
      openAuthModal();
    } else {
      pushLocalSessionsToCloud(currentUser.uid);
    }
  });

  if (modalForceSyncBtn) {
    modalForceSyncBtn.addEventListener('click', () => {
      if (currentUser) {
        pushLocalSessionsToCloud(currentUser.uid);
      }
    });
  }

  // Account & Data Deletion (Play Store User Data Safety Policy)
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', () => {
      if (!currentUser) return;
      openConfirmDialog({
        title: 'Delete Account & Purge Data?',
        subtitle: 'Google Play Data Safety Compliance',
        message: 'This will permanently delete your user account, wipe all synced chat sessions, notes, and study history from Google Cloud Firestore. You will be signed out immediately. This cannot be undone.',
        okText: 'Permanently Delete Account',
        isDanger: true,
        onConfirm: async () => {
          try {
            updateSyncStatusUI('syncing', 'Purging...');
            for (const s of sessions) {
              await deleteSessionFromCloud(s.id);
            }
            const userToDelete = currentUser;
            await userToDelete.delete();
            sessions = [];
            localStorage.removeItem(STORAGE_KEY);
            closeProfileModal();
            createNewSession();
            showToast('Account and all cloud data permanently deleted', '✓');
          } catch (err) {
            console.error('Account deletion error:', err);
            if (err.code === 'auth/requires-recent-login') {
              showToast('Please sign in again before deleting your account for security.', '⚠️');
            } else {
              showToast(`Error: ${err.message}`, '⚠️');
            }
          }
        },
      });
    });
  }

  // Confirmation Modal Actions
  if (confirmModalOkBtn) {
    confirmModalOkBtn.addEventListener('click', () => {
      const callback = pendingConfirmCallback;
      closeConfirmDialog();
      if (typeof callback === 'function') {
        callback();
      }
    });
  }

  if (confirmModalCancelBtn) {
    confirmModalCancelBtn.addEventListener('click', closeConfirmDialog);
  }

  if (closeConfirmModalBtn) {
    closeConfirmModalBtn.addEventListener('click', closeConfirmDialog);
  }

  if (confirmModal) {
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) closeConfirmDialog();
    });
  }

  // Privacy Policy Modal Events
  if (privacyPolicyBtn) privacyPolicyBtn.addEventListener('click', openPrivacyModal);
  if (sidebarPrivacyBtn) sidebarPrivacyBtn.addEventListener('click', openPrivacyModal);
  if (sidebarTermsBtn) sidebarTermsBtn.addEventListener('click', openPrivacyModal);
  if (closePrivacyModalBtn) closePrivacyModalBtn.addEventListener('click', closePrivacyModal);
  if (privacyModalAcceptBtn) privacyModalAcceptBtn.addEventListener('click', closePrivacyModal);
  if (privacyModal) {
    privacyModal.addEventListener('click', (e) => {
      if (e.target === privacyModal) closePrivacyModal();
    });
  }

  // Report Modal Events
  if (closeReportModalBtn) closeReportModalBtn.addEventListener('click', closeReportModal);
  if (cancelReportBtn) cancelReportBtn.addEventListener('click', closeReportModal);
  if (submitReportBtn) submitReportBtn.addEventListener('click', handleReportSubmit);
  if (reportModal) {
    reportModal.addEventListener('click', (e) => {
      if (e.target === reportModal) closeReportModal();
    });
  }

  // Search in History
  historySearchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    clearSearchBtn.style.display = val ? 'block' : 'none';
    renderHistoryList(val);
  });

  clearSearchBtn.addEventListener('click', () => {
    historySearchInput.value = '';
    clearSearchBtn.style.display = 'none';
    renderHistoryList();
  });

  // Sidebar Toggle (Mobile & Desktop)
  sidebarToggle.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      if (sidebar.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    } else {
      sidebar.classList.toggle('collapsed');
    }
  });
  sidebarOverlay.addEventListener('click', closeSidebar);

  // Auth & Profile Navigation buttons
  navAuthBtn.addEventListener('click', openAuthModal);
  userAvatarBtn.addEventListener('click', openProfileModal);
  sidebarAuthActionBtn.addEventListener('click', () => {
    if (currentUser) {
      openProfileModal();
    } else {
      openAuthModal();
    }
  });
  sidebarUserCard.addEventListener('click', (e) => {
    if (!e.target.closest('#sidebarAuthActionBtn')) {
      if (currentUser) {
        openProfileModal();
      } else {
        openAuthModal();
      }
    }
  });

  // Auth Modal events
  closeAuthModalBtn.addEventListener('click', closeAuthModal);
  googleSignInActionBtn.addEventListener('click', handleGoogleSignIn);
  authEmailForm.addEventListener('submit', handleEmailSignIn);
  emailSignUpBtn.addEventListener('click', handleEmailSignUp);
  continueAsGuestBtn.addEventListener('click', closeAuthModal);
  authModal.addEventListener('click', (e) => {
    if (e.target === authModal) closeAuthModal();
  });

  // Profile Modal events
  closeProfileModalBtn.addEventListener('click', closeProfileModal);
  signOutBtn.addEventListener('click', handleSignOut);
  userProfileModal.addEventListener('click', (e) => {
    if (e.target === userProfileModal) closeProfileModal();
  });

  // GitHub Modal events
  githubInfoBtn.addEventListener('click', openGithubModal);
  closeGithubModalBtn.addEventListener('click', closeGithubModal);
  modalOkBtn.addEventListener('click', closeGithubModal);
  githubModal.addEventListener('click', (e) => {
    if (e.target === githubModal) closeGithubModal();
  });

  // Rename Modal events
  closeRenameModalBtn.addEventListener('click', closeRenameModal);
  cancelRenameBtn.addEventListener('click', closeRenameModal);
  saveRenameBtn.addEventListener('click', saveRename);
  renameSessionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveRename();
    if (e.key === 'Escape') closeRenameModal();
  });

  // Topic Shortcuts
  document.addEventListener('click', (e) => {
    const promptTrigger = e.target.closest('[data-prompt]');
    if (promptTrigger) {
      const prompt = promptTrigger.getAttribute('data-prompt');
      if (prompt) {
        sendMessage(prompt);
        if (window.innerWidth <= 768) closeSidebar();
      }
    }
  });

  // Top Nav Topic Buttons
  $$('.nav-link-btn[data-topic]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const topic = btn.getAttribute('data-topic');
      const topicPrompts = {
        nano: 'Provide a foundational overview of Nanotechnology: key scales, nanomaterials (CNTs, quantum dots, graphene), nanofabrication methods, and modern bio-applications.',
        bio: 'Provide a comprehensive overview of Biotechnology: molecular biology dogma, recombinant DNA technology, CRISPR-Cas9 genome editing, and bioprocessing.',
        aiml: 'Explain AI & Machine Learning core concepts: neural networks, loss optimization via gradient descent, Transformer self-attention, and LLM generative reasoning.',
        cogsci: 'Provide an overview of Cognitive Science: the interdisciplinary convergence of neuroscience, cognitive psychology, computational mind models, and consciousness theories.',
        nbic: 'Explain the concept of NBIC Convergence (Nano-Bio-Info-Cogno) and how these four technology pillars synergize to shape future medicine and computing.',
      };
      if (topicPrompts[topic]) {
        sendMessage(topicPrompts[topic]);
      }
    });
  });

  $('#navChatBtn').addEventListener('click', () => {
    createNewSession();
  });

  // Hero CTAs
  if (heroStartBtn) {
    heroStartBtn.addEventListener('click', () => {
      messageInput.focus();
    });
  }

  if (heroExamBtn) {
    heroExamBtn.addEventListener('click', () => {
      sendMessage(
        'Generate 5 high-yield practice exam questions across Nanotechnology, Biotechnology, AI/ML, and Cognitive Science with comprehensive explanations and answer keys.'
      );
    });
  }
}

// --------------- Startup Lifecycle ---------------
function init() {
  initBokeh();
  setupEventListeners();
  loadSessionsFromLocalStorage();

  if (sessions.length > 0) {
    activeSessionId = sessions[0].id;
    loadSessionIntoUI(activeSessionId);
  } else {
    createNewSession();
  }
  renderHistoryList();
  autoResize(messageInput);

  // Initialize Firebase Auth & Firestore
  initFirebase();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
