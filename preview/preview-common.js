/**
 * IndiChat Design Preview Studio — Complete Local Interaction Engine (v2.0)
 * 
 * Provides 100% interactive coverage for all visible controls across
 * Web, macOS, Windows, and Linux preview shells.
 * Pure Vanilla JavaScript · Client-Side State · Accessible
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'indichat_preview_state_v2';
  const fixtures = window.INDICHAT_FIXTURES;

  // State Container
  let state = {
    userProfile: {},
    contacts: [],
    callLogs: [],
    statusUpdates: [],
    communities: [],
    passkeys: [],
    activeContactId: '',
    activeRailTab: 'chats', // 'chats' | 'status' | 'calls' | 'communities' | 'starred'
    activeChatFilter: 'all', // 'all' | 'unread' | 'groups'
    activeCallsFilter: 'all', // 'all' | 'missed'
    searchQuery: '',
    drafts: {}, // { [contactId]: string }
    replyTarget: null, // null | { messageId, senderName, text }
    detailsPanelOpen: window.innerWidth >= 1200,
    settingsModalOpen: false,
    activeSettingsTab: 'profile',
    callModalOpen: false,
    callSeconds: 0,
    callIsVideo: false,
    callActiveContact: null,
    callIsMuted: false,
    callCameraOff: false,
    inChatSearchOpen: false,
    inChatSearchQuery: '',
    inChatMatchIndex: 0,
    inChatMatches: [],
    pickerPanelOpen: false,
    activePickerTab: 'emoji', // 'emoji' | 'gif' | 'sticker'
    attachmentMenuOpen: false,
    activeStoryModal: null, // null | story object
    activeLightboxMedia: null, // null | { title, url, caption }
    activeDocViewer: null, // null | doc object
    newChatModalOpen: false,
    newChatTab: 'direct', // 'direct' | 'group'
    selectedGroupMembers: [],
    paymentModalOpen: false,
    linkDeviceModalOpen: false,
    isLoggedOut: false
  };

  let callTimerInterval = null;
  let storyProgressInterval = null;
  let toastTimer = null;

  // --- 1. State Persistence & Initialization ---
  function loadPersistedState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        state.userProfile = parsed.userProfile || JSON.parse(JSON.stringify(fixtures.DEFAULT_USER_PROFILE));
        state.contacts = parsed.contacts || JSON.parse(JSON.stringify(fixtures.DEFAULT_CONTACTS));
        state.callLogs = parsed.callLogs || JSON.parse(JSON.stringify(fixtures.DEFAULT_CALL_LOGS));
        state.statusUpdates = parsed.statusUpdates || JSON.parse(JSON.stringify(fixtures.DEFAULT_STATUS_UPDATES));
        state.communities = parsed.communities || JSON.parse(JSON.stringify(fixtures.DEFAULT_COMMUNITIES || []));
        state.passkeys = parsed.passkeys || JSON.parse(JSON.stringify(fixtures.DEFAULT_PASSKEYS || []));
        state.activeContactId = parsed.activeContactId || state.contacts[0]?.id || 'c-aarav';
        state.drafts = parsed.drafts || {};
        return;
      }
    } catch (e) {
      console.warn('Could not load saved preview state, falling back to defaults', e);
    }
    resetToDefaultFixtures(false);
  }

  function saveState() {
    try {
      const payload = {
        userProfile: state.userProfile,
        contacts: state.contacts,
        callLogs: state.callLogs,
        statusUpdates: state.statusUpdates,
        communities: state.communities,
        passkeys: state.passkeys,
        activeContactId: state.activeContactId,
        drafts: state.drafts
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Could not save preview state to localStorage', e);
    }
  }

  function resetToDefaultFixtures(notify = true) {
    state.userProfile = JSON.parse(JSON.stringify(fixtures.DEFAULT_USER_PROFILE));
    state.contacts = JSON.parse(JSON.stringify(fixtures.DEFAULT_CONTACTS));
    state.callLogs = JSON.parse(JSON.stringify(fixtures.DEFAULT_CALL_LOGS));
    state.statusUpdates = JSON.parse(JSON.stringify(fixtures.DEFAULT_STATUS_UPDATES));
    state.communities = JSON.parse(JSON.stringify(fixtures.DEFAULT_COMMUNITIES || []));
    state.passkeys = JSON.parse(JSON.stringify(fixtures.DEFAULT_PASSKEYS || []));
    state.activeContactId = state.contacts[0]?.id || 'c-aarav';
    state.drafts = {};
    state.replyTarget = null;
    state.isLoggedOut = false;
    saveState();
    applyThemeAndMaterials();
    renderAll();
    if (notify) showToast('Reset complete: Demo fixtures restored');
  }

  // --- 2. Theme & Visual Preferences ---
  function applyThemeAndMaterials() {
    const prof = state.userProfile;
    const theme = prof.appearanceMode || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-reduce-transparency', prof.reduceTransparency ? 'true' : 'false');
    if (prof.reducedMotion) {
      document.documentElement.style.setProperty('--transition-fast', '0ms');
      document.documentElement.style.setProperty('--transition-normal', '0ms');
    } else {
      document.documentElement.style.removeProperty('--transition-fast');
      document.documentElement.style.removeProperty('--transition-normal');
    }

    // Chat wallpaper class on .app-chat-window
    const chatWin = document.getElementById('appChatWindow');
    if (chatWin) {
      chatWin.className = `app-chat-window wallpaper-${prof.chatWallpaper || 'default'}`;
    }

    // Update Sun/Moon button icon
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.innerHTML = theme === 'dark' ? '☀' : '🌙';
      btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'Daylight Light' : 'Dark Obsidian'} theme`);
    });
  }

  function toggleTheme() {
    state.userProfile.appearanceMode = state.userProfile.appearanceMode === 'dark' ? 'light' : 'dark';
    saveState();
    applyThemeAndMaterials();
    showToast(`Switched to ${state.userProfile.appearanceMode === 'dark' ? 'Dark Obsidian' : 'Daylight Light'} theme`);
  }

  // Helper escape
  const escapeHTML = (str) => {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  };

  // Toast Notification
  function showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    let toast = document.getElementById('previewToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'previewToast';
      toast.className = 'preview-toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span>●</span> <span>${escapeHTML(message)}</span>`;
    toast.style.display = 'flex';
    toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 2800);
  }

  // Delivery Tick Generator
  function getTickMarkup(status) {
    const readReceiptsEnabled = state.userProfile.readReceipts !== false;
    if (status === 'read') {
      const tickClass = readReceiptsEnabled ? 'read-tick cyan' : 'read-tick';
      const label = readReceiptsEnabled ? 'Read (✓✓ cyan #53bdeb)' : 'Delivered (Receipts Off)';
      return `<span class="${tickClass}" title="${label}" aria-label="${label}">✓✓</span>`;
    } else if (status === 'delivered') {
      return `<span class="read-tick" title="Delivered (✓✓ grey)" aria-label="Delivered">✓✓</span>`;
    } else if (status === 'sent') {
      return `<span class="read-tick" title="Sent (✓ grey)" aria-label="Sent">✓</span>`;
    }
    return '';
  }

  // --- 3. Navigation Rail Switcher ---
  function setActiveRailTab(tab) {
    state.activeRailTab = tab;
    document.querySelectorAll('.rail-btn[data-rail-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-rail-tab') === tab);
    });

    // Toggle Sidebar views
    document.querySelectorAll('.sidebar-view').forEach(view => {
      view.classList.remove('active');
    });
    const targetView = document.getElementById(`sidebarView-${tab}`);
    if (targetView) targetView.classList.add('active');

    // Render corresponding view contents
    if (tab === 'chats') renderConversationList();
    else if (tab === 'status') renderStatusView();
    else if (tab === 'calls') renderCallsView();
    else if (tab === 'communities') renderCommunitiesView();
    else if (tab === 'starred') renderStarredView();
  }

  // --- 4. Render Sidebar Views ---

  // A. Conversations List
  function renderConversationList() {
    const listEl = document.getElementById('conversationList');
    if (!listEl) return;

    let filtered = state.contacts.filter(c => {
      if (c.blocked) return false;
      if (state.activeChatFilter === 'unread' && c.unreadCount === 0) return false;
      if (state.activeChatFilter === 'groups' && !c.isGroup) return false;
      if (state.searchQuery.trim()) {
        const q = state.searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesMsg = c.messages.some(m => (m.text || m.docName || '').toLowerCase().includes(q));
        if (!matchesName && !matchesMsg) return false;
      }
      return true;
    });

    // Update Rail unread badge count
    const totalUnread = state.contacts.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
    const railBadge = document.getElementById('railChatsBadge');
    if (railBadge) {
      railBadge.textContent = totalUnread > 0 ? String(totalUnread) : '';
      railBadge.style.display = totalUnread > 0 ? 'grid' : 'none';
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div style="padding: 32px 16px; text-align: center; color: var(--text-muted); font-size: 13px;">
          No conversations found for "${escapeHTML(state.searchQuery)}"
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered.map(c => {
      const isActive = c.id === state.activeContactId;
      const lastMsg = c.messages[c.messages.length - 1];
      const snippetText = lastMsg ? (lastMsg.type === 'image' ? '📷 Photo' : lastMsg.type === 'document' ? '📄 Document' : lastMsg.type === 'audio' ? '🎤 Voice message' : lastMsg.type === 'payment' ? '₹ UPI Payment' : lastMsg.text) : 'No messages';
      const tick = (lastMsg && lastMsg.sender === 'me') ? getTickMarkup(lastMsg.status) : '';

      return `
        <button class="conversation-item ${isActive ? 'active' : ''}" data-contact-id="${c.id}" aria-label="Open chat with ${escapeHTML(c.name)}">
          <div class="convo-avatar" style="background: ${c.avatarColor}">
            ${c.avatarInitials}
            ${c.online ? '<div class="online-indicator"></div>' : ''}
          </div>
          <div class="convo-body">
            <div class="convo-top">
              <span class="convo-name">${escapeHTML(c.name)}</span>
              <span class="convo-time">${lastMsg ? lastMsg.time : ''}</span>
            </div>
            <div class="convo-bottom">
              <span class="convo-snippet">
                ${tick} ${escapeHTML(snippetText)}
              </span>
              ${c.unreadCount > 0 ? `<span class="unread-pill">${c.unreadCount}</span>` : ''}
            </div>
          </div>
        </button>
      `;
    }).join('');

    listEl.querySelectorAll('.conversation-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-contact-id');
        setActiveContact(id);
      });
    });
  }

  function setActiveContact(id) {
    // Preserve draft from current active contact
    const currentInput = document.getElementById('composerInputField');
    if (currentInput && state.activeContactId) {
      state.drafts[state.activeContactId] = currentInput.value;
    }

    state.activeContactId = id;
    const c = state.contacts.find(item => item.id === id);
    if (c) c.unreadCount = 0; // Clear unread on opening
    state.replyTarget = null;
    state.inChatSearchOpen = false;

    saveState();
    renderConversationList();
    renderChatWindow();
    renderDetailsPanel();

    // Restore draft
    const input = document.getElementById('composerInputField');
    if (input) {
      input.value = state.drafts[id] || '';
      input.focus();
    }
  }

  // B. Status / Stories View
  function renderStatusView() {
    const container = document.getElementById('statusListContainer');
    if (!container) return;

    let html = `
      <div class="status-section-header">My Status</div>
      <button class="status-row-item" id="btnMyStatusAction" aria-label="View or add to my status">
        <div class="status-avatar-ring">
          <div class="status-avatar-inner" style="background: ${state.userProfile.avatarColor}">
            ${state.userProfile.avatarInitials}
          </div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:650;color:var(--text-main)">My Status</div>
          <div style="font-size:12px;color:var(--brand-emerald)">Tap to view or add update</div>
        </div>
        <button class="studio-btn" style="padding:4px 8px;font-size:11px" id="btnAddStatusPrompt">+ Add</button>
      </button>

      <div class="status-section-header">Recent Updates</div>
    `;

    const recent = state.statusUpdates.filter(s => !s.isSelf);
    html += recent.map(s => `
      <button class="status-row-item" data-status-id="${s.id}" aria-label="View status of ${escapeHTML(s.name)}">
        <div class="status-avatar-ring ${s.hasUnseen ? '' : 'seen'}">
          <div class="status-avatar-inner" style="background: ${s.avatarColor}">
            ${s.initials}
          </div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:650;color:var(--text-main)">${escapeHTML(s.name)}</div>
          <div style="font-size:12px;color:var(--text-muted)">${escapeHTML(s.time)}</div>
        </div>
      </button>
    `).join('');

    container.innerHTML = html;

    // Attach click events
    container.querySelectorAll('[data-status-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-status-id');
        const update = state.statusUpdates.find(u => u.id === id);
        if (update && update.stories && update.stories.length > 0) {
          update.hasUnseen = false;
          saveState();
          renderStatusView();
          openStoryViewerModal(update.name, update.stories[0]);
        }
      });
    });

    document.getElementById('btnMyStatusAction')?.addEventListener('click', () => {
      const myUpdate = state.statusUpdates.find(u => u.isSelf);
      if (myUpdate && myUpdate.stories.length > 0) {
        openStoryViewerModal('My Status', myUpdate.stories[0]);
      } else {
        addNewStatusPrompt();
      }
    });

    document.getElementById('btnAddStatusPrompt')?.addEventListener('click', (e) => {
      e.stopPropagation();
      addNewStatusPrompt();
    });
  }

  function addNewStatusPrompt() {
    const text = prompt('Enter your status text update:');
    if (text && text.trim()) {
      const myUpdate = state.statusUpdates.find(u => u.isSelf);
      if (myUpdate) {
        myUpdate.stories.unshift({
          id: 'story-' + Date.now(),
          title: 'My Update ✨',
          caption: text.trim(),
          time: 'Just now',
          bg: '#005c4b'
        });
        saveState();
        renderStatusView();
        showToast('Status update posted!');
      }
    }
  }

  function openStoryViewerModal(authorName, story) {
    let modal = document.getElementById('storyViewerModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'storyViewerModal';
      modal.className = 'modal-backdrop';
      const windowMockup = document.querySelector('.window-mockup');
      if (windowMockup) windowMockup.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card" style="max-width:440px;height:640px;background:${story.bg || '#0a332c'};display:flex;flex-direction:column;position:relative;color:#fff">
        <!-- Story Progress Bar -->
        <div style="height:4px;background:rgba(255,255,255,0.25);border-radius:2px;overflow:hidden;margin:12px 16px 0">
          <div id="storyProgressBar" style="height:100%;width:0%;background:#ffffff;transition:width 5s linear"></div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px">
          <div>
            <div style="font-size:14px;font-weight:700">${escapeHTML(authorName)}</div>
            <div style="font-size:11px;opacity:0.75">${escapeHTML(story.time)}</div>
          </div>
          <button class="icon-btn" id="closeStoryBtn" style="color:#fff" aria-label="Close story">✕</button>
        </div>

        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:24px;text-align:center">
          <h2 style="font-size:24px;font-weight:800;margin-bottom:12px">${escapeHTML(story.title || '')}</h2>
          <p style="font-size:16px;line-height:1.5;max-width:320px">${escapeHTML(story.caption || '')}</p>
        </div>

        <div style="padding:16px;text-align:center;font-size:12px;opacity:0.75">
          IndiChat End-to-End Encrypted Status
        </div>
      </div>
    `;

    modal.style.display = 'grid';
    onModalOpened(modal);

    // Animate progress bar
    setTimeout(() => {
      const bar = document.getElementById('storyProgressBar');
      if (bar) bar.style.width = '100%';
    }, 50);

    if (storyProgressInterval) clearTimeout(storyProgressInterval);
    storyProgressInterval = setTimeout(() => {
      closeStoryViewerModal();
    }, 5000);

    document.getElementById('closeStoryBtn')?.addEventListener('click', closeStoryViewerModal);
  }

  function closeStoryViewerModal() {
    if (storyProgressInterval) clearTimeout(storyProgressInterval);
    const modal = document.getElementById('storyViewerModal');
    onModalClosed(modal);
  }

  // C. Calls View
  function renderCallsView() {
    const container = document.getElementById('callsListContainer');
    if (!container) return;

    let filtered = state.callLogs.filter(c => {
      if (state.activeCallsFilter === 'missed') return c.type === 'missed';
      return true;
    });

    let html = `
      <div style="padding: 12px 16px; display:flex; gap:8px; align-items:center; justify-content:space-between;">
        <div class="filter-chips-bar" style="padding:0">
          <button class="filter-chip ${state.activeCallsFilter === 'all' ? 'active' : ''}" id="filterCallsAll">All</button>
          <button class="filter-chip ${state.activeCallsFilter === 'missed' ? 'active' : ''}" id="filterCallsMissed">Missed</button>
        </div>
        <button class="studio-btn" id="btnNewCallDialer" style="padding:4px 10px;font-size:11px">📞 Call Contact</button>
      </div>
    `;

    if (filtered.length === 0) {
      html += `
        <div style="padding: 32px 16px; text-align: center; color: var(--text-muted); font-size: 13px;">
          No ${state.activeCallsFilter === 'missed' ? 'missed' : 'recent'} calls in log.
        </div>
      `;
    } else {
      html += filtered.map(c => `
        <button class="call-row-item" data-call-name="${escapeHTML(c.name)}" data-call-video="${c.isVideo}" aria-label="Call ${escapeHTML(c.name)}">
          <div class="convo-avatar" style="background: ${c.color}">
            ${c.initials}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:650;color:${c.type === 'missed' ? 'var(--accent-danger)' : 'var(--text-main)'}">
              ${escapeHTML(c.name)}
            </div>
            <div class="call-type-icon ${c.type}">
              ${c.type === 'missed' ? '↙ Missed' : c.type === 'incoming' ? '↙ Incoming' : '↗ Outgoing'} · ${c.date}
            </div>
          </div>
          <div style="color:var(--brand-emerald)">
            ${c.isVideo ? '📹' : '📞'}
          </div>
        </button>
      `).join('');
    }

    container.innerHTML = html;

    // Handlers
    document.getElementById('filterCallsAll')?.addEventListener('click', () => {
      state.activeCallsFilter = 'all';
      renderCallsView();
    });
    document.getElementById('filterCallsMissed')?.addEventListener('click', () => {
      state.activeCallsFilter = 'missed';
      renderCallsView();
    });
    document.getElementById('btnNewCallDialer')?.addEventListener('click', () => {
      openContactDialerModal();
    });

    container.querySelectorAll('.call-row-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-call-name');
        const isVideo = btn.getAttribute('data-call-video') === 'true';
        const contact = state.contacts.find(c => c.name === name) || {
          name: name,
          avatarInitials: name.split(' ').map(n => n[0]).join(''),
          avatarColor: 'linear-gradient(135deg, #10b981, #00a884)'
        };
        startCallSimulation(isVideo, contact);
      });
    });
  }

  function openContactDialerModal() {
    let modal = document.getElementById('contactDialerModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'contactDialerModal';
      modal.className = 'modal-backdrop';
      const windowMockup = document.querySelector('.window-mockup');
      if (windowMockup) windowMockup.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card" style="max-width:440px">
        <div class="modal-header">
          <h2>New Call</h2>
          <button class="icon-btn" id="closeDialerModalBtn" aria-label="Close dialer">✕</button>
        </div>
        <div style="padding:16px 20px;overflow-y:auto;max-height:480px">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:10px">
            Select Contact to Call (Simulated)
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${state.contacts.map(c => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--input-bg);border-radius:var(--radius-md);border:1px solid var(--border-subtle)">
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="width:34px;height:34px;border-radius:10px;background:${c.avatarColor};color:#fff;display:grid;place-items:center;font-weight:700;font-size:13px">
                    ${c.avatarInitials}
                  </div>
                  <div>
                    <div style="font-size:13.5px;font-weight:650;color:var(--text-main)">${escapeHTML(c.name)}</div>
                    <div style="font-size:11.5px;color:var(--text-muted)">${escapeHTML(c.phoneNumber)}</div>
                  </div>
                </div>
                <div style="display:flex;gap:6px">
                  <button class="studio-btn" data-dial-id="${c.id}" data-dial-video="false" title="Voice Call">📞</button>
                  <button class="studio-btn" data-dial-id="${c.id}" data-dial-video="true" title="Video Call">📹</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'grid';
    onModalOpened(modal);

    document.getElementById('closeDialerModalBtn')?.addEventListener('click', () => {
      closeModalElement(modal);
    });

    modal.querySelectorAll('[data-dial-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-dial-id');
        const isVideo = btn.getAttribute('data-dial-video') === 'true';
        const contact = state.contacts.find(c => c.id === id);
        closeModalElement(modal);
        if (contact) startCallSimulation(isVideo, contact);
      });
    });
  }

  // D. Starred Messages View
  function renderStarredView() {
    const container = document.getElementById('starredListContainer');
    if (!container) return;

    let starredList = [];
    state.contacts.forEach(c => {
      c.messages.forEach(m => {
        if (m.starred) {
          starredList.push({ contact: c, message: m });
        }
      });
    });

    if (starredList.length === 0) {
      container.innerHTML = `
        <div style="padding: 32px 16px; text-align: center; color: var(--text-muted); font-size: 13px;">
          ⭐ No starred messages yet.<br>Hover over any message and click the star to pin it here.
        </div>
      `;
      return;
    }

    container.innerHTML = starredList.map(item => `
      <div class="starred-row-item">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:13px;font-weight:700;color:var(--brand-emerald)">${escapeHTML(item.contact.name)}</span>
          <span style="font-size:11px;color:var(--text-muted)">${escapeHTML(item.message.time)}</span>
        </div>
        <div style="font-size:13px;color:var(--text-main);line-height:1.4">
          ${escapeHTML(item.message.text || (item.message.type === 'document' ? item.message.docName : 'Media item'))}
        </div>
        <div style="display:flex;justify-content:flex-end">
          <button class="studio-btn" style="padding:3px 8px;font-size:11px" data-jump-contact="${item.contact.id}">
            Jump to Chat →
          </button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('[data-jump-contact]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cid = btn.getAttribute('data-jump-contact');
        setActiveRailTab('chats');
        setActiveContact(cid);
      });
    });
  }

  // E. Communities & Circles View
  function renderCommunitiesView() {
    const container = document.getElementById('communitiesListContainer');
    if (!container) return;

    const comms = state.communities || [];

    let html = `
      <div style="padding:14px;background:var(--input-bg);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);margin-bottom:14px">
        <div style="font-size:14px;font-weight:750;color:var(--text-main);margin-bottom:4px">Connected Circles</div>
        <div style="font-size:12px;color:var(--text-muted);line-height:1.4;margin-bottom:12px">
          Organize topics, teams, and family chats under shared umbrella circles.
        </div>
        <button class="studio-btn active" id="btnCreateCommunityCircleAction" style="width:100%;justify-content:center;padding:8px 12px">
          ＋ Create Community Circle
        </button>
      </div>

      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin:0 4px 10px">
        Your Circles · ${comms.length}
      </div>
    `;

    if (comms.length === 0) {
      html += `
        <div style="padding: 32px 16px; text-align: center; color: var(--text-muted); font-size: 13px;">
          👥 No community circles yet.<br>Click "Create Community Circle" to start one.
        </div>
      `;
    } else {
      html += comms.map(comm => `
        <div class="community-circle-card" style="padding:12px;background:rgba(255,255,255,0.02);border:1px solid var(--border-subtle);border-radius:var(--radius-md);margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
            <div style="width:40px;height:40px;border-radius:12px;background:${comm.iconColor || 'var(--brand-emerald)'};color:#fff;display:grid;place-items:center;font-weight:700;font-size:14px;flex-shrink:0">
              ${escapeHTML(comm.iconInitials || 'CC')}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13.5px;font-weight:700;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(comm.name)}</div>
              <div style="font-size:11.5px;color:var(--text-muted)">${comm.subGroups?.length || 0} sub-groups · ${comm.membersCount || 0} members</div>
            </div>
          </div>
          <p style="font-size:12px;color:var(--text-sec);line-height:1.4;margin-bottom:10px">${escapeHTML(comm.description || '')}</p>
          
          <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">
            ${(comm.subGroups || []).map(sg => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:var(--input-bg);border-radius:var(--radius-sm);font-size:12px">
                <span style="color:var(--text-main);font-weight:550">💬 ${escapeHTML(sg.name)}</span>
                <span style="color:var(--text-muted);font-size:11px">${sg.members} members</span>
              </div>
            `).join('')}
          </div>

          <div style="display:flex;justify-content:flex-end">
            <button class="studio-btn" data-open-community-id="${comm.id}" style="font-size:11px;padding:4px 10px">
              View Circle Details →
            </button>
          </div>
        </div>
      `).join('');
    }

    container.innerHTML = html;

    document.getElementById('btnCreateCommunityCircleAction')?.addEventListener('click', () => {
      openCommunityCircleModal();
    });

    container.querySelectorAll('[data-open-community-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-open-community-id');
        const comm = (state.communities || []).find(c => c.id === id);
        if (comm) openCommunityCircleModal(comm);
      });
    });
  }

  function openCommunityCircleModal(comm) {
    let modal = document.getElementById('communityCircleModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'communityCircleModal';
      modal.className = 'modal-backdrop';
      const windowMockup = document.querySelector('.window-mockup');
      if (windowMockup) windowMockup.appendChild(modal);
    }

    if (!comm) {
      // Creation mode
      modal.innerHTML = `
        <div class="modal-card" style="max-width:460px">
          <div class="modal-header">
            <h2>Create Community Circle</h2>
            <button class="icon-btn" id="closeCommunityModalX" aria-label="Close dialog">✕</button>
          </div>
          <form id="formCreateCircle" style="padding:20px;display:flex;flex-direction:column;gap:14px">
            <div class="settings-form-row" style="margin-bottom:0">
              <label>Circle Name</label>
              <input type="text" class="composer-input-field" id="inputNewCircleName" placeholder="e.g. Design Systems &amp; UX" required style="width:100%">
            </div>
            <div class="settings-form-row" style="margin-bottom:0">
              <label>Description</label>
              <textarea class="composer-input-field" id="inputNewCircleDesc" rows="3" placeholder="What is this community circle about?" required style="width:100%"></textarea>
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px">
              <button type="button" class="studio-btn" id="btnCancelCreateCircle">Cancel</button>
              <button type="submit" class="studio-btn active">Create Circle</button>
            </div>
          </form>
        </div>
      `;

      modal.style.display = 'grid';
      onModalOpened(modal);

      document.getElementById('closeCommunityModalX')?.addEventListener('click', () => closeModalElement(modal));
      document.getElementById('btnCancelCreateCircle')?.addEventListener('click', () => closeModalElement(modal));

      document.getElementById('formCreateCircle')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('inputNewCircleName')?.value.trim();
        const desc = document.getElementById('inputNewCircleDesc')?.value.trim();
        if (name && desc) {
          const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'CC';
          const newCircle = {
            id: 'comm-' + Date.now(),
            name: name,
            description: desc,
            subGroups: [
              { name: 'General Announcements', members: 1, unread: 0 },
              { name: 'Open Discussion', members: 1, unread: 0 }
            ],
            membersCount: 1,
            iconColor: '#10b981',
            iconInitials: initials
          };
          if (!state.communities) state.communities = [];
          state.communities.unshift(newCircle);
          saveState();
          closeModalElement(modal);
          renderCommunitiesView();
          showToast(`Community Circle "${name}" created!`);
        }
      });
    } else {
      // Details & Sub-groups mode
      modal.innerHTML = `
        <div class="modal-card" style="max-width:520px">
          <div class="modal-header">
            <h2>${escapeHTML(comm.name)}</h2>
            <button class="icon-btn" id="closeCommunityModalX" aria-label="Close dialog">✕</button>
          </div>
          <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
            <div style="display:flex;align-items:center;gap:14px;padding-bottom:14px;border-bottom:1px solid var(--border-subtle)">
              <div style="width:52px;height:52px;border-radius:16px;background:${comm.iconColor || 'var(--brand-emerald)'};color:#fff;display:grid;place-items:center;font-weight:800;font-size:18px">
                ${escapeHTML(comm.iconInitials || 'CC')}
              </div>
              <div>
                <div style="font-size:15px;font-weight:700;color:var(--text-main)">${escapeHTML(comm.name)}</div>
                <div style="font-size:12px;color:var(--text-muted)">${comm.membersCount || 0} Total Members · ${comm.subGroups?.length || 0} Sub-Groups</div>
              </div>
            </div>
            <p style="font-size:13px;color:var(--text-sec);line-height:1.5">${escapeHTML(comm.description || '')}</p>

            <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-top:6px">Sub-Group Channels</div>
            <div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto" id="commSubGroupsList">
              ${(comm.subGroups || []).map(sg => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--input-bg);border:1px solid var(--border-subtle);border-radius:var(--radius-md)">
                  <div>
                    <div style="font-size:13px;font-weight:600;color:var(--text-main)">💬 ${escapeHTML(sg.name)}</div>
                    <div style="font-size:11px;color:var(--text-muted)">${sg.members} members</div>
                  </div>
                  <button class="studio-btn" data-join-subgroup="${escapeHTML(sg.name)}" style="padding:4px 8px;font-size:11px">Open Chat</button>
                </div>
              `).join('')}
            </div>

            <form id="formAddSubGroup" style="display:flex;gap:8px;margin-top:10px;padding-top:12px;border-top:1px solid var(--border-subtle)">
              <input type="text" class="composer-input-field" id="inputNewSubGroupName" placeholder="New sub-group channel name..." required style="flex:1">
              <button type="submit" class="studio-btn active" style="white-space:nowrap">＋ Add Sub-Group</button>
            </form>

            <div style="display:flex;justify-content:flex-end;margin-top:10px">
              <button class="studio-btn" id="btnCloseCommunityCircleBtn">Done</button>
            </div>
          </div>
        </div>
      `;

      modal.style.display = 'grid';
      onModalOpened(modal);

      document.getElementById('closeCommunityModalX')?.addEventListener('click', () => closeModalElement(modal));
      document.getElementById('btnCloseCommunityCircleBtn')?.addEventListener('click', () => closeModalElement(modal));

      modal.querySelectorAll('[data-join-subgroup]').forEach(btn => {
        btn.addEventListener('click', () => {
          closeModalElement(modal);
          showToast(`Opening ${btn.getAttribute('data-join-subgroup')} channel...`);
          setActiveRailTab('chats');
        });
      });

      document.getElementById('formAddSubGroup')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const sgInput = document.getElementById('inputNewSubGroupName');
        const sgName = sgInput?.value.trim();
        if (sgName) {
          if (!comm.subGroups) comm.subGroups = [];
          comm.subGroups.push({ name: sgName, members: 1, unread: 0 });
          saveState();
          openCommunityCircleModal(comm);
          renderCommunitiesView();
          showToast(`Sub-group "${sgName}" added to circle!`);
        }
      });
    }
  }

  // --- 5. Render Active Chat Window ---
  function renderChatWindow() {
    const c = state.contacts.find(item => item.id === state.activeContactId);
    if (!c) return;

    // Contact Header
    const avatarEl = document.getElementById('chatHeaderAvatar');
    const nameEl = document.getElementById('chatHeaderName');
    const statusEl = document.getElementById('chatHeaderStatus');
    if (avatarEl) {
      avatarEl.style.background = c.avatarColor;
      avatarEl.innerHTML = `${c.avatarInitials}${c.online ? '<div class="online-indicator" style="bottom:-2px;right:-2px"></div>' : ''}`;
    }
    if (nameEl) nameEl.textContent = c.name;
    if (statusEl) {
      statusEl.textContent = c.statusText;
      statusEl.className = `chat-header-status ${c.online ? '' : 'offline'}`;
    }

    // In-Chat Search Bar Render
    const inChatBar = document.getElementById('inChatSearchBar');
    if (inChatBar) {
      inChatBar.style.display = state.inChatSearchOpen ? 'flex' : 'none';
    }

    // Quoted Reply Preview Bar Render
    const replyBar = document.getElementById('quotedReplyActiveBar');
    if (replyBar) {
      if (state.replyTarget) {
        replyBar.style.display = 'flex';
        const authorEl = document.getElementById('quotedReplyAuthor');
        const textEl = document.getElementById('quotedReplyText');
        if (authorEl) authorEl.textContent = state.replyTarget.senderName;
        if (textEl) textEl.textContent = state.replyTarget.text;
      } else {
        replyBar.style.display = 'none';
      }
    }

    // Messages Stream
    const streamEl = document.getElementById('messagesStream');
    if (!streamEl) return;

    let html = `
      <div class="date-divider">TODAY · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      <div class="encryption-notice">
        🔒 Messages and calls are end-to-end encrypted. No one outside of this chat, not even IndiChat, can read or listen to them.
      </div>
    `;

    const searchQuery = (state.inChatSearchOpen ? state.inChatSearchQuery.trim().toLowerCase() : '');

    html += c.messages.map((m, idx) => {
      const isMe = m.sender === 'me';
      const bubbleClass = isMe ? 'outgoing' : 'incoming';
      let contentHtml = '';

      const isMatch = searchQuery && (m.text || '').toLowerCase().includes(searchQuery);

      if (m.type === 'image') {
        contentHtml = `
          <div class="media-attachment-card" data-lightbox-title="${escapeHTML(m.imageTitle || 'Image')}" data-lightbox-url="${escapeHTML(m.imageUrl || '')}" data-lightbox-caption="${escapeHTML(m.text || '')}">
            <div class="media-thumbnail-sim">
              <h4>${escapeHTML(m.imageTitle || 'Shared Image')}</h4>
              <p>${escapeHTML(m.imageSubtitle || '')}</p>
            </div>
            ${m.text ? `<div style="padding: 8px 10px; font-size: 13px;">${escapeHTML(m.text)}</div>` : ''}
          </div>
        `;
      } else if (m.type === 'document') {
        contentHtml = `
          <div class="doc-attachment-card" data-doc-name="${escapeHTML(m.docName || 'Document.pdf')}" data-doc-size="${escapeHTML(m.docSize || '')}">
            <div class="doc-icon-badge">📄</div>
            <div class="doc-info">
              <div class="doc-name">${escapeHTML(m.docName || 'Document.pdf')}</div>
              <div class="doc-size">${escapeHTML(m.docSize || 'File')}</div>
            </div>
          </div>
          ${m.text ? `<div style="font-size: 13px;">${escapeHTML(m.text)}</div>` : ''}
        `;
      } else if (m.type === 'audio') {
        contentHtml = `
          <div class="audio-attachment-card">
            <button class="audio-play-btn" data-action="play-audio" aria-label="Play voice note">▶</button>
            <div class="audio-waveform-bars">
              <div class="waveform-bar active" style="height: 12px;"></div>
              <div class="waveform-bar active" style="height: 18px;"></div>
              <div class="waveform-bar active" style="height: 24px;"></div>
              <div class="waveform-bar active" style="height: 14px;"></div>
              <div class="waveform-bar" style="height: 20px;"></div>
              <div class="waveform-bar" style="height: 28px;"></div>
              <div class="waveform-bar" style="height: 16px;"></div>
              <div class="waveform-bar" style="height: 22px;"></div>
              <div class="waveform-bar" style="height: 10px;"></div>
            </div>
            <span style="font-size: 11.5px; opacity: 0.85;">${m.audioDuration || '0:35'}</span>
          </div>
        `;
      } else if (m.type === 'payment') {
        contentHtml = `
          <div class="payment-card-bubble">
            <div style="font-size:12px;opacity:0.85">₹ UPI Payment</div>
            <div class="payment-card-amount">${escapeHTML(m.amount || '₹500')}</div>
            <div style="font-size:12.5px;font-weight:600">✓ Completed</div>
            <div style="font-size:11.5px;opacity:0.85">${escapeHTML(m.text || '')}</div>
          </div>
        `;
      } else {
        contentHtml = `<div>${escapeHTML(m.text)}</div>`;
      }

      // Quoted reply snippet
      let replySnippetHtml = '';
      if (m.replyTo) {
        replySnippetHtml = `
          <div class="quoted-reply-card">
            <strong>${escapeHTML(m.replyTo.senderDisplayName || 'Reply')}</strong>
            <div>${escapeHTML(m.replyTo.content || '')}</div>
          </div>
        `;
      }

      // Reactions row
      let reactionsHtml = '';
      if (m.reactions && Object.keys(m.reactions).length > 0) {
        reactionsHtml = `
          <div class="reactions-row">
            ${Object.entries(m.reactions).map(([emoji, count]) => `
              <span class="reaction-badge" data-msg-id="${m.id}" data-reaction="${emoji}">${emoji} ${count}</span>
            `).join('')}
          </div>
        `;
      }

      const tick = isMe ? getTickMarkup(m.status) : '';
      const starIcon = m.starred ? '<span class="starred-badge-icon" title="Starred">★</span>' : '';

      return `
        <div class="message-bubble ${bubbleClass} ${isMatch ? 'highlighted' : ''}" id="bubble-${m.id}" tabindex="0">
          <!-- Floating Action Bar on Hover/Focus -->
          <div class="bubble-action-bar">
            <button class="bubble-action-btn" data-action="reaction-pick" data-msg-id="${m.id}" title="React" aria-label="React with emoji">😀</button>
            <button class="bubble-action-btn" data-action="reply" data-msg-id="${m.id}" title="Reply" aria-label="Reply to message">↩</button>
            <button class="bubble-action-btn" data-action="star" data-msg-id="${m.id}" title="${m.starred ? 'Unstar' : 'Star'}" aria-label="Star message">${m.starred ? '★' : '☆'}</button>
            <button class="bubble-action-btn" data-action="copy" data-msg-id="${m.id}" title="Copy" aria-label="Copy message text">📋</button>
            <button class="bubble-action-btn" data-action="delete" data-msg-id="${m.id}" title="Delete" aria-label="Delete message">🗑</button>
          </div>

          ${replySnippetHtml}
          ${contentHtml}
          ${reactionsHtml}

          <div class="bubble-meta">
            ${starIcon}
            <span>${escapeHTML(m.time)}</span>
            ${tick}
          </div>
        </div>
      `;
    }).join('');

    streamEl.innerHTML = html;
    streamEl.scrollTop = streamEl.scrollHeight;

    // Attach Interactive Event Listeners on Bubbles
    streamEl.querySelectorAll('[data-lightbox-url]').forEach(el => {
      el.addEventListener('click', () => {
        openLightboxViewer(
          el.getAttribute('data-lightbox-title'),
          el.getAttribute('data-lightbox-url'),
          el.getAttribute('data-lightbox-caption')
        );
      });
    });

    streamEl.querySelectorAll('[data-doc-name]').forEach(el => {
      el.addEventListener('click', () => {
        openDocumentViewerModal(
          el.getAttribute('data-doc-name'),
          el.getAttribute('data-doc-size')
        );
      });
    });

    streamEl.querySelectorAll('[data-action="play-audio"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.audio-attachment-card');
        const isPlaying = card?.classList.contains('playing');
        if (isPlaying) {
          card.classList.remove('playing');
          btn.textContent = '▶';
          btn.setAttribute('aria-label', 'Play voice note');
          showToast('Voice note paused');
        } else {
          document.querySelectorAll('.audio-attachment-card.playing').forEach(c => {
            c.classList.remove('playing');
            const b = c.querySelector('[data-action="play-audio"]');
            if (b) {
              b.textContent = '▶';
              b.setAttribute('aria-label', 'Play voice note');
            }
          });
          card?.classList.add('playing');
          btn.textContent = '❚❚';
          btn.setAttribute('aria-label', 'Pause voice note');
          showToast('Playing voice note (Simulated audio track)');
        }
      });
    });

    // Message actions
    streamEl.querySelectorAll('[data-action="reply"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const msgId = btn.getAttribute('data-msg-id');
        const msg = c.messages.find(m => m.id === msgId);
        if (msg) {
          state.replyTarget = {
            messageId: msg.id,
            senderName: msg.senderDisplayName || (msg.sender === 'me' ? 'You' : c.name),
            text: msg.text || (msg.type === 'document' ? msg.docName : 'Attachment')
          };
          renderChatWindow();
          document.getElementById('composerInputField')?.focus();
        }
      });
    });

    streamEl.querySelectorAll('[data-action="star"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const msgId = btn.getAttribute('data-msg-id');
        const msg = c.messages.find(m => m.id === msgId);
        if (msg) {
          msg.starred = !msg.starred;
          saveState();
          renderChatWindow();
          showToast(msg.starred ? 'Message starred ★' : 'Message unstarred');
        }
      });
    });

    streamEl.querySelectorAll('[data-action="copy"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const msgId = btn.getAttribute('data-msg-id');
        const msg = c.messages.find(m => m.id === msgId);
        if (msg && msg.text) {
          navigator.clipboard?.writeText(msg.text).catch(() => {});
          showToast('Message text copied to clipboard');
        }
      });
    });

    streamEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const msgId = btn.getAttribute('data-msg-id');
        if (confirm('Delete this message locally?')) {
          c.messages = c.messages.filter(m => m.id !== msgId);
          saveState();
          renderChatWindow();
          showToast('Message deleted');
        }
      });
    });

    streamEl.querySelectorAll('[data-action="reaction-pick"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const msgId = btn.getAttribute('data-msg-id');
        openReactionPicker(btn, msgId);
      });
    });
  }

  // Reaction Emoji Picker Popover
  function openReactionPicker(anchorBtn, msgId) {
    let popover = document.getElementById('reactionPickerPopover');
    if (popover) popover.remove();

    popover = document.createElement('div');
    popover.id = 'reactionPickerPopover';
    popover.className = 'reaction-picker-popover';

    const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
    popover.innerHTML = emojis.map(em => `
      <button class="reaction-emoji-btn" data-emoji="${em}" aria-label="React with ${em}">${em}</button>
    `).join('');

    anchorBtn.parentElement.appendChild(popover);

    popover.querySelectorAll('[data-emoji]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const emoji = btn.getAttribute('data-emoji');
        addReactionToMessage(msgId, emoji);
        popover.remove();
      });
    });

    const closeHandler = () => {
      popover.remove();
      document.removeEventListener('click', closeHandler);
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }

  function addReactionToMessage(msgId, emoji) {
    const c = state.contacts.find(item => item.id === state.activeContactId);
    if (!c) return;
    const msg = c.messages.find(m => m.id === msgId);
    if (!msg) return;

    if (!msg.reactions) msg.reactions = {};
    if (msg.reactions[emoji]) {
      delete msg.reactions[emoji];
    } else {
      msg.reactions[emoji] = 1;
    }
    saveState();
    renderChatWindow();
  }

  // Lightbox Media Viewer
  function openLightboxViewer(title, url, caption) {
    let overlay = document.getElementById('lightboxViewerModal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'lightboxViewerModal';
      overlay.className = 'lightbox-modal-overlay';
      const windowMockup = document.querySelector('.window-mockup');
      if (windowMockup) windowMockup.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="lightbox-header">
        <span style="font-size:15px;font-weight:700">${escapeHTML(title || 'Photo')}</span>
        <button class="icon-btn" id="closeLightboxBtn" style="color:#fff" aria-label="Close lightbox">✕</button>
      </div>
      <div class="lightbox-body">
        <img src="${escapeHTML(url)}" alt="${escapeHTML(title)}" />
      </div>
      ${caption ? `<div style="padding:14px;background:rgba(0,0,0,0.4);border-radius:8px;margin-top:12px;font-size:13.5px;color:#fff">${escapeHTML(caption)}</div>` : ''}
    `;

    overlay.style.display = 'flex';
    onModalOpened(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.classList?.contains('lightbox-body')) {
        closeModalElement(overlay);
      }
    });
    document.getElementById('closeLightboxBtn')?.addEventListener('click', () => {
      closeModalElement(overlay);
    });
  }

  // Document Viewer Modal
  function openDocumentViewerModal(docName, docSize) {
    let modal = document.getElementById('docViewerModalBackdrop');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'docViewerModalBackdrop';
      modal.className = 'modal-backdrop';
      const windowMockup = document.querySelector('.window-mockup');
      if (windowMockup) windowMockup.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="doc-viewer-modal">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-subtle);padding-bottom:12px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:24px">📄</span>
            <div>
              <div style="font-size:15px;font-weight:700;color:var(--text-main)">${escapeHTML(docName)}</div>
              <div style="font-size:12px;color:var(--text-muted)">${escapeHTML(docSize || 'PDF Document')}</div>
            </div>
          </div>
          <button class="icon-btn" id="closeDocViewerBtn" aria-label="Close document">✕</button>
        </div>

        <div style="height:320px;background:rgba(0,0,0,0.25);border:1px solid var(--border-subtle);border-radius:var(--radius-md);display:flex;flex-direction:column;justify-content:center;align-items:center;padding:24px;text-align:center">
          <div style="font-size:42px;margin-bottom:12px">📑</div>
          <h3 style="font-size:16px;font-weight:700;color:var(--text-main);margin-bottom:6px">IndiChat Document Preview</h3>
          <p style="font-size:13px;color:var(--text-sec);max-width:380px;line-height:1.5">
            End-to-end encrypted document preview rendered locally. Document verified with authentic SHA-256 integrity hash.
          </p>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px">
          <button class="studio-btn" id="btnDownloadDocDemo">📥 Download (Simulated)</button>
          <button class="studio-btn active" id="btnCloseDocViewerAction">Close</button>
        </div>
      </div>
    `;

    modal.style.display = 'grid';
    onModalOpened(modal);
    document.getElementById('closeDocViewerBtn')?.addEventListener('click', () => closeModalElement(modal));
    document.getElementById('btnCloseDocViewerAction')?.addEventListener('click', () => closeModalElement(modal));
    document.getElementById('btnDownloadDocDemo')?.addEventListener('click', () => {
      showToast(`Simulated: Downloaded ${docName}`);
    });
  }

  // --- 6. Send Local Message Flow ---
  function sendMessage(text, customType = 'text', customPayload = {}) {
    if (!text && customType === 'text') return;
    const c = state.contacts.find(item => item.id === state.activeContactId);
    if (!c) return;

    const newMsgId = 'msg-' + Date.now();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg = {
      id: newMsgId,
      sender: 'me',
      senderDisplayName: state.userProfile.displayName || 'You',
      type: customType,
      text: text ? text.trim() : '',
      time: nowTime,
      status: 'sent',
      starred: false,
      reactions: {},
      replyTo: state.replyTarget ? {
        senderDisplayName: state.replyTarget.senderName,
        content: state.replyTarget.text
      } : null,
      ...customPayload
    };

    c.messages.push(newMsg);
    state.replyTarget = null;
    delete state.drafts[c.id];

    saveState();
    renderChatWindow();
    renderConversationList();

    // Progression 1: Sent -> Delivered (after 600ms)
    setTimeout(() => {
      newMsg.status = 'delivered';
      saveState();
      renderChatWindow();
      renderConversationList();
    }, 600);

    // Progression 2: Delivered -> Read Cyan (after 1400ms)
    setTimeout(() => {
      newMsg.status = 'read';
      saveState();
      renderChatWindow();
      renderConversationList();
    }, 1400);
  }

  // --- 7. Emoji, GIF & Sticker Picker ---
  function setupEmojiGifStickerPicker() {
    const btn = document.getElementById('btnEmojiPickerToggle');
    const panel = document.getElementById('emojiGifStickerPanel');
    if (!btn || !panel) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.pickerPanelOpen = !state.pickerPanelOpen;
      panel.style.display = state.pickerPanelOpen ? 'flex' : 'none';
      if (state.pickerPanelOpen) renderPickerContent();
    });

    // Tab buttons
    panel.querySelectorAll('.picker-tab-btn').forEach(tbtn => {
      tbtn.addEventListener('click', () => {
        panel.querySelectorAll('.picker-tab-btn').forEach(b => b.classList.remove('active'));
        tbtn.classList.add('active');
        state.activePickerTab = tbtn.getAttribute('data-picker-tab');
        renderPickerContent();
      });
    });

    document.addEventListener('click', (e) => {
      if (state.pickerPanelOpen && !panel.contains(e.target) && e.target !== btn) {
        panel.style.display = 'none';
        state.pickerPanelOpen = false;
      }
    });
  }

  function renderPickerContent() {
    const container = document.getElementById('pickerContentScroll');
    if (!container) return;

    if (state.activePickerTab === 'emoji') {
      container.innerHTML = `
        <div class="emoji-grid">
          ${fixtures.SAMPLE_EMOJIS.map(em => `
            <button class="emoji-btn-item" data-insert-emoji="${em}" aria-label="Insert ${em}">${em}</button>
          `).join('')}
        </div>
      `;
      container.querySelectorAll('[data-insert-emoji]').forEach(ebtn => {
        ebtn.addEventListener('click', () => {
          const emoji = ebtn.getAttribute('data-insert-emoji');
          const input = document.getElementById('composerInputField');
          if (input) {
            input.value += emoji;
            input.focus();
          }
        });
      });
    } else if (state.activePickerTab === 'gif') {
      container.innerHTML = `
        <div class="gif-grid">
          ${fixtures.SAMPLE_GIFS.map(g => `
            <div class="gif-card-btn" data-send-gif="${escapeHTML(g.url)}" data-gif-title="${escapeHTML(g.title)}">
              <img src="${escapeHTML(g.url)}" alt="${escapeHTML(g.title)}" style="width:100%;display:block" />
            </div>
          `).join('')}
        </div>
      `;
      container.querySelectorAll('[data-send-gif]').forEach(gcard => {
        gcard.addEventListener('click', () => {
          const url = gcard.getAttribute('data-send-gif');
          const title = gcard.getAttribute('data-gif-title');
          sendMessage('', 'image', {
            imageUrl: url,
            imageTitle: title,
            imageSubtitle: 'Sent via GIF Picker'
          });
          document.getElementById('emojiGifStickerPanel').style.display = 'none';
          state.pickerPanelOpen = false;
        });
      });
    } else if (state.activePickerTab === 'sticker') {
      container.innerHTML = `
        <div class="sticker-grid">
          ${fixtures.SAMPLE_STICKERS.map(st => `
            <div class="sticker-card-btn" data-send-sticker="${escapeHTML(st.url)}" data-sticker-name="${escapeHTML(st.name)}">
              <img src="${escapeHTML(st.url)}" alt="${escapeHTML(st.name)}" style="width:70px;height:70px" />
            </div>
          `).join('')}
        </div>
      `;
      container.querySelectorAll('[data-send-sticker]').forEach(scard => {
        scard.addEventListener('click', () => {
          const url = scard.getAttribute('data-send-sticker');
          const name = scard.getAttribute('data-sticker-name');
          sendMessage('', 'image', {
            imageUrl: url,
            imageTitle: name,
            imageSubtitle: 'IndiChat Sticker Pack'
          });
          document.getElementById('emojiGifStickerPanel').style.display = 'none';
          state.pickerPanelOpen = false;
        });
      });
    }
  }

  // --- 8. Attachment Preview Flow ---
  function openAttachmentPreviewModal(type, title, defaultSize, previewUrl) {
    let modal = document.getElementById('attachmentPreviewModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'attachmentPreviewModal';
      modal.className = 'modal-backdrop';
      const windowMockup = document.querySelector('.window-mockup');
      if (windowMockup) windowMockup.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card" style="max-width:480px">
        <div class="modal-header">
          <h2>Send ${escapeHTML(title)}</h2>
          <button class="icon-btn" id="closeAttachPreviewBtn" aria-label="Cancel attachment">✕</button>
        </div>
        <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
          <div style="height:180px;background:#0d151c;border-radius:var(--radius-md);border:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:center;overflow:hidden">
            ${type === 'document' ? `
              <div style="text-align:center">
                <div style="font-size:42px;margin-bottom:6px">📄</div>
                <div style="font-weight:700;color:var(--text-main)">${escapeHTML(title)}</div>
                <div style="font-size:12px;color:var(--text-muted)">${escapeHTML(defaultSize)}</div>
              </div>
            ` : `
              <img src="${escapeHTML(previewUrl)}" alt="Preview" style="max-height:100%;max-width:100%;object-fit:cover" />
            `}
          </div>

          <div>
            <label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px">Caption</label>
            <input type="text" class="composer-input-field" id="attachmentCaptionInput" placeholder="Add a caption..." style="width:100%" autocomplete="off">
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:6px">
            <button class="studio-btn" id="btnCancelAttachment">Cancel</button>
            <button class="studio-btn active" id="btnConfirmSendAttachment">Send Attachment</button>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'grid';
    onModalOpened(modal);

    document.getElementById('closeAttachPreviewBtn')?.addEventListener('click', () => closeModalElement(modal));
    document.getElementById('btnCancelAttachment')?.addEventListener('click', () => closeModalElement(modal));

    document.getElementById('btnConfirmSendAttachment')?.addEventListener('click', () => {
      const caption = document.getElementById('attachmentCaptionInput')?.value || '';
      closeModalElement(modal);

      if (type === 'document') {
        sendMessage(caption, 'document', {
          docName: title,
          docSize: defaultSize
        });
      } else {
        sendMessage(caption, 'image', {
          imageUrl: previewUrl,
          imageTitle: title,
          imageSubtitle: 'Photo Attachment'
        });
      }
      showToast('Attachment sent!');
    });
  }

  // --- 9. UPI ₹ Payment Dialog ---
  function openPaymentDialog() {
    let modal = document.getElementById('paymentModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'paymentModal';
      modal.className = 'modal-backdrop';
      const windowMockup = document.querySelector('.window-mockup');
      if (windowMockup) windowMockup.appendChild(modal);
    }

    const c = state.contacts.find(item => item.id === state.activeContactId) || state.contacts[0];

    modal.innerHTML = `
      <div class="modal-card" style="max-width:400px">
        <div class="modal-header">
          <h2>Send Money via UPI (Simulated)</h2>
          <button class="icon-btn" id="closePaymentModalBtn" aria-label="Cancel payment">✕</button>
        </div>
        <div style="padding:24px;display:flex;flex-direction:column;gap:16px">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:40px;height:40px;border-radius:12px;background:${c.avatarColor};color:#fff;display:grid;place-items:center;font-weight:700">
              ${c.avatarInitials}
            </div>
            <div>
              <div style="font-size:14px;font-weight:750;color:var(--text-main)">Paying to ${escapeHTML(c.name)}</div>
              <div style="font-size:12px;color:var(--text-muted)">UPI ID: ${escapeHTML(c.username)}@indichat</div>
            </div>
          </div>

          <div>
            <label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px">Amount (₹)</label>
            <input type="number" class="composer-input-field" id="paymentAmountInput" value="500" style="font-size:24px;font-weight:800;color:var(--brand-emerald);width:100%">
          </div>

          <div>
            <label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px">Note</label>
            <input type="text" class="composer-input-field" id="paymentNoteInput" value="Project lunch bill 🍛" style="width:100%">
          </div>

          <div>
            <label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px">Simulated 4-Digit UPI PIN</label>
            <input type="password" maxlength="4" class="composer-input-field" id="paymentPinInput" value="1234" style="letter-spacing:8px;font-size:18px;width:100%;text-align:center">
          </div>

          <button class="studio-btn active" id="btnConfirmPayment" style="justify-content:center;padding:12px;font-size:14px">
            Pay ₹ with UPI Demo
          </button>
        </div>
      </div>
    `;

    modal.style.display = 'grid';
    onModalOpened(modal);
    document.getElementById('closePaymentModalBtn')?.addEventListener('click', () => closeModalElement(modal));

    document.getElementById('btnConfirmPayment')?.addEventListener('click', () => {
      const amount = document.getElementById('paymentAmountInput')?.value || '500';
      const note = document.getElementById('paymentNoteInput')?.value || 'UPI Payment';
      closeModalElement(modal);

      sendMessage(note, 'payment', {
        amount: `₹${amount}`,
        paymentStatus: 'Paid'
      });
      showToast(`Payment of ₹${amount} sent!`);
    });
  }

  // --- 10. In-Chat Message Search ---
  function setupInChatSearch() {
    const searchBtn = document.getElementById('btnToggleInChatSearch');
    const searchBar = document.getElementById('inChatSearchBar');
    const searchInput = document.getElementById('inChatSearchInput');
    const closeBtn = document.getElementById('btnCloseInChatSearch');
    const prevBtn = document.getElementById('btnInChatPrev');
    const nextBtn = document.getElementById('btnInChatNext');
    const countEl = document.getElementById('inChatMatchesCount');

    if (!searchBtn || !searchBar) return;

    searchBtn.addEventListener('click', () => {
      state.inChatSearchOpen = !state.inChatSearchOpen;
      renderChatWindow();
      if (state.inChatSearchOpen && searchInput) {
        searchInput.focus();
      }
    });

    closeBtn?.addEventListener('click', () => {
      state.inChatSearchOpen = false;
      state.inChatSearchQuery = '';
      renderChatWindow();
    });

    searchInput?.addEventListener('input', (e) => {
      state.inChatSearchQuery = e.target.value;
      const c = state.contacts.find(item => item.id === state.activeContactId);
      if (c && state.inChatSearchQuery.trim()) {
        const q = state.inChatSearchQuery.toLowerCase();
        state.inChatMatches = c.messages.filter(m => (m.text || '').toLowerCase().includes(q));
      } else {
        state.inChatMatches = [];
      }
      state.inChatMatchIndex = 0;
      updateMatchCountDisplay();
      renderChatWindow();
    });

    prevBtn?.addEventListener('click', () => {
      if (state.inChatMatches.length > 0) {
        state.inChatMatchIndex = (state.inChatMatchIndex - 1 + state.inChatMatches.length) % state.inChatMatches.length;
        scrollToMatchedBubble();
        updateMatchCountDisplay();
      }
    });

    nextBtn?.addEventListener('click', () => {
      if (state.inChatMatches.length > 0) {
        state.inChatMatchIndex = (state.inChatMatchIndex + 1) % state.inChatMatches.length;
        scrollToMatchedBubble();
        updateMatchCountDisplay();
      }
    });

    function updateMatchCountDisplay() {
      if (countEl) {
        if (state.inChatMatches.length > 0) {
          countEl.textContent = `${state.inChatMatchIndex + 1} of ${state.inChatMatches.length}`;
        } else {
          countEl.textContent = state.inChatSearchQuery.trim() ? '0 matches' : '';
        }
      }
    }

    function scrollToMatchedBubble() {
      const match = state.inChatMatches[state.inChatMatchIndex];
      if (match) {
        const el = document.getElementById(`bubble-${match.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  // --- 11. New Chat & New Group Flow ---
  function openNewChatModal() {
    let modal = document.getElementById('newChatModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'newChatModal';
      modal.className = 'modal-backdrop';
      const windowMockup = document.querySelector('.window-mockup');
      if (windowMockup) windowMockup.appendChild(modal);
    }

    renderNewChatModalContent(modal);
    modal.style.display = 'grid';
    onModalOpened(modal);
  }

  function renderNewChatModalContent(modal) {
    modal.innerHTML = `
      <div class="modal-card" style="max-width:480px">
        <div class="modal-header">
          <h2>New Conversation</h2>
          <button class="icon-btn" id="closeNewChatBtn" aria-label="Close dialog">✕</button>
        </div>
        <div class="picker-tabs-header">
          <button class="picker-tab-btn ${state.newChatTab === 'direct' ? 'active' : ''}" id="tabNewChatDirect">Direct Chat</button>
          <button class="picker-tab-btn ${state.newChatTab === 'group' ? 'active' : ''}" id="tabNewChatGroup">New Group</button>
        </div>
        <div style="padding:16px 20px;overflow-y:auto;max-height:480px">
          ${state.newChatTab === 'direct' ? `
            <div style="margin-bottom:12px">
              <input type="text" class="composer-input-field" id="newChatSearchContacts" placeholder="Search contacts by name or phone..." style="width:100%">
            </div>
            <div style="display:flex;flex-direction:column;gap:8px" id="newChatContactsList">
              ${fixtures.DEFAULT_CONTACTS_DIRECTORY.map(u => `
                <button class="menu-item-row" data-start-chat-uid="${u.id}" style="width:100%;border:1px solid var(--border-subtle);border-radius:var(--radius-md)">
                  <div style="width:36px;height:36px;border-radius:10px;background:${u.color};color:#fff;display:grid;place-items:center;font-weight:700">
                    ${u.initials}
                  </div>
                  <div style="flex:1;min-width:0;text-align:left">
                    <div style="font-size:13.5px;font-weight:650;color:var(--text-main)">${escapeHTML(u.name)}</div>
                    <div style="font-size:11.5px;color:var(--text-muted)">${escapeHTML(u.phone)} · @${escapeHTML(u.username)}</div>
                  </div>
                  <span style="color:var(--brand-emerald);font-size:18px">💬</span>
                </button>
              `).join('')}
            </div>
          ` : `
            <div style="margin-bottom:14px">
              <label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px">Group Subject</label>
              <input type="text" class="composer-input-field" id="newGroupNameInput" placeholder="Group name..." style="width:100%">
            </div>
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px">Select Participants</div>
            <div style="display:flex;flex-direction:column;gap:8px" id="groupParticipantsChecklist">
              ${fixtures.DEFAULT_CONTACTS_DIRECTORY.map(u => `
                <label style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:var(--input-bg);border-radius:var(--radius-md);border:1px solid var(--border-subtle);cursor:pointer">
                  <input type="checkbox" value="${u.name}" style="width:18px;height:18px;accent-color:var(--brand-emerald)">
                  <div style="width:30px;height:30px;border-radius:8px;background:${u.color};color:#fff;display:grid;place-items:center;font-weight:700;font-size:12px">
                    ${u.initials}
                  </div>
                  <div style="flex:1;font-size:13px;font-weight:600;color:var(--text-main)">${escapeHTML(u.name)}</div>
                </label>
              `).join('')}
            </div>
            <div style="display:flex;justify-content:flex-end;margin-top:16px">
              <button class="studio-btn active" id="btnCreateGroupAction" style="padding:10px 18px">Create Group</button>
            </div>
          `}
        </div>
      </div>
    `;

    document.getElementById('closeNewChatBtn')?.addEventListener('click', () => closeModalElement(modal));

    document.getElementById('tabNewChatDirect')?.addEventListener('click', () => {
      state.newChatTab = 'direct';
      renderNewChatModalContent(modal);
    });
    document.getElementById('tabNewChatGroup')?.addEventListener('click', () => {
      state.newChatTab = 'group';
      renderNewChatModalContent(modal);
    });

    // Direct chat click
    modal.querySelectorAll('[data-start-chat-uid]').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.getAttribute('data-start-chat-uid');
        const user = fixtures.DEFAULT_CONTACTS_DIRECTORY.find(u => u.id === uid);
        if (user) {
          closeModalElement(modal);
          let existing = state.contacts.find(c => c.name === user.name);
          if (!existing) {
            existing = {
              id: 'c-' + Date.now(),
              name: user.name,
              username: user.username,
              avatarColor: user.color,
              avatarInitials: user.initials,
              phoneNumber: user.phone,
              bio: user.bio,
              online: user.isOnline,
              statusText: user.isOnline ? 'Online' : 'Last seen recently',
              unreadCount: 0,
              isGroup: false,
              pinned: false,
              starred: false,
              blocked: false,
              encryptionKey: '1192 8847 5520 1934 9012 3847 1192 8475',
              messages: [
                {
                  id: 'm-init-' + Date.now(),
                  sender: 'them',
                  senderDisplayName: user.name,
                  type: 'text',
                  text: `Hey! Connected with ${user.name} on IndiChat ✨`,
                  time: 'Now',
                  status: 'read'
                }
              ]
            };
            state.contacts.unshift(existing);
          }
          setActiveRailTab('chats');
          setActiveContact(existing.id);
          showToast(`Started conversation with ${user.name}`);
        }
      });
    });

    // Create group click
    document.getElementById('btnCreateGroupAction')?.addEventListener('click', () => {
      const gname = document.getElementById('newGroupNameInput')?.value;
      if (!gname || !gname.trim()) {
        alert('Please enter a group subject name');
        return;
      }
      const checkboxes = modal.querySelectorAll('#groupParticipantsChecklist input[type="checkbox"]:checked');
      const members = Array.from(checkboxes).map((cb) => cb.value);

      modal.style.display = 'none';
      const newGroup = {
        id: 'c-grp-' + Date.now(),
        name: gname.trim(),
        username: gname.trim().toLowerCase().replace(/\s+/g, '_'),
        avatarColor: 'linear-gradient(135deg, #06b6d4, #005c4b)',
        avatarInitials: gname.trim().slice(0, 2).toUpperCase(),
        phoneNumber: `${members.length + 1} participants`,
        bio: `Group created by ${state.userProfile.displayName}`,
        online: false,
        statusText: `${members.length + 1} members`,
        unreadCount: 0,
        isGroup: true,
        pinned: false,
        starred: false,
        blocked: false,
        encryptionKey: '9901 2487 6301 9823 4410 3842 9014 2855',
        messages: [
          {
            id: 'm-grp-init',
            sender: 'them',
            senderDisplayName: 'System',
            type: 'text',
            text: `You created group "${gname.trim()}" with ${members.length} members.`,
            time: 'Now',
            status: 'read'
          }
        ]
      };
      state.contacts.unshift(newGroup);
      saveState();
      closeModalElement(modal);
      setActiveRailTab('chats');
      setActiveContact(newGroup.id);
      showToast(`Group "${gname.trim()}" created!`);
    });
  }

  // --- 12. Audio & Video Call Overlay Simulation ---
  function startCallSimulation(isVideo = false, contact = null) {
    const c = contact || state.contacts.find(item => item.id === state.activeContactId) || state.contacts[0];
    state.callModalOpen = true;
    state.callSeconds = 0;
    state.callIsVideo = isVideo;
    state.callActiveContact = c;
    state.callIsMuted = false;
    state.callCameraOff = false;

    let overlay = document.getElementById('callOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'callOverlay';
      overlay.className = 'call-simulation-overlay';
      const windowMockup = document.querySelector('.window-mockup');
      if (windowMockup) windowMockup.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div style="text-align: center; margin-top: 10px;">
        <span class="platform-pill" style="color:var(--brand-emerald);background:rgba(16,185,129,0.15)">
          Simulated ${isVideo ? 'Video' : 'Audio'} Call · Hardware Safe
        </span>
      </div>

      <div style="display: flex; flex-direction: column; align-items: center;">
        <div class="call-hero-avatar" style="background: ${c.avatarColor}">
          ${c.avatarInitials}
        </div>
        <h2 style="font-size: 24px; font-weight: 750;">${escapeHTML(c.name)}</h2>
        <div class="call-timer" id="callTimerLabel">Connecting...</div>
      </div>

      <div class="call-controls-bar">
        <button class="call-ctrl-btn" id="callMuteBtn" aria-label="Toggle mute" title="Mute">🎤</button>
        <button class="call-ctrl-btn" id="callVideoBtn" aria-label="Toggle camera" title="Camera">📹</button>
        <button class="call-ctrl-btn end-call" id="endCallBtn" aria-label="End call" title="End Call">✕</button>
      </div>
    `;

    overlay.style.display = 'flex';
    onModalOpened(overlay);

    if (callTimerInterval) clearInterval(callTimerInterval);
    callTimerInterval = setInterval(() => {
      state.callSeconds++;
      const mins = String(Math.floor(state.callSeconds / 60)).padStart(2, '0');
      const secs = String(state.callSeconds % 60).padStart(2, '0');
      const label = document.getElementById('callTimerLabel');
      if (label) label.textContent = `${mins}:${secs} (Simulated)`;
    }, 1000);

    document.getElementById('endCallBtn')?.addEventListener('click', endCallSimulation);

    document.getElementById('callMuteBtn')?.addEventListener('click', () => {
      state.callIsMuted = !state.callIsMuted;
      document.getElementById('callMuteBtn')?.classList.toggle('active', state.callIsMuted);
      showToast(state.callIsMuted ? 'Microphone muted (Simulated)' : 'Microphone unmuted');
    });

    document.getElementById('callVideoBtn')?.addEventListener('click', () => {
      state.callCameraOff = !state.callCameraOff;
      document.getElementById('callVideoBtn')?.classList.toggle('active', state.callCameraOff);
      showToast(state.callCameraOff ? 'Camera turned off (Simulated)' : 'Camera turned on');
    });
  }

  function endCallSimulation() {
    state.callModalOpen = false;
    if (callTimerInterval) clearInterval(callTimerInterval);
    const overlay = document.getElementById('callOverlay');
    onModalClosed(overlay);

    // Add record to call logs!
    if (state.callActiveContact) {
      const mins = Math.floor(state.callSeconds / 60);
      const secs = state.callSeconds % 60;
      const durationStr = state.callSeconds > 0 ? `${mins}m ${secs}s` : 'Missed';
      state.callLogs.unshift({
        id: 'cl-' + Date.now(),
        name: state.callActiveContact.name,
        type: 'outgoing',
        date: 'Just now',
        duration: durationStr,
        isVideo: state.callIsVideo,
        color: state.callActiveContact.avatarColor || '#10b981',
        initials: state.callActiveContact.avatarInitials || 'CC'
      });
      saveState();
      if (state.activeRailTab === 'calls') renderCallsView();
    }
    showToast('Call ended and saved to recent history');
  }

  // --- 13. Details Panel Render & Actions ---
  function renderDetailsPanel() {
    const panelEl = document.getElementById('detailsPanel');
    if (!panelEl) return;

    if (!state.detailsPanelOpen) {
      panelEl.classList.add('collapsed');
      return;
    }
    panelEl.classList.remove('collapsed');

    const c = state.contacts.find(item => item.id === state.activeContactId);
    if (!c) return;

    panelEl.innerHTML = `
      <div class="details-header">
        <span>Contact info</span>
        <button class="icon-btn" id="closeDetailsBtn" aria-label="Close contact details">✕</button>
      </div>
      <div class="details-hero">
        <div class="details-hero-avatar" style="background: ${c.avatarColor}">
          ${c.avatarInitials}
        </div>
        <div class="details-hero-name">${escapeHTML(c.name)}</div>
        <div class="details-hero-phone">${escapeHTML(c.phoneNumber)}</div>
      </div>
      <div class="details-section">
        <div class="details-section-title">About</div>
        <div class="details-bio-box">${escapeHTML(c.bio)}</div>
      </div>
      <div class="details-section">
        <div class="details-section-title">Media, Links and Docs</div>
        <div class="details-media-grid">
          ${(fixtures.DEFAULT_CONTACTS[0].messages.filter(m => m.type === 'image' || m.type === 'document')).concat([
            { type: 'image', text: 'Architecture Diagram', imageUrl: fixtures.DEFAULT_CONTACTS[0].messages[2].imageUrl },
            { type: 'document', docName: 'Roadmap_2026.pdf', docSize: '1.2 MB' }
          ]).slice(0, 6).map((m, i) => `
            <div class="media-thumbnail-chip" title="${escapeHTML(m.text || m.docName || 'Media')}" data-chip-idx="${i}" data-chip-type="${m.type}" data-chip-url="${escapeHTML(m.imageUrl || '')}" data-chip-doc="${escapeHTML(m.docName || '')}" data-chip-size="${escapeHTML(m.docSize || '')}" style="cursor:pointer">
              <span>${m.type === 'document' ? '📄' : '🎨'}</span>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="details-section" id="btnVerifyEncryptionSection" role="button" tabindex="0" style="cursor:pointer" title="Click to verify safety numbers">
        <div class="details-section-title" style="display:flex;justify-content:space-between;align-items:center">
          <span>Encryption</span>
          ${c.verified ? '<span style="color:var(--brand-emerald);font-size:11px;font-weight:700">✓ Verified</span>' : '<span style="color:var(--text-muted);font-size:10px">Click to verify</span>'}
        </div>
        <div style="display:flex;align-items:flex-start;gap:10px;font-size:12px;color:var(--text-sec);line-height:1.4">
          <span style="color:var(--brand-emerald)">🔒</span>
          <div>
            Messages and calls are end-to-end encrypted. Tap to verify safety numbers.
            <div style="font-family:var(--font-mono);font-size:10px;margin-top:6px;color:var(--text-muted)">
              ${c.encryptionKey}
            </div>
          </div>
        </div>
      </div>
      <div class="details-section">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span style="font-size:13px;font-weight:600;color:var(--text-main)">Mute Notifications</span>
          <input type="checkbox" id="checkMuteContact" style="width:18px;height:18px;accent-color:var(--brand-emerald)">
        </div>
        <button class="studio-btn danger" style="width:100%;justify-content:center" id="btnBlockContactToggle">
          ${c.blocked ? '✓ Unblock Contact' : `🛡 Block ${escapeHTML(c.name.split(' ')[0])}`}
        </button>
      </div>
    `;

    document.getElementById('closeDetailsBtn')?.addEventListener('click', () => {
      state.detailsPanelOpen = false;
      renderDetailsPanel();
    });

    panelEl.querySelectorAll('.media-thumbnail-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const type = chip.getAttribute('data-chip-type');
        if (type === 'image') {
          openLightboxViewer(chip.getAttribute('title') || 'Photo', chip.getAttribute('data-chip-url'), '');
        } else {
          openDocumentViewerModal(chip.getAttribute('data-chip-doc') || 'Document.pdf', chip.getAttribute('data-chip-size') || '1.2 MB');
        }
      });
    });

    document.getElementById('btnVerifyEncryptionSection')?.addEventListener('click', () => {
      openSafetyNumbersModal(c);
    });

    document.getElementById('checkMuteContact')?.addEventListener('change', (e) => {
      showToast(e.target.checked ? 'Notifications muted for this chat' : 'Notifications unmuted');
    });

    document.getElementById('btnBlockContactToggle')?.addEventListener('click', () => {
      c.blocked = !c.blocked;
      saveState();
      renderDetailsPanel();
      renderConversationList();
      showToast(c.blocked ? `Blocked ${c.name}` : `Unblocked ${c.name}`);
    });
  }

  // --- Dialog Focus Management & Modal Lifecycle ---
  const focusStack = [];

  function onModalOpened(modal) {
    if (!modal) return;
    if (document.activeElement && !modal.contains(document.activeElement) && document.activeElement !== document.body) {
      focusStack.push(document.activeElement);
    }
    // Bind backdrop click dismissal (clicking outside modal card dismisses)
    if (!modal._backdropClickAttached) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModalElement(modal);
        }
      });
      modal._backdropClickAttached = true;
    }
    // Auto-focus first interactive element inside dialog
    setTimeout(() => {
      const focusable = modal.querySelector('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button.active:not([disabled]), button:not([disabled]), [tabindex="0"]');
      if (focusable) focusable.focus();
    }, 40);
  }

  function onModalClosed(modal) {
    if (modal) modal.style.display = 'none';
    while (focusStack.length > 0) {
      const returnTarget = focusStack.pop();
      if (returnTarget && document.body.contains(returnTarget) && typeof returnTarget.focus === 'function') {
        try {
          returnTarget.focus();
          break;
        } catch (e) {}
      }
    }
  }

  function closeModalElement(modal) {
    if (!modal) return;
    if (modal.id === 'settingsModalBackdrop') {
      closeSettingsModal();
    } else if (modal.id === 'storyViewerModal') {
      closeStoryViewerModal();
    } else if (modal.id === 'callOverlay') {
      endCallSimulation();
    } else {
      onModalClosed(modal);
    }
  }

  // --- 14. Full Desktop Settings Modal (14 Sub-Pages) ---
  function openSettingsModal(defaultTab = 'profile') {
    state.settingsModalOpen = true;
    state.activeSettingsTab = defaultTab;

    let modal = document.getElementById('settingsModalBackdrop');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'settingsModalBackdrop';
      modal.className = 'modal-backdrop';
      const windowMockup = document.querySelector('.window-mockup');
      if (windowMockup) windowMockup.appendChild(modal);
    }

    renderSettingsModalLayout(modal);
    modal.style.display = 'grid';
    onModalOpened(modal);
  }

  function closeSettingsModal() {
    state.settingsModalOpen = false;
    const modal = document.getElementById('settingsModalBackdrop');
    onModalClosed(modal);
  }

  function renderSettingsModalLayout(modal) {
    const tabs = [
      { id: 'profile', icon: '👤', label: 'Profile' },
      { id: 'account', icon: '🔒', label: 'Account & Security' },
      { id: 'appearance', icon: '🎨', label: 'Appearance & Themes' },
      { id: 'wallpaper', icon: '🖼', label: 'Chat Wallpaper' },
      { id: 'chats', icon: '💬', label: 'Chat Settings' },
      { id: 'privacy', icon: '👁', label: 'Privacy' },
      { id: 'notifications', icon: '🔔', label: 'Notifications' },
      { id: 'language', icon: '🌐', label: 'Language' },
      { id: 'storage', icon: '💾', label: 'Storage & Data' },
      { id: 'backup', icon: '☁', label: 'Chat Backup' },
      { id: 'server', icon: '🔌', label: 'Server Connection' },
      { id: 'devices', icon: '💻', label: 'Linked Devices' },
      { id: 'help', icon: '❓', label: 'Help & About' },
      { id: 'logout', icon: '🚪', label: 'Log Out' }
    ];

    modal.innerHTML = `
      <div class="modal-card" style="max-width:820px;height:640px">
        <div class="modal-header">
          <h2>Settings</h2>
          <button class="icon-btn" id="closeSettingsModalX" aria-label="Close settings">✕</button>
        </div>
        <div class="settings-split-layout">
          <!-- Left Navigation Sidebar -->
          <div class="settings-nav-sidebar" role="tablist">
            ${tabs.map(t => `
              <button class="settings-tab-btn ${state.activeSettingsTab === t.id ? 'active' : ''}" data-settings-tab="${t.id}" role="tab" aria-selected="${state.activeSettingsTab === t.id}">
                <span>${t.icon}</span>
                <span>${t.label}</span>
              </button>
            `).join('')}
          </div>

          <!-- Right Content Area -->
          <div class="settings-content-area" id="settingsContentArea">
            <!-- Rendered by renderSettingsTabContent -->
          </div>
        </div>
      </div>
    `;

    document.getElementById('closeSettingsModalX')?.addEventListener('click', closeSettingsModal);

    modal.querySelectorAll('[data-settings-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeSettingsTab = btn.getAttribute('data-settings-tab');
        modal.querySelectorAll('[data-settings-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderSettingsTabContent();
      });
    });

    renderSettingsTabContent();
  }

  function renderSettingsTabContent() {
    const area = document.getElementById('settingsContentArea');
    if (!area) return;

    const prof = state.userProfile;
    const tab = state.activeSettingsTab;

    if (tab === 'profile') {
      area.innerHTML = `
        <h3 style="font-size:16px;font-weight:750;color:var(--text-main);margin-bottom:16px">Profile Information</h3>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border-subtle)">
          <div style="width:68px;height:68px;border-radius:20px;background:${prof.avatarColor};color:#fff;display:grid;place-items:center;font-size:24px;font-weight:700">
            ${prof.avatarInitials}
          </div>
          <div>
            <div style="font-size:15px;font-weight:700;color:var(--text-main)">${escapeHTML(prof.displayName)}</div>
            <div style="font-size:12px;color:var(--text-muted)">@${escapeHTML(prof.username)}</div>
            <button type="button" class="studio-btn" id="btnOpenAvatarPickerFromSettings" style="margin-top:6px;font-size:11px">Change Avatar Photo</button>
          </div>
        </div>

        <form id="formEditProfile">
          <div class="settings-form-row">
            <label>Display Name</label>
            <input type="text" class="composer-input-field" id="profileDisplayNameInput" value="${escapeHTML(prof.displayName)}" style="width:100%" required>
          </div>
          <div class="settings-form-row">
            <label>Username (Handle)</label>
            <input type="text" class="composer-input-field" id="profileUsernameInput" value="${escapeHTML(prof.username)}" style="width:100%" required>
          </div>
          <div class="settings-form-row">
            <label>Bio / About</label>
            <textarea class="composer-input-field" id="profileBioInput" rows="2" style="width:100%">${escapeHTML(prof.bio)}</textarea>
          </div>
          <div class="settings-form-row">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <label style="margin-bottom:0">Phone Number</label>
              <button type="button" class="studio-btn" id="btnOpenChangePhoneFromSettings" style="font-size:10.5px;padding:2px 8px">Change Phone</button>
            </div>
            <input type="text" class="composer-input-field" id="profilePhoneInput" value="${escapeHTML(prof.phoneNumber)}" style="width:100%">
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px">
            <button type="button" class="studio-btn" id="btnCancelProfileEdit">Cancel</button>
            <button type="submit" class="studio-btn active">Save Profile Changes</button>
          </div>
        </form>
      `;

      document.getElementById('btnOpenAvatarPickerFromSettings')?.addEventListener('click', () => {
        openAvatarPickerModal();
      });

      document.getElementById('btnOpenChangePhoneFromSettings')?.addEventListener('click', () => {
        openChangePhoneModal();
      });

      document.getElementById('btnCancelProfileEdit')?.addEventListener('click', () => {
        renderSettingsTabContent();
        showToast('Profile edits cancelled');
      });

      document.getElementById('formEditProfile')?.addEventListener('submit', (e) => {
        e.preventDefault();
        prof.displayName = document.getElementById('profileDisplayNameInput')?.value || prof.displayName;
        prof.username = document.getElementById('profileUsernameInput')?.value || prof.username;
        prof.bio = document.getElementById('profileBioInput')?.value || prof.bio;
        prof.phoneNumber = document.getElementById('profilePhoneInput')?.value || prof.phoneNumber;
        saveState();
        renderAll();
        showToast('Profile updated successfully!');
      });
    } else if (tab === 'account') {
      area.innerHTML = `
        <h3 style="font-size:16px;font-weight:750;color:var(--text-main);margin-bottom:16px">Account & Security</h3>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div style="padding:14px;background:var(--input-bg);border-radius:var(--radius-md);border:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:13.5px;font-weight:700;color:var(--text-main)">Two-Factor PIN Verification</div>
              <div style="font-size:12px;color:var(--text-muted)">Requires 6-digit PIN on new device pairing</div>
            </div>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="check2FAEnabled" ${prof.twoFactorEnabled ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--brand-emerald)">
              <span style="font-size:13px;font-weight:600;color:var(--text-main)">${prof.twoFactorEnabled ? 'Enabled' : 'Disabled'}</span>
            </label>
          </div>

          <div style="padding:14px;background:var(--input-bg);border-radius:var(--radius-md);border:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:13.5px;font-weight:700;color:var(--text-main)">Passkeys (FIDO2 / WebAuthn)</div>
              <div style="font-size:12px;color:var(--text-muted)">${(state.passkeys || []).length} enrolled (${(state.passkeys || []).map(p => p.name).join(', ')})</div>
            </div>
            <button class="studio-btn active" id="btnRegisterPasskeyDemo">Manage Passkeys</button>
          </div>

          <div style="padding:14px;background:var(--input-bg);border-radius:var(--radius-md);border:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:13.5px;font-weight:700;color:var(--text-main)">Password</div>
              <div style="font-size:12px;color:var(--text-muted)">Last changed: ${escapeHTML(prof.lastPasswordChanged || '14 days ago')}</div>
            </div>
            <button class="studio-btn" id="btnChangePasswordPrompt">Change Password</button>
          </div>

          <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:13.5px;font-weight:700;color:var(--accent-danger)">Delete Account</div>
              <div style="font-size:12px;color:var(--text-muted)">Permanently wipe conversation history and profile</div>
            </div>
            <button class="studio-btn danger" id="btnDeleteAccountPrompt">Delete My Account</button>
          </div>
        </div>
      `;

      document.getElementById('check2FAEnabled')?.addEventListener('change', (e) => {
        prof.twoFactorEnabled = e.target.checked;
        saveState();
        renderSettingsTabContent();
        showToast(prof.twoFactorEnabled ? '2FA Enabled' : '2FA Disabled');
      });

      document.getElementById('btnRegisterPasskeyDemo')?.addEventListener('click', () => {
        openPasskeysModal();
      });

      document.getElementById('btnChangePasswordPrompt')?.addEventListener('click', () => {
        openChangePasswordModal();
      });

      document.getElementById('btnDeleteAccountPrompt')?.addEventListener('click', () => {
        openDeleteAccountModal();
      });
    } else if (tab === 'appearance') {
      area.innerHTML = `
        <h3 style="font-size:16px;font-weight:750;color:var(--text-main);margin-bottom:16px">Appearance & Materials</h3>
        <div class="settings-form-row">
          <label>Theme</label>
          <div style="display:flex;gap:12px;margin-top:6px">
            <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--input-bg);border:1px solid var(--border-subtle);border-radius:var(--radius-md);cursor:pointer">
              <input type="radio" name="appThemeRadio" value="dark" ${prof.appearanceMode === 'dark' ? 'checked' : ''} style="accent-color:var(--brand-emerald)">
              <span style="font-size:13px;font-weight:600;color:var(--text-main)">Dark Obsidian</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--input-bg);border:1px solid var(--border-subtle);border-radius:var(--radius-md);cursor:pointer">
              <input type="radio" name="appThemeRadio" value="light" ${prof.appearanceMode === 'light' ? 'checked' : ''} style="accent-color:var(--brand-emerald)">
              <span style="font-size:13px;font-weight:600;color:var(--text-main)">Daylight Light</span>
            </label>
          </div>
        </div>

        <div class="settings-form-row" style="margin-top:16px">
          <label>Blur Intensity (${prof.blurRadius || 20}px)</label>
          <input type="range" min="0" max="40" value="${prof.blurRadius || 20}" id="rangeBlurRadius" style="width:100%;accent-color:var(--brand-emerald)">
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;margin-top:16px">
          <label style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--input-bg);border-radius:var(--radius-md);cursor:pointer">
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--text-main)">Reduce Transparency</div>
              <div style="font-size:11.5px;color:var(--text-muted)">Solid opaque surfaces fallback</div>
            </div>
            <input type="checkbox" id="checkReduceTransp" ${prof.reduceTransparency ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--brand-emerald)">
          </label>

          <label style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--input-bg);border-radius:var(--radius-md);cursor:pointer">
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--text-main)">Reduced Motion</div>
              <div style="font-size:11.5px;color:var(--text-muted)">Minimizes animations and transitions</div>
            </div>
            <input type="checkbox" id="checkReducedMotion" ${prof.reducedMotion ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--brand-emerald)">
          </label>
        </div>
      `;

      area.querySelectorAll('input[name="appThemeRadio"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          prof.appearanceMode = e.target.value;
          saveState();
          applyThemeAndMaterials();
        });
      });

      document.getElementById('rangeBlurRadius')?.addEventListener('input', (e) => {
        prof.blurRadius = parseInt(e.target.value, 10);
        document.documentElement.style.setProperty('--glass-blur', `${prof.blurRadius}px`);
        saveState();
      });

      document.getElementById('checkReduceTransp')?.addEventListener('change', (e) => {
        prof.reduceTransparency = e.target.checked;
        saveState();
        applyThemeAndMaterials();
      });

      document.getElementById('checkReducedMotion')?.addEventListener('change', (e) => {
        prof.reducedMotion = e.target.checked;
        saveState();
        applyThemeAndMaterials();
      });
    } else if (tab === 'wallpaper') {
      const wallpapers = [
        { id: 'default', label: 'Default Radial', color: '#070b0e' },
        { id: 'emerald', label: 'Emerald Deep', color: '#062b23' },
        { id: 'obsidian', label: 'Pure Obsidian', color: '#040608' },
        { id: 'blue', label: 'Midnight Blue', color: '#0d1e33' },
        { id: 'slate', label: 'Solid Slate', color: '#111a22' }
      ];

      area.innerHTML = `
        <h3 style="font-size:16px;font-weight:750;color:var(--text-main);margin-bottom:16px">Chat Wallpaper</h3>
        <p style="font-size:13px;color:var(--text-sec);margin-bottom:16px">
          Select a background theme for your active conversation window.
        </p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:12px">
          ${wallpapers.map(w => `
            <button class="studio-btn" style="height:90px;flex-direction:column;justify-content:center;background:${w.color};border-color:${prof.chatWallpaper === w.id ? 'var(--brand-emerald)' : 'var(--border-subtle)'};border-width:${prof.chatWallpaper === w.id ? '2px' : '1px'}" data-wallpaper-id="${w.id}">
              <span style="font-size:12px;font-weight:700;color:#fff">${w.label}</span>
              ${prof.chatWallpaper === w.id ? '<span style="color:var(--brand-emerald);font-size:14px;margin-top:4px">✓ Active</span>' : ''}
            </button>
          `).join('')}
        </div>
      `;

      area.querySelectorAll('[data-wallpaper-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          prof.chatWallpaper = btn.getAttribute('data-wallpaper-id');
          saveState();
          applyThemeAndMaterials();
          renderSettingsTabContent();
          showToast(`Wallpaper updated to ${prof.chatWallpaper}`);
        });
      });
    } else if (tab === 'chats') {
      area.innerHTML = `
        <h3 style="font-size:16px;font-weight:750;color:var(--text-main);margin-bottom:16px">Chat Preferences</h3>
        <div style="display:flex;flex-direction:column;gap:14px">
          <label style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--input-bg);border-radius:var(--radius-md);cursor:pointer">
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--text-main)">Enter is Send</div>
              <div style="font-size:11.5px;color:var(--text-muted)">Pressing Enter sends the message; Shift+Enter inserts newline</div>
            </div>
            <input type="checkbox" id="checkEnterIsSend" ${prof.enterIsSend ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--brand-emerald)">
          </label>

          <label style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--input-bg);border-radius:var(--radius-md);cursor:pointer">
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--text-main)">Media Visibility</div>
              <div style="font-size:11.5px;color:var(--text-muted)">Show received media in device gallery</div>
            </div>
            <input type="checkbox" id="checkMediaVisibility" ${prof.mediaVisibility ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--brand-emerald)">
          </label>

          <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:13px;font-weight:650;color:var(--text-main)">Clear Active Chat History</div>
              <div style="font-size:11.5px;color:var(--text-muted)">Deletes all messages in currently selected conversation</div>
            </div>
            <button class="studio-btn danger" id="btnClearActiveChatAction">Clear Chat</button>
          </div>
        </div>
      `;

      document.getElementById('checkEnterIsSend')?.addEventListener('change', (e) => {
        prof.enterIsSend = e.target.checked;
        saveState();
        showToast(prof.enterIsSend ? 'Enter is Send enabled' : 'Enter is Send disabled');
      });

      document.getElementById('checkMediaVisibility')?.addEventListener('change', (e) => {
        prof.mediaVisibility = e.target.checked;
        saveState();
        showToast(prof.mediaVisibility ? 'Media visibility enabled' : 'Media visibility disabled');
      });

      document.getElementById('btnClearActiveChatAction')?.addEventListener('click', () => {
        const c = state.contacts.find(item => item.id === state.activeContactId);
        if (c && confirm(`Clear all messages with ${c.name}?`)) {
          c.messages = [];
          saveState();
          renderChatWindow();
          renderConversationList();
          showToast('Chat history cleared');
        }
      });
    } else if (tab === 'privacy') {
      area.innerHTML = `
        <h3 style="font-size:16px;font-weight:750;color:var(--text-main);margin-bottom:16px">Privacy Settings</h3>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="settings-form-row">
            <label>Who Can See My Last Seen</label>
            <select class="composer-input-field" id="selectLastSeenPrivacy" style="width:100%">
              <option value="Everyone" ${prof.lastSeen === 'Everyone' ? 'selected' : ''}>Everyone</option>
              <option value="My Contacts" ${prof.lastSeen === 'My Contacts' ? 'selected' : ''}>My Contacts</option>
              <option value="Nobody" ${prof.lastSeen === 'Nobody' ? 'selected' : ''}>Nobody</option>
            </select>
          </div>

          <label style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--input-bg);border-radius:var(--radius-md);cursor:pointer">
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--text-main)">Read Receipts (Cyan Checkmarks)</div>
              <div style="font-size:11.5px;color:var(--text-muted)">If disabled, you won't send or see cyan #53bdeb read ticks</div>
            </div>
            <input type="checkbox" id="checkReadReceiptsPrivacy" ${prof.readReceipts ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--brand-emerald)">
          </label>

          <div class="settings-form-row">
            <label>Disappearing Messages Timer</label>
            <select class="composer-input-field" id="selectDisappearingMsg" style="width:100%">
              <option value="Off" ${prof.disappearingMessages === 'Off' ? 'selected' : ''}>Off</option>
              <option value="24 Hours" ${prof.disappearingMessages === '24 Hours' ? 'selected' : ''}>24 Hours</option>
              <option value="7 Days" ${prof.disappearingMessages === '7 Days' ? 'selected' : ''}>7 Days</option>
              <option value="90 Days" ${prof.disappearingMessages === '90 Days' ? 'selected' : ''}>90 Days</option>
            </select>
          </div>

          <div style="margin-top:12px">
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px">Blocked Contacts (${prof.blockedContacts?.length || 0})</div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${(prof.blockedContacts || []).map(b => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--input-bg);border-radius:var(--radius-md);border:1px solid var(--border-subtle)">
                  <span style="font-size:13px;color:var(--text-main)">${escapeHTML(b.name)}</span>
                  <button class="studio-btn" style="padding:4px 8px;font-size:11px" data-unblock-id="${b.id}">Unblock</button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      document.getElementById('selectLastSeenPrivacy')?.addEventListener('change', (e) => {
        prof.lastSeen = e.target.value;
        saveState();
        showToast(`Last seen set to ${prof.lastSeen}`);
      });

      document.getElementById('checkReadReceiptsPrivacy')?.addEventListener('change', (e) => {
        prof.readReceipts = e.target.checked;
        saveState();
        renderChatWindow();
        renderConversationList();
        showToast(prof.readReceipts ? 'Read receipts enabled (Cyan ticks active)' : 'Read receipts disabled');
      });

      document.getElementById('selectDisappearingMsg')?.addEventListener('change', (e) => {
        prof.disappearingMessages = e.target.value;
        saveState();
        showToast(`Disappearing messages set to ${prof.disappearingMessages}`);
      });

      area.querySelectorAll('[data-unblock-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const bid = btn.getAttribute('data-unblock-id');
          prof.blockedContacts = (prof.blockedContacts || []).filter(b => b.id !== bid);
          saveState();
          renderSettingsTabContent();
          showToast('Contact unblocked');
        });
      });
    } else if (tab === 'notifications') {
      area.innerHTML = `
        <h3 style="font-size:16px;font-weight:750;color:var(--text-main);margin-bottom:16px">Notification Preferences</h3>
        <div style="display:flex;flex-direction:column;gap:12px">
          <label style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--input-bg);border-radius:var(--radius-md);cursor:pointer">
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--text-main)">Message Notifications</div>
              <div style="font-size:11.5px;color:var(--text-muted)">Show desktop banners for incoming messages</div>
            </div>
            <input type="checkbox" id="checkNotifMsg" ${prof.notifications?.messages ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--brand-emerald)">
          </label>

          <label style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--input-bg);border-radius:var(--radius-md);cursor:pointer">
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--text-main)">Reaction Notifications</div>
              <div style="font-size:11.5px;color:var(--text-muted)">Notify when someone reacts to your message</div>
            </div>
            <input type="checkbox" id="checkNotifReaction" ${prof.notifications?.reactions ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--brand-emerald)">
          </label>

          <div class="settings-form-row" style="margin-top:10px">
            <label>Notification Sound Tone</label>
            <div style="display:flex;gap:10px;align-items:center">
              <select class="composer-input-field" id="selectSoundTone" style="flex:1">
                <option value="Brisk" ${prof.notifications?.sound === 'Brisk' ? 'selected' : ''}>Brisk (Default)</option>
                <option value="Chime" ${prof.notifications?.sound === 'Chime' ? 'selected' : ''}>Chime</option>
                <option value="Subtle" ${prof.notifications?.sound === 'Subtle' ? 'selected' : ''}>Subtle</option>
              </select>
              <button class="studio-btn" id="btnTestSoundDemo">▶ Test Tone</button>
            </div>
          </div>
        </div>
      `;

      document.getElementById('checkNotifMsg')?.addEventListener('change', (e) => {
        if (!prof.notifications) prof.notifications = {};
        prof.notifications.messages = e.target.checked;
        saveState();
        showToast(prof.notifications.messages ? 'Message notifications enabled' : 'Message notifications muted');
      });

      document.getElementById('checkNotifReaction')?.addEventListener('change', (e) => {
        if (!prof.notifications) prof.notifications = {};
        prof.notifications.reactions = e.target.checked;
        saveState();
        showToast(prof.notifications.reactions ? 'Reaction alerts enabled' : 'Reaction alerts muted');
      });

      document.getElementById('btnTestSoundDemo')?.addEventListener('click', () => {
        showToast('♪ Playing notification sound tone (Simulated)');
      });
    } else if (tab === 'language') {
      const langs = [
        { id: 'en', label: 'English', native: 'English' },
        { id: 'hi', label: 'Hindi', native: 'हिन्दी' },
        { id: 'es', label: 'Spanish', native: 'Español' },
        { id: 'fr', label: 'French', native: 'Français' },
        { id: 'de', label: 'German', native: 'Deutsch' }
      ];

      area.innerHTML = `
        <h3 style="font-size:16px;font-weight:750;color:var(--text-main);margin-bottom:16px">App Language</h3>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${langs.map(l => `
            <label style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--input-bg);border:1px solid var(--border-subtle);border-radius:var(--radius-md);cursor:pointer">
              <div>
                <span style="font-size:14px;font-weight:650;color:var(--text-main)">${l.native}</span>
                <span style="font-size:12px;color:var(--text-muted);margin-left:8px">(${l.label})</span>
              </div>
              <input type="radio" name="langRadio" value="${l.id}" ${prof.language === l.id ? 'checked' : ''} style="accent-color:var(--brand-emerald)">
            </label>
          `).join('')}
        </div>
      `;

      area.querySelectorAll('input[name="langRadio"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          prof.language = e.target.value;
          saveState();
          showToast(`App language set to ${e.target.value.toUpperCase()}`);
        });
      });
    } else if (tab === 'storage') {
      area.innerHTML = `
        <h3 style="font-size:16px;font-weight:750;color:var(--text-main);margin-bottom:16px">Storage & Data Management</h3>
        <div style="padding:16px;background:var(--input-bg);border-radius:var(--radius-md);border:1px solid var(--border-subtle);margin-bottom:18px">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="font-size:13px;font-weight:700;color:var(--text-main)">Total Local Storage Used</span>
            <span style="font-size:13px;font-weight:700;color:var(--brand-emerald)">204 MB</span>
          </div>
          <div style="height:8px;border-radius:4px;background:rgba(255,255,255,0.1);overflow:hidden;display:flex">
            <div style="width:70%;background:var(--brand-emerald)" title="Media: 142 MB"></div>
            <div style="width:18%;background:var(--accent-blue)" title="Docs: 38 MB"></div>
            <div style="width:12%;background:var(--accent-warning)" title="Cache: 24 MB"></div>
          </div>
          <div style="display:flex;gap:16px;margin-top:10px;font-size:11.5px;color:var(--text-muted)">
            <span>🟢 Media (142 MB)</span>
            <span>🔵 Docs (38 MB)</span>
            <span>🟠 Cache (24 MB)</span>
          </div>
        </div>

        <button class="studio-btn" id="btnClearCacheDemo" style="width:100%;justify-content:center;padding:12px">
          🗑 Clear Temporary Cache (Reclaim 24 MB)
        </button>
      `;

      document.getElementById('btnClearCacheDemo')?.addEventListener('click', () => {
        showToast('24 MB of temporary media cache cleared!');
      });
    } else if (tab === 'backup') {
      area.innerHTML = `
        <h3 style="font-size:16px;font-weight:750;color:var(--text-main);margin-bottom:16px">Chat Backup</h3>
        <div style="padding:16px;background:var(--input-bg);border-radius:var(--radius-md);border:1px solid var(--border-subtle);margin-bottom:18px">
          <div style="font-size:13.5px;font-weight:700;color:var(--text-main);margin-bottom:4px">Last Cloud / Local Backup</div>
          <div style="font-size:12.5px;color:var(--brand-emerald)">${escapeHTML(prof.lastBackupDate || 'Today, 04:15 AM')}</div>
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px;line-height:1.5">
            Backups include all messages, media tokens, and contact public encryption verification records.
          </p>
        </div>

        <div class="settings-form-row">
          <label>Auto-Backup Frequency</label>
          <select class="composer-input-field" id="selectBackupFreq" style="width:100%">
            <option value="Daily" ${prof.backupFrequency === 'Daily' ? 'selected' : ''}>Daily</option>
            <option value="Weekly" ${prof.backupFrequency === 'Weekly' ? 'selected' : ''}>Weekly</option>
            <option value="Monthly" ${prof.backupFrequency === 'Monthly' ? 'selected' : ''}>Monthly</option>
            <option value="Off" ${prof.backupFrequency === 'Off' ? 'selected' : ''}>Off</option>
          </select>
        </div>

        <button class="studio-btn active" id="btnTriggerBackupNow" style="width:100%;justify-content:center;padding:12px;margin-top:12px">
          ☁ Back Up Now
        </button>
      `;

      document.getElementById('selectBackupFreq')?.addEventListener('change', (e) => {
        prof.backupFrequency = e.target.value;
        saveState();
        showToast(`Auto-backup set to ${prof.backupFrequency}`);
      });

      document.getElementById('btnTriggerBackupNow')?.addEventListener('click', () => {
        const btn = document.getElementById('btnTriggerBackupNow');
        if (btn) btn.textContent = 'Backing up... ⏳';
        setTimeout(() => {
          prof.lastBackupDate = `Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (15.2 MB)`;
          saveState();
          renderSettingsTabContent();
          showToast('Chat backup completed successfully!');
        }, 1200);
      });
    } else if (tab === 'server') {
      area.innerHTML = `
        <h3 style="font-size:16px;font-weight:750;color:var(--text-main);margin-bottom:16px">Server Connection Settings</h3>
        <p style="font-size:13px;color:var(--text-sec);margin-bottom:16px">
          Configure the active Spring Boot backend and WebSocket host endpoint.
        </p>
        <div class="settings-form-row">
          <label>Backend API Base URL</label>
          <input type="text" class="composer-input-field" id="serverUrlInput" value="${escapeHTML(prof.serverUrl || 'http://192.168.0.70:8080')}" style="width:100%">
        </div>

        <div style="display:flex;gap:10px;margin-top:12px">
          <button class="studio-btn" id="btnTestServerPing">⚡ Test Latency Ping</button>
          <button class="studio-btn active" id="btnSaveServerUrl">Save Server URL</button>
          <button class="studio-btn" id="btnResetServerUrl">Reset to Default</button>
        </div>

        <div id="serverPingResultBox" style="margin-top:16px;display:none;padding:12px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:var(--radius-md);font-size:13px;color:var(--brand-emerald)">
        </div>
      `;

      document.getElementById('btnTestServerPing')?.addEventListener('click', () => {
        const box = document.getElementById('serverPingResultBox');
        if (box) {
          box.style.display = 'block';
          box.textContent = 'Pinging /api/v1/health...';
          setTimeout(() => {
            box.textContent = '✓ Connected: Spring Boot 3.4 API responding (Latency: 38ms)';
          }, 450);
        }
      });

      document.getElementById('btnSaveServerUrl')?.addEventListener('click', () => {
        const url = document.getElementById('serverUrlInput')?.value;
        if (url) {
          prof.serverUrl = url.trim();
          saveState();
          showToast(`Server URL saved: ${prof.serverUrl}`);
        }
      });

      document.getElementById('btnResetServerUrl')?.addEventListener('click', () => {
        prof.serverUrl = 'http://192.168.0.70:8080';
        saveState();
        renderSettingsTabContent();
        showToast('Server URL reset to local default');
      });
    } else if (tab === 'devices') {
      area.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="font-size:16px;font-weight:750;color:var(--text-main)">Linked Devices</h3>
          <button class="studio-btn active" id="btnLinkNewDevicePrompt">＋ Link New Device</button>
        </div>
        <p style="font-size:12.5px;color:var(--text-muted);margin-bottom:14px">
          Active sessions across web and desktop. Revoking a session disconnects that client's WebSocket immediately.
        </p>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${(prof.linkedDevices || []).map(dev => `
            <div style="padding:12px 14px;background:var(--input-bg);border:1px solid var(--border-subtle);border-radius:var(--radius-md);display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-size:13.5px;font-weight:650;color:var(--text-main)">${escapeHTML(dev.name)}</div>
                <div style="font-size:11.5px;color:var(--text-muted)">${escapeHTML(dev.location)} · ${escapeHTML(dev.active)}</div>
              </div>
              ${dev.isCurrent ? '<span class="platform-pill" style="color:var(--brand-emerald)">This Client</span>' : `
                <button class="studio-btn danger" style="padding:4px 10px;font-size:11.5px" data-revoke-dev-id="${dev.id}">
                  Revoke
                </button>
              `}
            </div>
          `).join('')}
        </div>
      `;

      document.getElementById('btnLinkNewDevicePrompt')?.addEventListener('click', () => {
        openLinkDeviceModal();
      });

      area.querySelectorAll('[data-revoke-dev-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-revoke-dev-id');
          if (confirm('Revoke this linked device session?')) {
            prof.linkedDevices = prof.linkedDevices.filter(d => d.id !== id);
            saveState();
            renderSettingsTabContent();
            showToast('Device session revoked (WebSocket terminated)');
          }
        });
      });
    } else if (tab === 'help') {
      area.innerHTML = `
        <h3 style="font-size:16px;font-weight:750;color:var(--text-main);margin-bottom:16px">Help & About IndiChat</h3>
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px">
          ${fixtures.FAQ_ITEMS.map((faq, i) => `
            <details style="background:var(--input-bg);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px 14px;cursor:pointer">
              <summary style="font-size:13px;font-weight:650;color:var(--text-main)">${escapeHTML(faq.q)}</summary>
              <p style="margin-top:8px;font-size:12.5px;color:var(--text-sec);line-height:1.5">${escapeHTML(faq.a)}</p>
            </details>
          `).join('')}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:var(--input-bg);border-radius:var(--radius-md);border:1px solid var(--border-subtle)">
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text-main)">IndiChat Multi-Platform v3.0</div>
            <div style="font-size:11.5px;color:var(--text-muted)">MIT Licensed · Spring Boot 3.4 &amp; React 19 Monorepo</div>
          </div>
          <button class="studio-btn" id="btnOpenSupportFromSettings">Contact Support</button>
        </div>
      `;

      document.getElementById('btnOpenSupportFromSettings')?.addEventListener('click', () => {
        openContactSupportModal();
      });
    } else if (tab === 'logout') {
      area.innerHTML = `
        <h3 style="font-size:16px;font-weight:750;color:var(--accent-danger);margin-bottom:16px">Log Out of IndiChat</h3>
        <p style="font-size:13.5px;color:var(--text-sec);line-height:1.6;margin-bottom:20px">
          Logging out will terminate this local session and clear the decrypted message workspace on this client.
        </p>
        <div style="display:flex;gap:12px">
          <button class="studio-btn danger" id="btnConfirmLogoutAction" style="padding:10px 20px">Yes, Log Out Now</button>
          <button class="studio-btn" id="btnCancelLogoutAction" style="padding:10px 20px">Cancel</button>
        </div>
      `;

      document.getElementById('btnConfirmLogoutAction')?.addEventListener('click', () => {
        closeSettingsModal();
        state.isLoggedOut = true;
        renderAll();
        showToast('Logged out of IndiChat');
      });

      document.getElementById('btnCancelLogoutAction')?.addEventListener('click', () => {
        state.activeSettingsTab = 'profile';
        renderSettingsTabContent();
      });
    }
  }

  // QR Code Link Device Modal
  function openLinkDeviceModal() {
    let modal = document.getElementById('linkDeviceModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'linkDeviceModal';
      modal.className = 'modal-backdrop';
      const windowMockup = document.querySelector('.window-mockup');
      if (windowMockup) windowMockup.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card" style="max-width:440px">
        <div class="modal-header">
          <h2>Link with QR Code</h2>
          <button class="icon-btn" id="closeLinkDeviceModalBtn" aria-label="Close dialog">✕</button>
        </div>
        <div style="padding:24px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px">
          <div style="width:200px;height:200px;background:#ffffff;padding:12px;border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,0.3);display:grid;place-items:center">
            <!-- Simulated QR Code SVG -->
            <svg viewBox="0 0 100 100" width="176" height="176">
              <rect x="0" y="0" width="100" height="100" fill="#ffffff"/>
              <rect x="10" y="10" width="25" height="25" fill="#070b0e"/>
              <rect x="15" y="15" width="15" height="15" fill="#ffffff"/>
              <rect x="18" y="18" width="9" height="9" fill="#070b0e"/>
              <rect x="65" y="10" width="25" height="25" fill="#070b0e"/>
              <rect x="70" y="15" width="15" height="15" fill="#ffffff"/>
              <rect x="73" y="18" width="9" height="9" fill="#070b0e"/>
              <rect x="10" y="65" width="25" height="25" fill="#070b0e"/>
              <rect x="15" y="70" width="15" height="15" fill="#ffffff"/>
              <rect x="18" y="73" width="9" height="9" fill="#070b0e"/>
              <rect x="42" y="12" width="6" height="18" fill="#070b0e"/>
              <rect x="42" y="42" width="16" height="16" fill="#00a884"/>
              <rect x="65" y="42" width="10" height="6" fill="#070b0e"/>
              <rect x="42" y="65" width="8" height="20" fill="#070b0e"/>
              <rect x="58" y="65" width="28" height="10" fill="#070b0e"/>
              <rect x="65" y="80" width="15" height="10" fill="#070b0e"/>
            </svg>
          </div>
          <div style="font-size:14px;font-weight:700;color:var(--text-main)">Point your phone camera here</div>
          <p style="font-size:12.5px;color:var(--text-muted);max-width:300px;line-height:1.5">
            Open IndiChat on your phone &gt; Settings &gt; Linked Devices &gt; Link a Device.
          </p>
          <button class="studio-btn active" id="btnSimulatePhoneScanned" style="padding:10px 18px">Simulate Mobile Scan</button>
        </div>
      </div>
    `;

    modal.style.display = 'grid';
    onModalOpened(modal);
    document.getElementById('closeLinkDeviceModalBtn')?.addEventListener('click', () => closeModalElement(modal));

    document.getElementById('btnSimulatePhoneScanned')?.addEventListener('click', () => {
      closeModalElement(modal);
      state.userProfile.linkedDevices.push({
        id: 'dev-' + Date.now(),
        name: 'Android Pixel 8 Pro',
        location: 'Bengaluru, India',
        active: 'Active now',
        isCurrent: false,
        type: 'android'
      });
      saveState();
      renderSettingsTabContent();
      showToast('New device linked successfully!');
    });
  }

  // --- Dedicated Interactive Modals for Full Parity ---

  function openAvatarPickerModal() {
    let modal = document.getElementById('avatarPickerModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'avatarPickerModal';
      modal.className = 'modal-backdrop';
      const windowMockup = document.querySelector('.window-mockup');
      if (windowMockup) windowMockup.appendChild(modal);
    }

    const colors = [
      '#10b981', '#06b6d4', '#3b82f6', '#6366f1',
      '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444'
    ];
    let selectedColor = state.userProfile.avatarColor || '#10b981';
    let currentInitials = state.userProfile.avatarInitials || 'ME';

    modal.innerHTML = `
      <div class="modal-card" style="max-width:440px">
        <div class="modal-header">
          <h2>Customize Avatar Profile</h2>
          <button class="icon-btn" id="closeAvatarPickerModalX" aria-label="Close dialog">✕</button>
        </div>
        <div style="padding:24px;display:flex;flex-direction:column;align-items:center">
          <div id="avatarLivePreviewCircle" style="width:84px;height:84px;border-radius:24px;background:${selectedColor};color:#fff;display:grid;place-items:center;font-size:28px;font-weight:800;margin-bottom:16px;box-shadow:0 6px 20px rgba(0,0,0,0.3)">
            ${escapeHTML(currentInitials)}
          </div>
          <div style="width:100%;margin-bottom:16px">
            <label style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-muted);display:block;margin-bottom:8px">Avatar Color Preset</label>
            <div class="avatar-preset-grid">
              ${colors.map(col => `
                <div class="avatar-preset-dot ${col === selectedColor ? 'active' : ''}" style="background:${col}" data-color-val="${col}"></div>
              `).join('')}
            </div>
          </div>
          <div style="width:100%;margin-bottom:20px">
            <label style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-muted);display:block;margin-bottom:6px">Initials (1-2 chars)</label>
            <input type="text" class="composer-input-field" id="inputAvatarInitials" maxlength="2" value="${escapeHTML(currentInitials)}" style="width:100%;text-transform:uppercase;font-weight:700">
          </div>
          <div style="display:flex;gap:12px;width:100%;justify-content:flex-end">
            <button class="studio-btn" id="btnCancelAvatarPicker">Cancel</button>
            <button class="studio-btn active" id="btnSaveAvatarPicker">Save Avatar</button>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'grid';
    onModalOpened(modal);

    const previewCircle = document.getElementById('avatarLivePreviewCircle');
    const initialsInput = document.getElementById('inputAvatarInitials');

    modal.querySelectorAll('.avatar-preset-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        modal.querySelectorAll('.avatar-preset-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        selectedColor = dot.getAttribute('data-color-val');
        if (previewCircle) previewCircle.style.background = selectedColor;
      });
    });

    initialsInput?.addEventListener('input', (e) => {
      currentInitials = (e.target.value || '').toUpperCase();
      if (previewCircle) previewCircle.textContent = currentInitials || 'ME';
    });

    document.getElementById('closeAvatarPickerModalX')?.addEventListener('click', () => closeModalElement(modal));
    document.getElementById('btnCancelAvatarPicker')?.addEventListener('click', () => closeModalElement(modal));

    document.getElementById('btnSaveAvatarPicker')?.addEventListener('click', () => {
      state.userProfile.avatarColor = selectedColor;
      state.userProfile.avatarInitials = (initialsInput?.value || currentInitials || 'ME').toUpperCase();
      saveState();
      closeModalElement(modal);
      renderSettingsTabContent();
      renderAll();
      showToast('Avatar profile updated successfully!');
    });
  }

  function openChangePasswordModal() {
    let modal = document.getElementById('changePasswordModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'changePasswordModal';
      modal.className = 'modal-backdrop';
      const windowMockup = document.querySelector('.window-mockup');
      if (windowMockup) windowMockup.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card" style="max-width:440px">
        <div class="modal-header">
          <h2>Change Password</h2>
          <button class="icon-btn" id="closeChangePasswordModalX" aria-label="Close dialog">✕</button>
        </div>
        <form id="formChangePassword" style="padding:20px;display:flex;flex-direction:column;gap:14px">
          <div class="settings-form-row" style="margin-bottom:0">
            <label>Current Password</label>
            <input type="password" class="composer-input-field" id="inputCurrentPassword" placeholder="••••••••••••" required style="width:100%">
          </div>
          <div class="settings-form-row" style="margin-bottom:0">
            <label>New Password (min 8 chars)</label>
            <input type="password" class="composer-input-field" id="inputNewPassword" placeholder="New secure password" minlength="8" required style="width:100%">
          </div>
          <div class="settings-form-row" style="margin-bottom:0">
            <label>Confirm New Password</label>
            <input type="password" class="composer-input-field" id="inputConfirmPassword" placeholder="Confirm new password" minlength="8" required style="width:100%">
          </div>
          <div id="passwordErrorMsg" style="display:none;color:var(--accent-danger);font-size:12px;font-weight:600"></div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px">
            <button type="button" class="studio-btn" id="btnCancelChangePassword">Cancel</button>
            <button type="submit" class="studio-btn active" id="btnSubmitChangePassword">Update Password</button>
          </div>
        </form>
      </div>
    `;

    modal.style.display = 'grid';
    onModalOpened(modal);

    document.getElementById('closeChangePasswordModalX')?.addEventListener('click', () => closeModalElement(modal));
    document.getElementById('btnCancelChangePassword')?.addEventListener('click', () => closeModalElement(modal));

    document.getElementById('formChangePassword')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const newP = document.getElementById('inputNewPassword')?.value || '';
      const confP = document.getElementById('inputConfirmPassword')?.value || '';
      const errBox = document.getElementById('passwordErrorMsg');

      if (newP !== confP) {
        if (errBox) {
          errBox.textContent = 'Passwords do not match. Please re-enter.';
          errBox.style.display = 'block';
        }
        return;
      }
      if (newP.length < 8) {
        if (errBox) {
          errBox.textContent = 'Password must be at least 8 characters long.';
          errBox.style.display = 'block';
        }
        return;
      }

      closeModalElement(modal);
      state.userProfile.lastPasswordChanged = 'Just now';
      saveState();
      renderSettingsTabContent();
      showToast('Password changed successfully! (Simulated)');
    });
  }

  function openChangePhoneModal() {
    let modal = document.getElementById('changePhoneModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'changePhoneModal';
      modal.className = 'modal-backdrop';
      const windowMockup = document.querySelector('.window-mockup');
      if (windowMockup) windowMockup.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card" style="max-width:440px">
        <div class="modal-header">
          <h2>Change Phone Number</h2>
          <button class="icon-btn" id="closeChangePhoneModalX" aria-label="Close dialog">✕</button>
        </div>
        <form id="formChangePhone" style="padding:20px;display:flex;flex-direction:column;gap:14px">
          <p style="font-size:12.5px;color:var(--text-sec);line-height:1.5">
            Migrating your phone number transfers your profile and end-to-end encryption keys.
          </p>
          <div class="settings-form-row" style="margin-bottom:0">
            <label>Current Phone Number</label>
            <input type="text" class="composer-input-field" value="${escapeHTML(state.userProfile.phoneNumber || '+91 98765 00112')}" disabled style="width:100%;opacity:0.6">
          </div>
          <div class="settings-form-row" style="margin-bottom:0">
            <label>New Phone Number</label>
            <input type="tel" class="composer-input-field" id="inputNewPhoneNumber" placeholder="+91 98111 22334" required style="width:100%">
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px">
            <button type="button" class="studio-btn" id="btnCancelChangePhone">Cancel</button>
            <button type="submit" class="studio-btn active">Update Number</button>
          </div>
        </form>
      </div>
    `;

    modal.style.display = 'grid';
    onModalOpened(modal);

    document.getElementById('closeChangePhoneModalX')?.addEventListener('click', () => closeModalElement(modal));
    document.getElementById('btnCancelChangePhone')?.addEventListener('click', () => closeModalElement(modal));

    document.getElementById('formChangePhone')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const newPhone = document.getElementById('inputNewPhoneNumber')?.value?.trim();
      if (newPhone) {
        state.userProfile.phoneNumber = newPhone;
        saveState();
        closeModalElement(modal);
        renderSettingsTabContent();
        renderAll();
        showToast('Phone number updated successfully!');
      }
    });
  }

  function openPasskeysModal() {
    let modal = document.getElementById('passkeysManagementModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'passkeysManagementModal';
      modal.className = 'modal-backdrop';
      const windowMockup = document.querySelector('.window-mockup');
      if (windowMockup) windowMockup.appendChild(modal);
    }

    const pks = state.passkeys || [];

    modal.innerHTML = `
      <div class="modal-card" style="max-width:520px">
        <div class="modal-header">
          <h2>Passkeys (FIDO2 / WebAuthn)</h2>
          <button class="icon-btn" id="closePasskeysModalX" aria-label="Close dialog">✕</button>
        </div>
        <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
          <p style="font-size:12.5px;color:var(--text-sec);line-height:1.5">
            Passkeys enable biometric Touch ID, Windows Hello, or physical security key authentication without typing passwords.
          </p>

          <div id="passkeysListContainer" style="display:flex;flex-direction:column;gap:8px">
            ${pks.map(pk => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--input-bg);border:1px solid var(--border-subtle);border-radius:var(--radius-md)">
                <div style="display:flex;align-items:center;gap:10px">
                  <span style="font-size:18px">${pk.type === 'biometric' ? '👆' : '🔑'}</span>
                  <div>
                    <div style="font-size:13px;font-weight:650;color:var(--text-main)">${escapeHTML(pk.name)}</div>
                    <div style="font-size:11px;color:var(--text-muted)">Created: ${escapeHTML(pk.created)}</div>
                  </div>
                </div>
                <button class="studio-btn danger" data-remove-passkey-id="${pk.id}" style="padding:4px 8px;font-size:11px">Remove</button>
              </div>
            `).join('')}
          </div>

          <div style="padding-top:12px;border-top:1px solid var(--border-subtle);display:flex;gap:10px;justify-content:space-between;align-items:center">
            <button class="studio-btn active" id="btnRegisterNewPasskeyAction">＋ Register New Passkey</button>
            <button class="studio-btn" id="btnClosePasskeysModalBtn">Done</button>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'grid';
    onModalOpened(modal);

    document.getElementById('closePasskeysModalX')?.addEventListener('click', () => closeModalElement(modal));
    document.getElementById('btnClosePasskeysModalBtn')?.addEventListener('click', () => closeModalElement(modal));

    modal.querySelectorAll('[data-remove-passkey-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-remove-passkey-id');
        state.passkeys = (state.passkeys || []).filter(p => p.id !== id);
        state.userProfile.passkeys = state.passkeys;
        saveState();
        openPasskeysModal();
        showToast('Passkey removed');
      });
    });

    document.getElementById('btnRegisterNewPasskeyAction')?.addEventListener('click', () => {
      const name = prompt('Enter a label for this new passkey:', 'USB Security Key') || 'Biometric Key';
      const newPk = {
        id: 'pk-' + Date.now(),
        name: name.trim(),
        created: 'Today',
        type: 'hardware'
      };
      if (!state.passkeys) state.passkeys = [];
      state.passkeys.push(newPk);
      state.userProfile.passkeys = state.passkeys;
      saveState();
      openPasskeysModal();
      showToast('WebAuthn biometric passkey enrolled (Simulated)');
    });
  }

  function openDeleteAccountModal() {
    let modal = document.getElementById('deleteAccountModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'deleteAccountModal';
      modal.className = 'modal-backdrop';
      const windowMockup = document.querySelector('.window-mockup');
      if (windowMockup) windowMockup.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card" style="max-width:440px">
        <div class="modal-header">
          <h2 style="color:var(--accent-danger)">Delete Account Confirmation</h2>
          <button class="icon-btn" id="closeDeleteAccountModalX" aria-label="Close dialog">✕</button>
        </div>
        <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
          <p style="font-size:13px;color:var(--text-sec);line-height:1.5">
            <strong>Warning:</strong> Deleting your account will permanently wipe your messages, linked devices, and encryption keys from this demo client.
          </p>
          <div class="settings-form-row" style="margin-bottom:0">
            <label>Type <span style="color:var(--accent-danger);font-weight:800">DELETE</span> to confirm:</label>
            <input type="text" class="composer-input-field" id="inputDeleteAccountConfirm" placeholder="DELETE" style="width:100%">
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
            <button class="studio-btn" id="btnCancelDeleteAccount">Cancel</button>
            <button class="studio-btn danger" id="btnExecuteDeleteAccount" disabled>Delete Forever</button>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'grid';
    onModalOpened(modal);

    const input = document.getElementById('inputDeleteAccountConfirm');
    const deleteBtn = document.getElementById('btnExecuteDeleteAccount');

    input?.addEventListener('input', (e) => {
      if (deleteBtn) {
        deleteBtn.disabled = e.target.value !== 'DELETE';
      }
    });

    document.getElementById('closeDeleteAccountModalX')?.addEventListener('click', () => closeModalElement(modal));
    document.getElementById('btnCancelDeleteAccount')?.addEventListener('click', () => closeModalElement(modal));

    deleteBtn?.addEventListener('click', () => {
      closeModalElement(modal);
      closeSettingsModal();
      resetToDefaultFixtures(false);
      showToast('Account deleted. Reset to default preview fixtures.');
    });
  }

  function openContactSupportModal() {
    let modal = document.getElementById('contactSupportModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'contactSupportModal';
      modal.className = 'modal-backdrop';
      const windowMockup = document.querySelector('.window-mockup');
      if (windowMockup) windowMockup.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card" style="max-width:480px">
        <div class="modal-header">
          <h2>Contact IndiChat Support</h2>
          <button class="icon-btn" id="closeContactSupportModalX" aria-label="Close dialog">✕</button>
        </div>
        <form id="formContactSupport" style="padding:20px;display:flex;flex-direction:column;gap:14px">
          <div class="settings-form-row" style="margin-bottom:0">
            <label>Issue Category</label>
            <select class="composer-input-field" id="selectSupportCategory" style="width:100%">
              <option value="account">Account &amp; Authentication</option>
              <option value="websocket">Real-Time WebSocket Sync</option>
              <option value="calls">Audio / Video WebRTC Calls</option>
              <option value="media">Media &amp; Attachments</option>
              <option value="other">General Feedback / Other</option>
            </select>
          </div>
          <div class="settings-form-row" style="margin-bottom:0">
            <label>Subject</label>
            <input type="text" class="composer-input-field" id="inputSupportSubject" placeholder="Brief summary of issue" required style="width:100%">
          </div>
          <div class="settings-form-row" style="margin-bottom:0">
            <label>Detailed Description</label>
            <textarea class="composer-input-field" id="inputSupportDescription" rows="4" placeholder="Describe what happened..." required style="width:100%"></textarea>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px">
            <button type="button" class="studio-btn" id="btnCancelSupportModal">Cancel</button>
            <button type="submit" class="studio-btn active">Submit Ticket</button>
          </div>
        </form>
      </div>
    `;

    modal.style.display = 'grid';
    onModalOpened(modal);

    document.getElementById('closeContactSupportModalX')?.addEventListener('click', () => closeModalElement(modal));
    document.getElementById('btnCancelSupportModal')?.addEventListener('click', () => closeModalElement(modal));

    document.getElementById('formContactSupport')?.addEventListener('submit', (e) => {
      e.preventDefault();
      closeModalElement(modal);
      const ticketId = 'TIC-' + Math.floor(100000 + Math.random() * 900000);
      showToast(`Support ticket #${ticketId} created. Response within 24h.`);
    });
  }

  function openSafetyNumbersModal(c) {
    if (!c) c = state.contacts.find(item => item.id === state.activeContactId);
    if (!c) return;

    let modal = document.getElementById('safetyNumbersModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'safetyNumbersModal';
      modal.className = 'modal-backdrop';
      const windowMockup = document.querySelector('.window-mockup');
      if (windowMockup) windowMockup.appendChild(modal);
    }

    const keyParts = (c.encryptionKey || '3842 9014 2855 0192 7831 6450 1198 4209').split(' ');

    modal.innerHTML = `
      <div class="modal-card" style="max-width:440px">
        <div class="modal-header">
          <h2>Verify Safety Numbers</h2>
          <button class="icon-btn" id="closeSafetyNumbersModalX" aria-label="Close dialog">✕</button>
        </div>
        <div style="padding:24px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px">
          <div style="width:64px;height:64px;border-radius:20px;background:${c.avatarColor};color:#fff;display:grid;place-items:center;font-size:24px;font-weight:700">
            ${escapeHTML(c.avatarInitials)}
          </div>
          <div style="font-size:15px;font-weight:700;color:var(--text-main)">${escapeHTML(c.name)}</div>
          <p style="font-size:12px;color:var(--text-sec);line-height:1.5">
            To verify end-to-end encryption with ${escapeHTML(c.name)}, compare the numbers below with their phone or scan the code.
          </p>

          <div style="width:160px;height:160px;background:#ffffff;padding:10px;border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,0.25);display:grid;place-items:center">
            <svg viewBox="0 0 100 100" width="140" height="140">
              <rect x="0" y="0" width="100" height="100" fill="#ffffff"/>
              <rect x="10" y="10" width="22" height="22" fill="#070b0e"/>
              <rect x="14" y="14" width="14" height="14" fill="#ffffff"/>
              <rect x="17" y="17" width="8" height="8" fill="#070b0e"/>
              <rect x="68" y="10" width="22" height="22" fill="#070b0e"/>
              <rect x="72" y="14" width="14" height="14" fill="#ffffff"/>
              <rect x="75" y="17" width="8" height="8" fill="#070b0e"/>
              <rect x="10" y="68" width="22" height="22" fill="#070b0e"/>
              <rect x="14" y="72" width="14" height="14" fill="#ffffff"/>
              <rect x="17" y="75" width="8" height="8" fill="#070b0e"/>
              <rect x="44" y="12" width="8" height="20" fill="#070b0e"/>
              <rect x="44" y="44" width="12" height="12" fill="#10b981"/>
              <rect x="68" y="44" width="12" height="6" fill="#070b0e"/>
              <rect x="44" y="68" width="6" height="20" fill="#070b0e"/>
              <rect x="60" y="68" width="24" height="8" fill="#070b0e"/>
            </svg>
          </div>

          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:8px 12px;font-family:var(--font-mono);font-size:12.5px;font-weight:600;color:var(--text-main);background:var(--input-bg);padding:12px 16px;border-radius:var(--radius-md);width:100%">
            ${keyParts.map(part => `<span>${part}</span>`).join('')}
          </div>

          <div style="display:flex;gap:10px;width:100%;margin-top:6px">
            <button class="studio-btn" id="btnCancelSafetyNumbers" style="flex:1;justify-content:center">Close</button>
            <button class="studio-btn active" id="btnConfirmVerifiedNumbers" style="flex:1;justify-content:center">
              ${c.verified ? '✓ Verified' : '✓ Mark as Verified'}
            </button>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'grid';
    onModalOpened(modal);

    document.getElementById('closeSafetyNumbersModalX')?.addEventListener('click', () => closeModalElement(modal));
    document.getElementById('btnCancelSafetyNumbers')?.addEventListener('click', () => closeModalElement(modal));

    document.getElementById('btnConfirmVerifiedNumbers')?.addEventListener('click', () => {
      c.verified = true;
      saveState();
      closeModalElement(modal);
      renderDetailsPanel();
      showToast(`Safety numbers marked verified for ${c.name}`);
    });
  }

  function openKeyboardShortcutsModal() {
    let modal = document.getElementById('keyboardShortcutsModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'keyboardShortcutsModal';
      modal.className = 'modal-backdrop';
      const windowMockup = document.querySelector('.window-mockup');
      if (windowMockup) windowMockup.appendChild(modal);
    }

    const shortcuts = [
      { key: 'Enter', desc: 'Send message' },
      { key: 'Shift + Enter', desc: 'Insert new line in composer' },
      { key: 'Escape', desc: 'Close dialogs, menus, search, or active overlays' },
      { key: 'Cmd/Ctrl + K', desc: 'Search conversations' },
      { key: 'Cmd/Ctrl + ,', desc: 'Open Settings' }
    ];

    modal.innerHTML = `
      <div class="modal-card" style="max-width:440px">
        <div class="modal-header">
          <h2>Keyboard Shortcuts</h2>
          <button class="icon-btn" id="closeKeyboardShortcutsModalX" aria-label="Close dialog">✕</button>
        </div>
        <div style="padding:20px;display:flex;flex-direction:column;gap:10px">
          ${shortcuts.map(s => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--input-bg);border-radius:var(--radius-sm)">
              <span style="font-size:13px;color:var(--text-sec)">${escapeHTML(s.desc)}</span>
              <kbd style="padding:3px 8px;background:rgba(255,255,255,0.08);border:1px solid var(--border-subtle);border-radius:4px;font-family:var(--font-mono);font-size:11.5px;color:var(--text-main)">${escapeHTML(s.key)}</kbd>
            </div>
          `).join('')}
          <div style="display:flex;justify-content:flex-end;margin-top:12px">
            <button class="studio-btn" id="btnCloseKeyboardShortcutsBtn">Done</button>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'grid';
    onModalOpened(modal);

    document.getElementById('closeKeyboardShortcutsModalX')?.addEventListener('click', () => closeModalElement(modal));
    document.getElementById('btnCloseKeyboardShortcutsBtn')?.addEventListener('click', () => closeModalElement(modal));
  }

  // --- 15. Logged Out Auth View ---
  function renderAuthScreen() {
    let authOverlay = document.getElementById('loggedOutAuthOverlay');
    if (state.isLoggedOut) {
      if (!authOverlay) {
        authOverlay = document.createElement('div');
        authOverlay.id = 'loggedOutAuthOverlay';
        authOverlay.style.cssText = 'position:absolute;inset:0;background:var(--app-bg);z-index:9000;display:flex;align-items:center;justify-content:center;padding:24px;border-radius:inherit;';
        const mockup = document.getElementById('appWindow') || document.body;
        mockup.appendChild(authOverlay);
      }
      authOverlay.innerHTML = `
        <div class="modal-card" style="max-width:440px;padding:32px 28px;text-align:center">
          <div style="width:54px;height:54px;border-radius:16px;background:linear-gradient(135deg,var(--brand-emerald),var(--brand-teal));color:#05080b;font-weight:800;font-size:26px;display:grid;place-items:center;margin:0 auto 16px;box-shadow:0 4px 16px rgba(16,185,129,0.35)">i</div>
          <h2 style="font-size:22px;font-weight:800;color:var(--text-main);margin-bottom:6px">Welcome to IndiChat</h2>
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:24px">
            Select a demo profile or sign in to explore the desktop client.
          </p>

          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">
            <button class="studio-btn active" id="btnLoginAsAlice" style="justify-content:center;padding:12px;font-size:13.5px">
              Log In as Alice (Riya Kapoor - Lead)
            </button>
            <button class="studio-btn" id="btnLoginAsAarav" style="justify-content:center;padding:12px;font-size:13.5px">
              Log In as Aarav Sharma
            </button>
          </div>

          <div style="font-size:11.5px;color:var(--text-muted)">
            🔒 Pure client-side simulation. No backend credentials touched.
          </div>
        </div>
      `;
      authOverlay.style.display = 'flex';

      document.getElementById('btnLoginAsAlice')?.addEventListener('click', () => {
        state.isLoggedOut = false;
        state.userProfile.displayName = 'Riya Kapoor';
        saveState();
        authOverlay.style.display = 'none';
        renderAll();
        showToast('Logged in as Alice (Riya Kapoor)');
      });

      document.getElementById('btnLoginAsAarav')?.addEventListener('click', () => {
        state.isLoggedOut = false;
        state.userProfile.displayName = 'Aarav Sharma';
        saveState();
        authOverlay.style.display = 'none';
        renderAll();
        showToast('Logged in as Aarav Sharma');
      });
    } else {
      if (authOverlay) authOverlay.style.display = 'none';
    }
  }

  // --- 16. Window Chrome Controls & Minimize/Restore ---
  function setupWindowControls() {
    const mockup = document.getElementById('appWindow');
    const restorePill = document.getElementById('restoreWindowPill');

    // Minimize & Close buttons
    document.querySelectorAll('.traffic-light.close, .win-caption-btn.win-close, .gnome-close-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (mockup) mockup.classList.add('minimized');
        if (restorePill) restorePill.style.display = 'inline-flex';
        showToast('Mockup minimized to simulated tray. Click "Restore Window" in header to unhide.');
      });
    });

    document.querySelectorAll('.traffic-light.minimize, .win-caption-btn.win-min').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (mockup) mockup.classList.add('minimized');
        if (restorePill) restorePill.style.display = 'inline-flex';
        showToast('App minimized. Click "Restore Window" to restore.');
      });
    });

    document.querySelectorAll('.traffic-light.zoom, .win-caption-btn.win-max').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (mockup) {
          mockup.classList.toggle('maximized');
          showToast(mockup.classList.contains('maximized') ? 'Window maximized' : 'Window restored');
        }
      });
    });

    restorePill?.addEventListener('click', () => {
      if (mockup) mockup.classList.remove('minimized');
      if (restorePill) restorePill.style.display = 'none';
      showToast('Window restored');
    });

    // Linux GNOME App Menu Dropdown
    const btnGnomeAppMenu = document.getElementById('btnGnomeAppMenu');
    const gnomeDropdown = document.getElementById('gnomeAppDropdownMenu');
    if (btnGnomeAppMenu && gnomeDropdown) {
      btnGnomeAppMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        gnomeDropdown.style.display = gnomeDropdown.style.display === 'flex' ? 'none' : 'flex';
      });

      document.addEventListener('click', (e) => {
        if (!gnomeDropdown.contains(e.target) && e.target !== btnGnomeAppMenu) {
          gnomeDropdown.style.display = 'none';
        }
      });

      document.getElementById('gnomeMenuSettings')?.addEventListener('click', () => {
        gnomeDropdown.style.display = 'none';
        openSettingsModal();
      });

      document.getElementById('gnomeMenuShortcuts')?.addEventListener('click', () => {
        gnomeDropdown.style.display = 'none';
        openKeyboardShortcutsModal();
      });

      document.getElementById('gnomeMenuHelp')?.addEventListener('click', () => {
        gnomeDropdown.style.display = 'none';
        openSettingsModal('help');
      });

      document.getElementById('gnomeMenuQuit')?.addEventListener('click', () => {
        gnomeDropdown.style.display = 'none';
        if (mockup) mockup.classList.add('minimized');
        if (restorePill) restorePill.style.display = 'inline-flex';
        showToast('IndiChat minimized to Linux system tray');
      });
    }
  }

  // --- 17. Bind Common Event Handlers ---
  function initEventBindings() {
    loadPersistedState();
    applyThemeAndMaterials();

    if (state.isLoggedOut) {
      renderAuthScreen();
      return;
    }

    // Top Studio Bar Controls
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.addEventListener('click', toggleTheme);
    });

    document.getElementById('btnResetDemoData')?.addEventListener('click', () => {
      if (confirm('Reset all preview demo data to fresh default fixtures?')) {
        resetToDefaultFixtures(true);
      }
    });

    // Rail Navigation Tab items
    document.querySelectorAll('.rail-btn[data-rail-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-rail-tab');
        setActiveRailTab(tab);
      });
    });

    document.getElementById('railSettingsBtn')?.addEventListener('click', () => openSettingsModal('profile'));
    document.getElementById('railUserAvatarBtn')?.addEventListener('click', () => openSettingsModal('profile'));

    // Sidebar Search input
    const searchInput = document.getElementById('sidebarSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderConversationList();
      });
    }

    // Sidebar Filter Chips
    document.querySelectorAll('.filter-chip[data-filter]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip[data-filter]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.activeChatFilter = chip.getAttribute('data-filter') || 'all';
        renderConversationList();
      });
    });

    // "+ New Chat" button in sidebar
    document.getElementById('btnNewChatHeader')?.addEventListener('click', () => {
      openNewChatModal();
    });

    // Sidebar Top Menu button & dropdown
    const topMenuBtn = document.getElementById('btnSidebarMenu');
    const topMenu = document.getElementById('sidebarDropdownMenu');
    if (topMenuBtn && topMenu) {
      topMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        topMenu.style.display = topMenu.style.display === 'flex' ? 'none' : 'flex';
      });

      document.getElementById('menuActionNewGroup')?.addEventListener('click', () => {
        topMenu.style.display = 'none';
        state.newChatTab = 'group';
        openNewChatModal();
      });

      document.getElementById('menuActionStarred')?.addEventListener('click', () => {
        topMenu.style.display = 'none';
        setActiveRailTab('starred');
      });

      document.getElementById('menuActionMarkAllRead')?.addEventListener('click', () => {
        topMenu.style.display = 'none';
        state.contacts.forEach(c => c.unreadCount = 0);
        saveState();
        renderConversationList();
        showToast('All conversations marked as read');
      });

      document.getElementById('menuActionSettings')?.addEventListener('click', () => {
        topMenu.style.display = 'none';
        openSettingsModal('profile');
      });

      document.addEventListener('click', () => {
        if (topMenu) topMenu.style.display = 'none';
      });
    }

    // Chat Composer Form
    const composerForm = document.getElementById('chatComposerForm');
    const composerInput = document.getElementById('composerInputField');
    if (composerForm && composerInput) {
      composerInput.addEventListener('input', () => {
        if (state.activeContactId) {
          state.drafts[state.activeContactId] = composerInput.value;
          saveState();
        }
      });

      composerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage(composerInput.value);
        composerInput.value = '';
        if (state.activeContactId) {
          delete state.drafts[state.activeContactId];
          saveState();
        }
      });

      composerInput.addEventListener('keydown', (e) => {
        if (state.userProfile.enterIsSend !== false && e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage(composerInput.value);
          composerInput.value = '';
          if (state.activeContactId) {
            delete state.drafts[state.activeContactId];
            saveState();
          }
        }
      });
    }

    // Quoted Reply Cancel button
    document.getElementById('btnCancelQuotedReply')?.addEventListener('click', () => {
      state.replyTarget = null;
      renderChatWindow();
    });

    // Attachment Button (+) & Menu
    const attachBtn = document.getElementById('btnAttachment');
    const attachMenu = document.getElementById('attachmentMenu');
    if (attachBtn && attachMenu) {
      attachBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.attachmentMenuOpen = !state.attachmentMenuOpen;
        attachMenu.style.display = state.attachmentMenuOpen ? 'flex' : 'none';
      });

      document.getElementById('attachOptionPhotos')?.addEventListener('click', () => {
        attachMenu.style.display = 'none';
        state.attachmentMenuOpen = false;
        openAttachmentPreviewModal(
          'image',
          'Design_Preview_Asset.png',
          '1.8 MB · PNG Image',
          fixtures.DEFAULT_CONTACTS[0].messages[2].imageUrl
        );
      });

      document.getElementById('attachOptionDoc')?.addEventListener('click', () => {
        attachMenu.style.display = 'none';
        state.attachmentMenuOpen = false;
        openAttachmentPreviewModal(
          'document',
          'Engineering_Architecture_v2.pdf',
          '2.4 MB · PDF Document',
          ''
        );
      });

      document.getElementById('attachOptionCamera')?.addEventListener('click', () => {
        attachMenu.style.display = 'none';
        state.attachmentMenuOpen = false;
        openAttachmentPreviewModal(
          'image',
          'Camera_Snap_Photo.jpg',
          '950 KB · Camera Photo',
          fixtures.DEFAULT_CONTACTS[0].messages[2].imageUrl
        );
      });

      document.getElementById('attachOptionPoll')?.addEventListener('click', () => {
        attachMenu.style.display = 'none';
        state.attachmentMenuOpen = false;
        sendMessage('Poll: Should we schedule the release for Monday? 📊\n1. Yes, ready! (4 votes)\n2. Need one more review (1 vote)', 'text');
        showToast('Poll created');
      });

      document.addEventListener('click', () => {
        if (state.attachmentMenuOpen) {
          attachMenu.style.display = 'none';
          state.attachmentMenuOpen = false;
        }
      });
    }

    // Rupee Payment Button (₹)
    document.getElementById('btnRupeePayment')?.addEventListener('click', () => {
      openPaymentDialog();
    });

    // Call buttons in Chat Header
    document.getElementById('btnAudioCall')?.addEventListener('click', () => startCallSimulation(false));
    document.getElementById('btnVideoCall')?.addEventListener('click', () => startCallSimulation(true));

    // Contact Details Toggle in Header
    document.getElementById('btnToggleDetails')?.addEventListener('click', () => {
      state.detailsPanelOpen = !state.detailsPanelOpen;
      renderDetailsPanel();
    });

    // Global Keyboard Listeners (Escape key dismissals, Tab trapping, shortcuts)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const activeModals = Array.from(document.querySelectorAll('.modal-backdrop, .call-simulation-overlay, .lightbox-modal-overlay')).filter(el => {
          return (el.style.display === 'grid' || el.style.display === 'flex') && el.offsetParent !== null;
        });
        if (activeModals.length > 0) {
          const activeModal = activeModals[activeModals.length - 1];
          const focusables = Array.from(activeModal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(el => el.offsetParent !== null);
          if (focusables.length > 0) {
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey) {
              if (document.activeElement === first || !activeModal.contains(document.activeElement)) {
                e.preventDefault();
                last.focus();
              }
            } else {
              if (document.activeElement === last || !activeModal.contains(document.activeElement)) {
                e.preventDefault();
                first.focus();
              }
            }
          }
        }
      } else if (e.key === 'Escape') {
        // GNOME App Dropdown
        const gnomeDropdown = document.getElementById('gnomeAppDropdownMenu');
        if (gnomeDropdown && gnomeDropdown.style.display === 'flex') {
          gnomeDropdown.style.display = 'none';
          return;
        }

        // Active Modals
        const modalIds = [
          'avatarPickerModal',
          'changePasswordModal',
          'changePhoneModal',
          'passkeysManagementModal',
          'deleteAccountModal',
          'contactSupportModal',
          'safetyNumbersModal',
          'communityCircleModal',
          'keyboardShortcutsModal',
          'linkDeviceModal',
          'newChatModal',
          'contactDialerModal',
          'attachmentPreviewModal',
          'lightboxViewerModal',
          'docViewerModalBackdrop',
          'paymentModal',
          'paymentDialogModal',
          'storyViewerModal'
        ];
        for (const id of modalIds) {
          const m = document.getElementById(id);
          if (m && (m.style.display === 'grid' || m.style.display === 'flex')) {
            closeModalElement(m);
            return;
          }
        }

        if (state.callModalOpen) endCallSimulation();
        else if (state.settingsModalOpen) closeSettingsModal();
        else if (state.pickerPanelOpen) {
          const p = document.getElementById('emojiGifStickerPanel');
          if (p) p.style.display = 'none';
          state.pickerPanelOpen = false;
        } else if (state.attachmentMenuOpen) {
          const a = document.getElementById('attachmentMenu');
          if (a) a.style.display = 'none';
          state.attachmentMenuOpen = false;
        } else if (state.inChatSearchOpen) {
          state.inChatSearchOpen = false;
          renderChatWindow();
        } else if (state.detailsPanelOpen && window.innerWidth < 1200) {
          state.detailsPanelOpen = false;
          renderDetailsPanel();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        openSettingsModal();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setActiveRailTab('chats');
        const searchInput = document.getElementById('sidebarSearchInput');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    });

    setupEmojiGifStickerPicker();
    setupInChatSearch();
    setupWindowControls();
    renderAll();
  }

  function renderAll() {
    if (state.isLoggedOut) {
      renderAuthScreen();
      return;
    }
    renderConversationList();
    renderChatWindow();
    renderDetailsPanel();
    const input = document.getElementById('composerInputField');
    if (input && state.activeContactId) {
      input.value = state.drafts[state.activeContactId] || '';
    }
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEventBindings);
  } else {
    initEventBindings();
  }

  // Global Engine Interface
  window.IndiChatPreviewEngine = {
    state: state,
    showToast: showToast,
    toggleTheme: toggleTheme,
    setActiveRailTab: setActiveRailTab,
    setActiveContact: setActiveContact,
    sendMessage: sendMessage,
    startCallSimulation: startCallSimulation,
    openSettingsModal: openSettingsModal,
    openNewChatModal: openNewChatModal,
    openPaymentDialog: openPaymentDialog,
    openAttachmentPreviewModal: openAttachmentPreviewModal,
    openAvatarPickerModal: openAvatarPickerModal,
    openChangePasswordModal: openChangePasswordModal,
    openChangePhoneModal: openChangePhoneModal,
    openPasskeysModal: openPasskeysModal,
    openDeleteAccountModal: openDeleteAccountModal,
    openContactSupportModal: openContactSupportModal,
    openSafetyNumbersModal: openSafetyNumbersModal,
    openCommunityCircleModal: openCommunityCircleModal,
    openKeyboardShortcutsModal: openKeyboardShortcutsModal,
    renderCommunitiesView: renderCommunitiesView,
    resetDemoData: resetToDefaultFixtures
  };
})();
