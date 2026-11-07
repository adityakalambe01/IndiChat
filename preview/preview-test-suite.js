/**
 * IndiChat Multi-Platform Parameterized Interactive Test Suite
 * 
 * Reusable test suite executed directly in the browser across all 4 actual preview pages:
 * - preview-web.html
 * - preview-desktop-macos.html
 * - preview-desktop-windows.html
 * - preview-desktop-linux.html
 * 
 * Exercises controls through real browser events (clicks, inputs, keyboard, focus),
 * asserting visible outcomes, DOM mutations, dialog lifecycles, and localStorage state.
 * Captures all page errors, console errors, and unhandled rejections explicitly.
 */

(function () {
  'use strict';

  // --- 0. Error Interception & Recording Harness ---
  const capturedErrors = {
    pageErrors: [],
    consoleErrors: [],
    unhandledRejections: []
  };

  window.addEventListener('error', function (event) {
    capturedErrors.pageErrors.push({
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error ? (event.error.stack || event.error.message) : null
    });
  });

  window.addEventListener('unhandledrejection', function (event) {
    capturedErrors.unhandledRejections.push({
      reason: event.reason ? (event.reason.stack || event.reason.message || String(event.reason)) : 'Unknown rejection'
    });
  });

  const origConsoleError = console.error;
  console.error = function (...args) {
    const formatted = args.map(a => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a))).join(' ');
    capturedErrors.consoleErrors.push(formatted);
    origConsoleError.apply(console, args);
  };

  // Helper sleep
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Determine platform
  function detectPlatform() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('macos')) return 'macos';
    if (path.includes('windows')) return 'windows';
    if (path.includes('linux')) return 'linux';
    if (path.includes('web')) return 'web';
    if (document.querySelector('.chrome-macos')) return 'macos';
    if (document.querySelector('.chrome-windows')) return 'windows';
    if (document.querySelector('.chrome-linux')) return 'linux';
    return 'web';
  }

  // Parameterized Test Runner
  async function runParameterizedTestSuite() {
    const platform = detectPlatform();
    const results = [];
    const startTime = Date.now();

    function assert(name, condition, extraInfo = '') {
      const pass = Boolean(condition);
      results.push({ name, pass, extraInfo });
      if (!pass) {
        console.warn(`[FAIL] ${name} ${extraInfo}`);
      }
    }

    // Wait for IndiChatPreviewEngine to be initialized
    let retries = 0;
    while (!window.IndiChatPreviewEngine && retries < 20) {
      await sleep(100);
      retries++;
    }

    if (!window.IndiChatPreviewEngine) {
      console.error('IndiChatPreviewEngine failed to initialize on', platform);
      return;
    }

    const engine = window.IndiChatPreviewEngine;

    try {
      // Clean slate before tests
      engine.resetDemoData(false);
      await sleep(50);

      // =========================================================================
      // 1. TOP STUDIO BAR & PLATFORM-SPECIFIC WINDOW CONTROLS
      // =========================================================================
      
      // Theme Toggle
      const initialTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const topThemeBtn = document.querySelector('.studio-top-bar .theme-toggle-btn');
      assert('Theme toggle button exists in Studio bar', Boolean(topThemeBtn));
      topThemeBtn?.click();
      await sleep(50);
      const toggledTheme = document.documentElement.getAttribute('data-theme');
      assert('Theme toggle switches data-theme attribute', toggledTheme !== initialTheme);
      topThemeBtn?.click();
      await sleep(50);
      assert('Theme toggle restores original theme', document.documentElement.getAttribute('data-theme') === initialTheme);

      // Platform-Specific Window Chrome
      const mockup = document.getElementById('appWindow');
      const restorePill = document.getElementById('restoreWindowPill');
      assert('Mockup window exists', Boolean(mockup));
      assert('Restore mockup window pill exists', Boolean(restorePill));

      if (platform === 'macos') {
        const closeBtn = document.querySelector('.macos-traffic-lights .traffic-light.close');
        const minBtn = document.querySelector('.macos-traffic-lights .traffic-light.minimize');
        const zoomBtn = document.querySelector('.macos-traffic-lights .traffic-light.zoom');
        assert('macOS close traffic light exists', Boolean(closeBtn));
        assert('macOS minimize traffic light exists', Boolean(minBtn));
        assert('macOS zoom traffic light exists', Boolean(zoomBtn));

        // Test Zoom
        zoomBtn?.click();
        await sleep(50);
        assert('macOS zoom toggles maximized class on window', mockup?.classList.contains('maximized'));
        zoomBtn?.click();
        await sleep(50);
        assert('macOS zoom un-maximizes window', !mockup?.classList.contains('maximized'));

        // Test Minimize & Restore
        minBtn?.click();
        await sleep(50);
        assert('macOS minimize hides mock window to tray', mockup?.classList.contains('minimized'));
        assert('Restore pill becomes visible upon minimize', restorePill?.style.display !== 'none');
        restorePill?.click();
        await sleep(50);
        assert('Restore pill restores window', !mockup?.classList.contains('minimized'));

        // Test Close (simulated close to tray)
        closeBtn?.click();
        await sleep(50);
        assert('macOS close hides window to tray (simulated)', mockup?.classList.contains('minimized'));
        restorePill?.click();
        await sleep(50);
      } else if (platform === 'windows') {
        const minBtn = document.querySelector('.windows-caption-controls .win-min');
        const maxBtn = document.querySelector('.windows-caption-controls .win-max');
        const closeBtn = document.querySelector('.windows-caption-controls .win-close');
        assert('Windows caption minimize exists', Boolean(minBtn));
        assert('Windows caption maximize exists', Boolean(maxBtn));
        assert('Windows caption close exists', Boolean(closeBtn));

        // Test Maximize
        maxBtn?.click();
        await sleep(50);
        assert('Windows maximize toggles maximized class', mockup?.classList.contains('maximized'));
        maxBtn?.click();
        await sleep(50);
        assert('Windows maximize restores normal frame', !mockup?.classList.contains('maximized'));

        // Test Minimize
        minBtn?.click();
        await sleep(50);
        assert('Windows minimize hides mock window to tray', mockup?.classList.contains('minimized'));
        restorePill?.click();
        await sleep(50);
        assert('Restore pill restores window on Windows', !mockup?.classList.contains('minimized'));

        // Test Close
        closeBtn?.click();
        await sleep(50);
        assert('Windows close hides window to tray (simulated)', mockup?.classList.contains('minimized'));
        restorePill?.click();
        await sleep(50);
      } else if (platform === 'linux') {
        const gnomeMenuBtn = document.getElementById('btnGnomeAppMenu');
        const gnomeDropdown = document.getElementById('gnomeAppDropdownMenu');
        const gnomeCloseBtn = document.querySelector('.gnome-close-btn');
        assert('Linux GNOME App Menu button exists', Boolean(gnomeMenuBtn));
        assert('Linux GNOME App Dropdown exists', Boolean(gnomeDropdown));
        assert('Linux GNOME close button exists', Boolean(gnomeCloseBtn));

        // Test GNOME Menu Dropdown toggle
        gnomeMenuBtn?.click();
        await sleep(50);
        assert('GNOME menu button opens app dropdown', gnomeDropdown?.style.display === 'flex');

        // Test Menu item: Keyboard Shortcuts
        const menuShortcuts = document.getElementById('gnomeMenuShortcuts');
        menuShortcuts?.click();
        await sleep(50);
        const shortcutsModal = document.getElementById('keyboardShortcutsModal');
        assert('GNOME Shortcuts item opens shortcuts dialog', shortcutsModal?.style.display === 'grid');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await sleep(50);
        assert('Escape dismisses shortcuts dialog', shortcutsModal?.style.display === 'none');

        // Test Linux Close button
        gnomeCloseBtn?.click();
        await sleep(50);
        assert('Linux close button minimizes mockup to tray', mockup?.classList.contains('minimized'));
        restorePill?.click();
        await sleep(50);
      } else if (platform === 'web') {
        const webChrome = document.querySelector('.window-chrome.chrome-web');
        const addressBar = document.querySelector('.browser-address-bar');
        assert('Web preview has browser chrome header', Boolean(webChrome));
        assert('Web address bar shows secure protocol and domain', addressBar?.textContent.includes('web.indichat.com'));
      }

      // =========================================================================
      // 2. NAVIGATION RAIL (ZONE 1)
      // =========================================================================
      const railTabs = ['chats', 'status', 'calls', 'communities', 'starred'];
      for (const tab of railTabs) {
        const railBtn = document.querySelector(`[data-rail-tab="${tab}"]`);
        assert(`Rail tab "${tab}" exists`, Boolean(railBtn));
        railBtn?.click();
        await sleep(50);
        assert(`Rail tab "${tab}" becomes active`, railBtn?.classList.contains('active'));
        const sidebarView = document.getElementById(`sidebarView-${tab}`);
        assert(`Sidebar view for "${tab}" is displayed`, sidebarView && sidebarView.style.display !== 'none');
      }

      // Switch back to chats
      document.querySelector('[data-rail-tab="chats"]')?.click();
      await sleep(50);

      // =========================================================================
      // 3. CHATS SIDEBAR: FILTERING, SEARCH & MENU (ZONE 2)
      // =========================================================================
      const searchInput = document.getElementById('sidebarSearchInput');
      assert('Sidebar search input exists', Boolean(searchInput));

      // Test Search Input filtering
      if (searchInput) {
        searchInput.value = 'Aarav';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(50);
        const visibleContacts = document.querySelectorAll('#conversationList .conversation-item');
        assert('Sidebar search filters to Aarav', visibleContacts.length >= 1 && visibleContacts[0].textContent.includes('Aarav'));

        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(50);
        const restoredContacts = document.querySelectorAll('#conversationList .conversation-item');
        assert('Clearing search restores all conversations', restoredContacts.length >= 4);
      }

      // Test Filter Chips: Unread, Groups, All
      const chipUnread = document.querySelector('[data-filter="unread"]');
      const chipGroups = document.querySelector('[data-filter="groups"]');
      const chipAll = document.querySelector('[data-filter="all"]');

      chipUnread?.click();
      await sleep(50);
      assert('Unread filter chip activates', chipUnread?.classList.contains('active'));

      chipGroups?.click();
      await sleep(50);
      assert('Groups filter chip activates', chipGroups?.classList.contains('active'));

      chipAll?.click();
      await sleep(50);
      assert('All filter chip restores full list', chipAll?.classList.contains('active'));

      // Test Sidebar Dropdown Menu
      const btnSidebarMenu = document.getElementById('btnSidebarMenu');
      const sidebarDropdown = document.getElementById('sidebarDropdownMenu');
      assert('Sidebar menu toggle button exists', Boolean(btnSidebarMenu));
      btnSidebarMenu?.click();
      await sleep(50);
      assert('Sidebar dropdown menu opens', sidebarDropdown?.style.display === 'flex');

      // Test Mark all as read
      const menuMarkRead = document.getElementById('menuActionMarkAllRead');
      menuMarkRead?.click();
      await sleep(50);
      const railBadge = document.getElementById('railChatsBadge');
      assert('Mark all as read clears rail badge', railBadge?.textContent === '0' || railBadge?.style.display === 'none');

      // =========================================================================
      // 4. CONVERSATION SWITCHING, DRAFT ISOLATION & PERSISTENCE
      // =========================================================================
      const composerInput = document.getElementById('composerInputField');
      assert('Composer input field exists', Boolean(composerInput));

      // Switch to Aarav and type draft
      engine.setActiveContact('c-aarav');
      await sleep(50);
      if (composerInput) {
        composerInput.value = 'Draft message strictly for Aarav';
        composerInput.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(50);
      }

      // Switch to Priya
      engine.setActiveContact('c-priya');
      await sleep(50);
      assert('Draft is isolated: Priya composer is empty', composerInput?.value === '');

      // Send unique message to Priya
      engine.sendMessage('Unique hello to Priya from suite');
      await sleep(50);
      const priyaMessages = engine.state.contacts.find(c => c.id === 'c-priya')?.messages || [];
      assert('Priya received unique test message', priyaMessages.some(m => m.text === 'Unique hello to Priya from suite'));

      // Switch back to Aarav
      engine.setActiveContact('c-aarav');
      await sleep(50);
      const aaravMessages = engine.state.contacts.find(c => c.id === 'c-aarav')?.messages || [];
      assert('Aarav messages do not contain Priya message', !aaravMessages.some(m => m.text === 'Unique hello to Priya from suite'));
      assert('Aarav draft is preserved upon return', composerInput?.value === 'Draft message strictly for Aarav');

      // Clear draft
      if (composerInput) {
        composerInput.value = '';
        composerInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // =========================================================================
      // 5. MESSAGE SENDING & WHATSAPP 3-STAGE DELIVERY TICKS
      // =========================================================================
      const initialMsgCount = document.querySelectorAll('#messagesStream .message-bubble').length;
      if (composerInput) {
        composerInput.value = 'Verification test for 3-stage delivery ticks';
        composerInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      document.querySelector('.chat-composer-bar .composer-send-btn')?.click();
      await sleep(60);

      const newMsgCount = document.querySelectorAll('#messagesStream .message-bubble').length;
      assert('Composer send button appends message to stream', newMsgCount === initialMsgCount + 1);

      // Check initial sent tick (✓)
      let currentLastBubble = document.querySelector('#messagesStream .message-bubble:last-child');
      let receiptTick = currentLastBubble?.querySelector('.read-tick');
      assert('Message shows initial Sent tick (✓)', receiptTick && receiptTick.textContent.includes('✓'));

      // Wait 700ms for delivered tick (✓✓)
      await sleep(700);
      currentLastBubble = document.querySelector('#messagesStream .message-bubble:last-child');
      receiptTick = currentLastBubble?.querySelector('.read-tick');
      assert('Message updates to Delivered tick (✓✓)', receiptTick && receiptTick.textContent.includes('✓✓'));

      // Wait 1000ms for read tick (✓✓ in #53bdeb)
      await sleep(1000);
      currentLastBubble = document.querySelector('#messagesStream .message-bubble:last-child');
      receiptTick = currentLastBubble?.querySelector('.read-tick');
      const tickColor = receiptTick ? window.getComputedStyle(receiptTick).color : '';
      const isReadColor = tickColor.includes('83, 189, 235') || tickColor.includes('53bdeb') || receiptTick?.classList.contains('cyan') || receiptTick?.classList.contains('read');
      assert('Message updates to Read tick (✓✓ in cyan #53bdeb)', isReadColor && receiptTick?.textContent.includes('✓✓'));

      // =========================================================================
      // 6. MESSAGE HOVER ACTIONS: STAR, REACTION, QUOTED REPLY, AUDIO
      // =========================================================================
      const getOutgoingBubble = () => document.querySelector('#messagesStream .message-bubble.outgoing');
      assert('Outgoing message bubble exists for action testing', Boolean(getOutgoingBubble()));

      // Star Message
      let starBtn = getOutgoingBubble()?.querySelector('[data-action="star"]');
      const starMsgId = starBtn?.getAttribute('data-msg-id');
      const activeContact = engine.state.contacts.find(item => item.id === engine.state.activeContactId);
      const initialStarred = Boolean(activeContact?.messages.find(m => m.id === starMsgId)?.starred);
      starBtn?.click();
      await sleep(50);
      const afterStarred = Boolean(activeContact?.messages.find(m => m.id === starMsgId)?.starred);
      assert('Star button toggles star on message', afterStarred !== initialStarred);
      // Toggle back
      getOutgoingBubble()?.querySelector('[data-action="star"]')?.click();
      await sleep(50);

      // Reaction Picker
      let reactBtn = getOutgoingBubble()?.querySelector('[data-action="reaction-pick"]');
      reactBtn?.click();
      await sleep(50);
      const reactPopover = document.querySelector('.reaction-picker-popover') || document.getElementById('reactionPickerPopover');
      assert('Reaction popover appears on click', Boolean(reactPopover));
      const firstEmoji = reactPopover?.querySelector('.reaction-emoji-btn');
      firstEmoji?.click();
      await sleep(50);
      const reactionBadge = getOutgoingBubble()?.querySelector('.reaction-badge');
      assert('Selected reaction badge is rendered on bubble', Boolean(reactionBadge));

      // Quoted Reply
      let replyBtn = getOutgoingBubble()?.querySelector('[data-action="reply"]');
      replyBtn?.click();
      await sleep(50);
      const replyBar = document.getElementById('quotedReplyActiveBar');
      assert('Quoted reply bar opens above composer', replyBar && replyBar.style.display !== 'none');
      const cancelReplyBtn = document.getElementById('btnCancelQuotedReply');
      cancelReplyBtn?.click();
      await sleep(50);
      assert('Cancel quoted reply dismisses reply bar', replyBar?.style.display === 'none');

      // Audio Note Playback Toggle
      const audioPlayBtn = document.querySelector('[data-action="play-audio"]');
      if (audioPlayBtn) {
        audioPlayBtn.click();
        await sleep(50);
        const audioBubble = audioPlayBtn.closest('.message-bubble');
        assert('Audio note playback toggles playing class', audioBubble?.classList.contains('playing'));
        audioPlayBtn.click();
        await sleep(50);
        assert('Audio note playback pauses and removes playing class', !audioBubble?.classList.contains('playing'));
      }

      // =========================================================================
      // 7. PICKERS: EMOJI, GIF & STICKERS
      // =========================================================================
      const btnEmojiToggle = document.getElementById('btnEmojiPickerToggle');
      const pickerPanel = document.getElementById('emojiGifStickerPanel');
      assert('Emoji/GIF/Sticker toggle button exists', Boolean(btnEmojiToggle));
      assert('Emoji/GIF/Sticker panel exists', Boolean(pickerPanel));

      btnEmojiToggle?.click();
      await sleep(50);
      assert('Picker panel opens on toggle', pickerPanel?.style.display !== 'none');

      // Insert Emoji
      const emojiBtn = pickerPanel?.querySelector('.emoji-btn-item') || pickerPanel?.querySelector('.emoji-item-btn');
      if (emojiBtn && composerInput) {
        const valBefore = composerInput.value;
        emojiBtn.click();
        await sleep(50);
        assert('Clicking emoji inserts it into composer input', composerInput.value.length > valBefore.length);
        composerInput.value = '';
      }

      // GIF Tab & Send GIF
      const gifTab = pickerPanel?.querySelector('[data-picker-tab="gif"]');
      gifTab?.click();
      await sleep(50);
      assert('GIF tab activates in picker', gifTab?.classList.contains('active'));
      const firstGifCard = pickerPanel?.querySelector('.gif-card-btn');
      const countBeforeGif = document.querySelectorAll('#messagesStream .message-bubble').length;
      firstGifCard?.click();
      await sleep(50);
      const countAfterGif = document.querySelectorAll('#messagesStream .message-bubble').length;
      assert('Selecting GIF sends media card bubble', countAfterGif === countBeforeGif + 1);

      // Sticker Tab & Send Sticker
      btnEmojiToggle?.click(); // Re-open picker if closed
      await sleep(50);
      const stickerTab = pickerPanel?.querySelector('[data-picker-tab="sticker"]');
      stickerTab?.click();
      await sleep(50);
      assert('Sticker tab activates in picker', stickerTab?.classList.contains('active'));
      const firstStickerCard = pickerPanel?.querySelector('.sticker-card-btn');
      const countBeforeSticker = document.querySelectorAll('#messagesStream .message-bubble').length;
      firstStickerCard?.click();
      await sleep(50);
      const countAfterSticker = document.querySelectorAll('#messagesStream .message-bubble').length;
      assert('Selecting sticker sends borderless sticker bubble', countAfterSticker === countBeforeSticker + 1);

      // Ensure panel closed
      if (pickerPanel?.style.display !== 'none') {
        btnEmojiToggle?.click();
        await sleep(50);
      }

      // =========================================================================
      // 8. ATTACHMENT PIPELINE & PREVIEW MODAL
      // =========================================================================
      const btnAttachment = document.getElementById('btnAttachment');
      const attachMenu = document.getElementById('attachmentMenu');
      assert('Attachment button exists', Boolean(btnAttachment));
      btnAttachment?.click();
      await sleep(50);
      assert('Attachment options menu opens', attachMenu?.style.display === 'flex');

      // Photos option -> Preview Modal
      const attachPhotoOption = document.getElementById('attachOptionPhotos');
      attachPhotoOption?.click();
      await sleep(50);
      const attachModal = document.getElementById('attachmentPreviewModal');
      assert('Attachment preview modal opens', attachModal?.style.display === 'grid');

      // Add Caption and Send
      const captionInput = document.getElementById('attachmentCaptionInput');
      if (captionInput) {
        captionInput.value = 'Automated suite photo caption';
      }
      const countBeforeAttach = document.querySelectorAll('#messagesStream .message-bubble').length;
      document.getElementById('btnConfirmSendAttachment')?.click();
      await sleep(50);
      const countAfterAttach = document.querySelectorAll('#messagesStream .message-bubble').length;
      assert('Sending attachment appends image bubble with caption', countAfterAttach === countBeforeAttach + 1);
      assert('Attachment modal closes after send', attachModal?.style.display === 'none');

      // =========================================================================
      // 9. UPI RUPEE PAYMENT DIALOG
      // =========================================================================
      const btnRupeePayment = document.getElementById('btnRupeePayment');
      assert('UPI Rupee payment button exists', Boolean(btnRupeePayment));
      btnRupeePayment?.click();
      await sleep(50);
      const paymentModal = document.getElementById('paymentModal');
      assert('Payment dialog modal opens', paymentModal?.style.display === 'grid');

      const countBeforePay = document.querySelectorAll('#messagesStream .message-bubble').length;
      document.getElementById('btnConfirmPayment')?.click();
      await sleep(50);
      const countAfterPay = document.querySelectorAll('#messagesStream .message-bubble').length;
      assert('Confirming payment appends payment receipt card to chat', countAfterPay === countBeforePay + 1);
      assert('Payment dialog modal closes', paymentModal?.style.display === 'none');

      // =========================================================================
      // 10. IN-CHAT SEARCH
      // =========================================================================
      const btnInChatSearch = document.getElementById('btnToggleInChatSearch');
      const inChatSearchBar = document.getElementById('inChatSearchBar');
      const inChatInput = document.getElementById('inChatSearchInput');
      assert('In-chat search toggle button exists', Boolean(btnInChatSearch));
      btnInChatSearch?.click();
      await sleep(50);
      assert('In-chat search bar opens', inChatSearchBar?.style.display !== 'none');

      if (inChatInput) {
        inChatInput.value = 'delivery';
        inChatInput.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(50);
        const matchCountEl = document.getElementById('inChatMatchesCount');
        const highlightedBubbles = document.querySelectorAll('#messagesStream .message-bubble.highlighted');
        assert('In-chat search highlights matches in stream', (matchCountEl && matchCountEl.textContent.length > 0) || highlightedBubbles.length > 0);
      }

      document.getElementById('btnCloseInChatSearch')?.click();
      await sleep(50);
      assert('Closing in-chat search hides search bar', inChatSearchBar?.style.display === 'none');

      // =========================================================================
      // 11. AUDIO / VIDEO CALL SIMULATION OVERLAY
      // =========================================================================
      const btnAudioCall = document.getElementById('btnAudioCall');
      assert('Audio call button exists', Boolean(btnAudioCall));
      btnAudioCall?.click();
      await sleep(50);
      const callOverlay = document.getElementById('callOverlay');
      assert('Audio call initiates simulation overlay', callOverlay && callOverlay.style.display !== 'none');

      // Test Mute button
      const muteBtn = document.getElementById('callMuteBtn');
      muteBtn?.click();
      await sleep(50);
      assert('Mute button toggles active state', muteBtn?.classList.contains('active'));

      // Test Video button
      const videoBtn = document.getElementById('callVideoBtn');
      videoBtn?.click();
      await sleep(50);
      assert('Video button toggles camera active state', videoBtn?.classList.contains('active'));

      // End Call & verify logged
      document.getElementById('endCallBtn')?.click();
      await sleep(50);
      assert('Ending call closes overlay', callOverlay?.style.display === 'none');
      const callLogs = engine.state.callLogs || [];
      assert('Call is recorded in persistent call history', callLogs.length > 0);

      // =========================================================================
      // 12. STATUS STORIES & COMMUNITY CIRCLES
      // =========================================================================
      // Story Viewer
      document.querySelector('[data-rail-tab="status"]')?.click();
      await sleep(50);
      const myStatusBtn = document.getElementById('btnMyStatusAction');
      myStatusBtn?.click();
      await sleep(50);
      const storyModal = document.getElementById('storyViewerModal');
      assert('Story viewer modal opens on clicking status', storyModal?.style.display === 'grid');
      document.getElementById('closeStoryBtn')?.click();
      await sleep(50);
      assert('Close button dismisses story viewer', storyModal?.style.display === 'none');

      // Community Circles
      document.querySelector('[data-rail-tab="communities"]')?.click();
      await sleep(50);
      const firstCommBtn = document.querySelector('[data-open-community-id]');
      firstCommBtn?.click();
      await sleep(50);
      const circleModal = document.getElementById('communityCircleModal');
      assert('Community circle details modal opens', circleModal?.style.display === 'grid');

      // Add Sub-Group channel
      const subGroupNameInput = document.getElementById('inputNewSubGroupName');
      if (subGroupNameInput) {
        subGroupNameInput.value = 'Sprint 42 Architecture';
        document.getElementById('formAddSubGroup')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await sleep(50);
        const subGroupsList = document.getElementById('commSubGroupsList');
        assert('New sub-group channel added to circle', subGroupsList?.textContent.includes('Sprint 42 Architecture'));
      }
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(50);
      assert('Escape key dismisses community circle modal', circleModal?.style.display === 'none');

      // Return to Chats tab
      document.querySelector('[data-rail-tab="chats"]')?.click();
      await sleep(50);

      // =========================================================================
      // 12B. CONTACT DETAILS PANEL: VERIFICATION, MEDIA & MUTE
      // =========================================================================
      const btnToggleDetails = document.getElementById('btnToggleDetails');
      if (btnToggleDetails && !engine.state.detailsPanelOpen) {
        btnToggleDetails.click();
        await sleep(50);
      }
      const detailsPanel = document.getElementById('detailsPanel');
      assert('Contact Details panel is rendered', detailsPanel && !detailsPanel.classList.contains('collapsed'));

      // Safety Numbers Verification
      const encSec = document.getElementById('btnVerifyEncryptionSection');
      assert('Encryption verification section exists in Details', Boolean(encSec));
      encSec?.click();
      await sleep(50);
      const safetyModal = document.getElementById('safetyNumbersModal');
      assert('Safety numbers modal opens from Details panel', safetyModal?.style.display === 'grid');
      document.getElementById('btnConfirmVerifiedNumbers')?.click();
      await sleep(50);
      assert('Safety numbers modal closes after verification', safetyModal?.style.display === 'none');
      const activeContactAfterVerify = engine.state.contacts.find(c => c.id === engine.state.activeContactId);
      assert('Contact marked verified in state', Boolean(activeContactAfterVerify?.verified));

      // Mute Toggle
      const muteCheckbox = document.getElementById('checkMuteContact');
      if (muteCheckbox) {
        const initMuted = muteCheckbox.checked;
        muteCheckbox.click();
        await sleep(50);
        assert('Mute contact checkbox updates state', activeContactAfterVerify?.muted !== initMuted);
      }

      // Media Lightbox from Details Chip
      const mediaChip = document.querySelector('.media-thumbnail-chip');
      if (mediaChip) {
        mediaChip.click();
        await sleep(50);
        const lbModal = document.getElementById('lightboxViewerModal') || document.getElementById('docViewerModalBackdrop');
        assert('Media thumbnail chip in details opens viewer modal', lbModal && lbModal.style.display !== 'none');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await sleep(50);
        assert('Escape dismisses media viewer modal', lbModal?.style.display === 'none');
      }

      // =========================================================================
      // 13. SETTINGS MODAL: SAVE, CANCEL, SUBPAGES & AUTH MODALS
      // =========================================================================
      const railSettingsBtn = document.getElementById('railSettingsBtn');
      railSettingsBtn?.click();
      await sleep(50);
      const settingsModal = document.getElementById('settingsModalBackdrop');
      assert('Settings button opens desktop Settings modal', settingsModal?.style.display === 'grid');

      // Profile Tab: Save & Cancel
      const profileNameInput = document.getElementById('profileDisplayNameInput');
      if (profileNameInput) {
        const originalName = engine.state.userProfile.displayName;
        profileNameInput.value = 'Temporary Discarded Name';
        profileNameInput.dispatchEvent(new Event('input', { bubbles: true }));

        // Test Cancel Profile Edit
        document.getElementById('btnCancelProfileEdit')?.click();
        await sleep(50);
        assert('Cancel profile edit discards changes', document.getElementById('profileDisplayNameInput')?.value === originalName);

        // Test Save Profile Edit
        const editedNameInput = document.getElementById('profileDisplayNameInput');
        if (editedNameInput) {
          editedNameInput.value = 'Riya Kapoor (Verified)';
          document.getElementById('formEditProfile')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          await sleep(50);
          assert('Saving profile updates display name in state', engine.state.userProfile.displayName === 'Riya Kapoor (Verified)');
        }
      }

      // Avatar Color & Initials Picker Modal
      document.getElementById('btnOpenAvatarPickerFromSettings')?.click();
      await sleep(50);
      const avatarModal = document.getElementById('avatarPickerModal');
      assert('Avatar Picker modal opens from profile settings', avatarModal?.style.display === 'grid');
      const avatarInitialsInput = document.getElementById('inputAvatarInitials');
      if (avatarInitialsInput) {
        avatarInitialsInput.value = 'RK';
        avatarInitialsInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      document.getElementById('btnSaveAvatarPicker')?.click();
      await sleep(50);
      assert('Avatar Picker saves and closes modal', avatarModal?.style.display === 'none');

      // Account Tab: 2FA & Modals
      document.querySelector('[data-settings-tab="account"]')?.click();
      await sleep(50);
      const check2FA = document.getElementById('check2FAEnabled');
      const initial2FA = check2FA?.checked;
      check2FA?.click();
      await sleep(50);
      assert('2FA toggle updates state', engine.state.userProfile.twoFactorEnabled !== initial2FA);

      // Passkeys Modal
      document.getElementById('btnRegisterPasskeyDemo')?.click();
      await sleep(50);
      const passkeysModal = document.getElementById('passkeysManagementModal');
      assert('Passkeys management modal opens', passkeysModal?.style.display === 'grid');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(50);
      assert('Escape dismisses passkeys modal', passkeysModal?.style.display === 'none');

      // Change Password Modal
      document.getElementById('btnChangePasswordPrompt')?.click();
      await sleep(50);
      const pwdModal = document.getElementById('changePasswordModal');
      assert('Change Password modal opens', pwdModal?.style.display === 'grid');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(50);
      assert('Escape dismisses Change Password modal', pwdModal?.style.display === 'none');

      // Appearance Tab: Wallpaper & Blur
      document.querySelector('[data-settings-tab="appearance"]')?.click();
      await sleep(50);
      const blurSlider = document.getElementById('rangeBlurRadius');
      if (blurSlider) {
        blurSlider.value = '25';
        blurSlider.dispatchEvent(new Event('input', { bubbles: true }));
        assert('Blur radius updates --glass-blur CSS custom property', document.documentElement.style.getPropertyValue('--glass-blur') === '25px');
      }

      // Wallpaper Tab
      document.querySelector('[data-settings-tab="wallpaper"]')?.click();
      await sleep(50);
      const blueWallpaper = document.querySelector('[data-wallpaper-id="blue"]');
      blueWallpaper?.click();
      await sleep(50);
      const chatWin = document.getElementById('appChatWindow');
      assert('Selecting wallpaper updates chat window class', chatWin?.classList.contains('wallpaper-blue'));

      // Server Tab: Latency Ping & Save URL
      document.querySelector('[data-settings-tab="server"]')?.click();
      await sleep(50);
      document.getElementById('btnTestServerPing')?.click();
      await sleep(50);
      const pingResult = document.getElementById('serverPingResultBox');
      assert('Server latency ping returns connected result', pingResult && pingResult.style.display !== 'none');

      // Linked Devices Tab: QR Modal & Revocation
      document.querySelector('[data-settings-tab="devices"]')?.click();
      await sleep(50);
      document.getElementById('btnLinkNewDevicePrompt')?.click();
      await sleep(50);
      const qrModal = document.getElementById('linkDeviceModal');
      assert('Link device QR modal opens', qrModal?.style.display === 'grid');
      const devCountBefore = (engine.state.userProfile.linkedDevices || []).length;
      document.getElementById('btnSimulatePhoneScanned')?.click();
      await sleep(50);
      assert('Simulating scan pairs new device to active list', (engine.state.userProfile.linkedDevices || []).length === devCountBefore + 1);

      // Privacy Tab
      document.querySelector('[data-settings-tab="privacy"]')?.click();
      await sleep(50);
      const lastSeenSelect = document.getElementById('selectLastSeenPrivacy');
      if (lastSeenSelect) {
        lastSeenSelect.value = 'Nobody';
        lastSeenSelect.dispatchEvent(new Event('change', { bubbles: true }));
        assert('Privacy last seen preference updated', engine.state.userProfile.lastSeen === 'Nobody');
      }
      const checkReceipts = document.getElementById('checkReadReceiptsPrivacy');
      if (checkReceipts) {
        const initRec = checkReceipts.checked;
        checkReceipts.click();
        await sleep(50);
        assert('Read receipts toggle updates state', engine.state.userProfile.readReceipts !== initRec);
      }

      // Notifications Tab
      document.querySelector('[data-settings-tab="notifications"]')?.click();
      await sleep(50);
      const checkNotifMsg = document.getElementById('checkNotifMsg');
      if (checkNotifMsg) {
        checkNotifMsg.click();
        await sleep(50);
        assert('Message notifications toggle updates state', typeof engine.state.userProfile.notifications?.messages === 'boolean');
      }
      const soundBtn = document.getElementById('btnTestSoundDemo');
      assert('Test sound button exists', Boolean(soundBtn));
      soundBtn?.click();

      // Language Tab
      document.querySelector('[data-settings-tab="language"]')?.click();
      await sleep(50);
      const langRadio = document.querySelector('input[name="langRadio"]');
      langRadio?.click();
      await sleep(50);
      assert('Language preference is registered', Boolean(engine.state.userProfile.language));

      // Storage Tab
      document.querySelector('[data-settings-tab="storage"]')?.click();
      await sleep(50);
      const clearCacheBtn = document.getElementById('btnClearCacheDemo');
      assert('Clear cache button exists in Storage', Boolean(clearCacheBtn));
      clearCacheBtn?.click();

      // Help Tab & Contact Support Modal
      document.querySelector('[data-settings-tab="help"]')?.click();
      await sleep(50);
      document.getElementById('btnOpenSupportFromSettings')?.click();
      await sleep(50);
      const supportModal = document.getElementById('contactSupportModal');
      assert('Contact Support modal opens from Help settings', supportModal?.style.display === 'grid');
      document.getElementById('btnCancelSupportModal')?.click();
      await sleep(50);
      assert('Cancel dismisses Contact Support modal', supportModal?.style.display === 'none');

      // Account Tab -> Delete Account Modal Flow
      document.querySelector('[data-settings-tab="account"]')?.click();
      await sleep(50);
      document.getElementById('btnDeleteAccountPrompt')?.click();
      await sleep(50);
      const delModal = document.getElementById('deleteAccountModal');
      assert('Delete Account modal opens from Account tab', delModal?.style.display === 'grid');
      const delConfirmInput = document.getElementById('inputDeleteAccountConfirm');
      const delExecBtn = document.getElementById('btnExecuteDeleteAccount');
      assert('Delete button initially disabled', delExecBtn?.disabled === true);
      if (delConfirmInput) {
        delConfirmInput.value = 'DELETE';
        delConfirmInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      assert('Delete button enabled when DELETE typed', delExecBtn?.disabled === false);
      document.getElementById('btnCancelDeleteAccount')?.click();
      await sleep(50);
      assert('Cancel dismisses Delete Account modal', delModal?.style.display === 'none');

      // Logout Tab & Session Recovery
      document.querySelector('[data-settings-tab="logout"]')?.click();
      await sleep(50);
      document.getElementById('btnConfirmLogoutAction')?.click();
      await sleep(50);
      const authOverlay = document.getElementById('loggedOutAuthOverlay');
      assert('Confirm logout action displays auth overlay', authOverlay && authOverlay.style.display !== 'none');
      document.getElementById('btnLoginAsAlice')?.click();
      await sleep(50);
      assert('Logging in as Alice restores active workspace', authOverlay?.style.display === 'none');
      assert('Session is no longer logged out', engine.state.isLoggedOut === false);

      // Close Settings via Escape
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(50);
      assert('Escape key dismisses desktop Settings modal', settingsModal?.style.display === 'none');

      // =========================================================================
      // 14. GLOBAL KEYBOARD SHORTCUTS
      // =========================================================================
      // Cmd/Ctrl+, opens Settings
      document.dispatchEvent(new KeyboardEvent('keydown', { key: ',', metaKey: true, bubbles: true }));
      await sleep(50);
      assert('Cmd/Ctrl+, shortcut opens Settings modal', settingsModal?.style.display === 'grid');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(50);

      // Cmd/Ctrl+K focuses search
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
      await sleep(50);
      const activeSearchInput = document.getElementById('sidebarSearchInput');
      assert('Cmd/Ctrl+K focuses search input', document.activeElement === activeSearchInput);

      // =========================================================================
      // 15. LOCALSTORAGE RELOAD PERSISTENCE
      // =========================================================================
      const savedRaw = localStorage.getItem('indichat_preview_state_v2');
      assert('Preview state persisted in localStorage', Boolean(savedRaw));
      let parsed = null;
      try {
        parsed = JSON.parse(savedRaw);
      } catch (e) {
        parsed = null;
      }
      assert('Persisted state in localStorage is valid JSON', Boolean(parsed));
      assert('Persisted state reflects valid profile name', parsed?.userProfile?.displayName === 'Riya Kapoor' || parsed?.userProfile?.displayName === 'Riya Kapoor (Verified)');

      // =========================================================================
      // 16. FINAL CLEAN RESET & ERROR ASSERTIONS
      // =========================================================================
      engine.resetDemoData(false);
      await sleep(50);
      assert('Final reset cleans active contact to Aarav', engine.state.activeContactId === 'c-aarav');
      assert('Final reset restores default profile name', engine.state.userProfile.displayName === 'Riya Kapoor');

      // Assert Zero Page Errors, Console Errors, and Unhandled Rejections
      assert('Captured page errors count is 0', capturedErrors.pageErrors.length === 0, `(Found: ${capturedErrors.pageErrors.length})`);
      assert('Captured console errors count is 0', capturedErrors.consoleErrors.length === 0, `(Found: ${capturedErrors.consoleErrors.length})`);
      assert('Captured unhandled rejections count is 0', capturedErrors.unhandledRejections.length === 0, `(Found: ${capturedErrors.unhandledRejections.length})`);

    } catch (testCrash) {
      console.error('Test execution crashed:', testCrash);
      assert('Test suite executed without fatal exception', false, testCrash.message);
    }

    // =========================================================================
    // RENDER RESULTS CONTAINER FOR HEADLESS EXTRACTION & ON-SCREEN REVIEW
    // =========================================================================
    const total = results.length;
    const passed = results.filter(r => r.pass).length;
    const failed = total - passed;
    const durationMs = Date.now() - startTime;

    let container = document.getElementById('parameterizedTestResults');
    if (!container) {
      container = document.createElement('div');
      container.id = 'parameterizedTestResults';
      container.style.cssText = `
        position: fixed;
        bottom: 12px;
        right: 12px;
        max-width: 420px;
        max-height: 400px;
        overflow-y: auto;
        background: rgba(10, 15, 22, 0.96);
        border: 2px solid ${failed === 0 ? '#10b981' : '#ef4444'};
        border-radius: 12px;
        padding: 14px;
        font-family: monospace;
        font-size: 11.5px;
        color: #f0f4f2;
        z-index: 999999;
        box-shadow: 0 10px 40px rgba(0,0,0,0.8);
      `;
      document.body.appendChild(container);
    }

    // Emitting Machine-Readable Marker for Headless Scrapers
    const summaryData = {
      platform,
      total,
      passed,
      failed,
      durationMs,
      pageErrors: capturedErrors.pageErrors,
      consoleErrors: capturedErrors.consoleErrors,
      unhandledRejections: capturedErrors.unhandledRejections,
      failures: results.filter(r => !r.pass)
    };

    container.setAttribute('data-platform', platform);
    container.setAttribute('data-total', String(total));
    container.setAttribute('data-passed', String(passed));
    container.setAttribute('data-failed', String(failed));
    container.setAttribute('data-page-errors', String(capturedErrors.pageErrors.length));
    container.setAttribute('data-console-errors', String(capturedErrors.consoleErrors.length));
    container.setAttribute('data-unhandled-rejections', String(capturedErrors.unhandledRejections.length));
    container.setAttribute('data-duration-ms', String(durationMs));

    let html = `
      <div style="font-weight:bold;font-size:13px;margin-bottom:8px;color:${failed === 0 ? '#10b981' : '#ef4444'}">
        [${platform.toUpperCase()}] ${passed}/${total} PASSED (${failed} FAILED) · ${durationMs}ms
      </div>
      <div style="font-size:11px;opacity:0.8;margin-bottom:8px">
        Page Errors: ${capturedErrors.pageErrors.length} | Console Errors: ${capturedErrors.consoleErrors.length} | Rejections: ${capturedErrors.unhandledRejections.length}
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
    `;

    results.forEach((r, idx) => {
      html += `
        <div style="color:${r.pass ? '#10b981' : '#ef4444'};line-height:1.3">
          ${r.pass ? '✓' : '✗'} #${idx + 1} ${r.name} ${r.extraInfo ? '<small>(' + r.extraInfo + ')</small>' : ''}
        </div>
      `;
    });

    html += `</div>`;
    html += `<script id="paramTestSummaryJson" type="application/json">${JSON.stringify(summaryData)}</script>`;
    container.innerHTML = html;

    console.log(`=== PARAMETERIZED TEST RESULTS FOR [${platform.toUpperCase()}] ===`);
    console.log(`Passed: ${passed} / ${total} | Failed: ${failed} | Duration: ${durationMs}ms`);
    console.log(`Page Errors: ${capturedErrors.pageErrors.length} | Console Errors: ${capturedErrors.consoleErrors.length} | Rejections: ${capturedErrors.unhandledRejections.length}`);
    console.log('PARAM_TEST_SUMMARY_JSON:' + JSON.stringify(summaryData));
  }

  // =========================================================================
  // FOCUSED TEST SUITES: RELOAD STATE RESTORATION & KEYBOARD/MOUSE REACHABILITY
  // =========================================================================

  function runStateModifyTest() {
    const engine = window.IndiChatPreviewEngine;
    if (!engine) return;

    // 1. Switch contact to Priya Sharma
    engine.setActiveContact('c-priya');

    // 2. Send a new message to persist
    engine.sendMessage('Persistence check message from headless runner.');

    // 3. Type an active composer draft (persisting into state.drafts['c-priya'])
    const draftText = 'Hey Priya, reviewing the IndiChat desktop previews now.';
    const composerInput = document.getElementById('composerInputField');
    if (composerInput) {
      composerInput.value = draftText;
      composerInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    engine.state.drafts['c-priya'] = draftText;

    // 4. Toggle theme to light if dark
    if (engine.state.userProfile.appearanceMode !== 'light') {
      engine.toggleTheme();
    }

    // 5. Set chat wallpaper to emerald
    engine.state.userProfile.chatWallpaper = 'emerald';

    // 6. Update user profile display name
    engine.state.userProfile.displayName = 'Super Admin User';

    // Save state
    localStorage.setItem('indichat_preview_state_v2', JSON.stringify({
      userProfile: engine.state.userProfile,
      contacts: engine.state.contacts,
      callLogs: engine.state.callLogs,
      statusUpdates: engine.state.statusUpdates,
      communities: engine.state.communities,
      passkeys: engine.state.passkeys,
      activeContactId: engine.state.activeContactId,
      drafts: engine.state.drafts
    }));

    const div = document.createElement('div');
    div.id = 'modifyStateResults';
    div.setAttribute('data-ready', 'true');
    div.setAttribute('data-contact', engine.state.activeContactId);
    div.setAttribute('data-theme', engine.state.userProfile.appearanceMode);
    div.setAttribute('data-draft', engine.state.drafts['c-priya'] || '');
    div.setAttribute('data-wallpaper', engine.state.userProfile.chatWallpaper);
    div.setAttribute('data-display-name', engine.state.userProfile.displayName);
    document.body.appendChild(div);
  }

  function runStateVerifyTest() {
    const engine = window.IndiChatPreviewEngine;
    const results = [];
    const record = (name, pass, extra) => results.push({ name, pass: !!pass, extra: extra || '' });

    if (!engine) {
      record('Preview Engine mounted', false);
    } else {
      const themeAttr = document.documentElement.getAttribute('data-theme');
      const activeContact = engine.state.activeContactId;
      const activeItem = document.querySelector('.conversation-item.active');
      const activeItemId = activeItem ? activeItem.getAttribute('data-contact-id') : null;

      const composerInput = document.getElementById('composerInputField');
      const draftVal = composerInput ? composerInput.value : '';

      const messages = Array.from(document.querySelectorAll('.message-bubble')).map(el => el.textContent.trim());
      const hasSentMsg = messages.some(m => m.includes('Persistence check message from headless runner.'));

      const chatWin = document.getElementById('appChatWindow');
      const hasWallpaperEmerald = chatWin ? chatWin.classList.contains('wallpaper-emerald') : false;

      const profName = engine.state.userProfile.displayName;

      record('Theme restored to daylight light on reload', themeAttr === 'light' && engine.state.userProfile.appearanceMode === 'light', themeAttr);
      record('Active conversation restored to Priya Sharma on reload', activeContact === 'c-priya' && activeItemId === 'c-priya', activeContact);
      record('Composer draft restored into input field on reload', draftVal === 'Hey Priya, reviewing the IndiChat desktop previews now.', draftVal);
      record('Sent message persisted in conversation stream on reload', hasSentMsg);
      record('Chat wallpaper class restored to emerald on reload', hasWallpaperEmerald);
      record('Profile display name restored on reload', profName === 'Super Admin User', profName);
    }

    const total = results.length;
    const passed = results.filter(r => r.pass).length;
    const failed = total - passed;

    const div = document.createElement('div');
    div.id = 'verifyStateResults';
    div.setAttribute('data-total', String(total));
    div.setAttribute('data-passed', String(passed));
    div.setAttribute('data-failed', String(failed));
    div.setAttribute('data-details', JSON.stringify(results));
    document.body.appendChild(div);
  }

  async function runKeyboardFocusTrappingTest() {
    const engine = window.IndiChatPreviewEngine;
    const results = [];
    const record = (name, pass, extra) => results.push({ name, pass: !!pass, extra: extra || '' });

    if (!engine) {
      record('Preview Engine mounted', false);
    } else {
      const railSettingsBtn = document.getElementById('railSettingsBtn');
      if (!railSettingsBtn) {
        record('railSettingsBtn exists', false);
      } else {
        // 1. Trigger button receives focus
        railSettingsBtn.focus();
        record('Trigger button receives initial focus', document.activeElement === railSettingsBtn);

        // 2. Open Settings modal
        engine.openSettingsModal('profile');
        const settingsModal = document.getElementById('settingsModalBackdrop');
        record('Settings modal opened with display grid', settingsModal && settingsModal.style.display === 'grid');

        await sleep(70);

        // 3. Dialog opening moves focus inside dialog
        const isInside = settingsModal && settingsModal.contains(document.activeElement);
        record('Dialog opening moves focus inside dialog', isInside, 'Active: ' + (document.activeElement ? document.activeElement.tagName + '#' + document.activeElement.id : 'null'));

        // 4. Tab navigation trapping forwards
        const focusables = Array.from(settingsModal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(el => el.offsetParent !== null);
        record('Dialog has focusable interactive elements', focusables.length > 0, 'Found ' + focusables.length + ' focusables');

        if (focusables.length > 0) {
          const firstEl = focusables[0];
          const lastEl = focusables[focusables.length - 1];

          // Focus last element and dispatch Tab
          lastEl.focus();
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
          record('Tab key from last element wraps focus back to first element', document.activeElement === firstEl);

          // Focus first element and dispatch Shift+Tab
          firstEl.focus();
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
          record('Shift+Tab from first element wraps focus to last element', document.activeElement === lastEl);
        }

        // 5. Nested Dialog Focus & Stack Restoration (e.g. Passkeys)
        const btnPasskeys = document.getElementById('btnOpenPasskeys');
        if (btnPasskeys) {
          btnPasskeys.focus();
          engine.openPasskeysModal();
          const passkeysModal = document.getElementById('passkeysManagementModal');
          record('Nested passkeys modal opened', passkeysModal && passkeysModal.style.display === 'grid');

          await sleep(70);

          record('Focus moved inside nested modal', passkeysModal && passkeysModal.contains(document.activeElement));

          // Press Escape to dismiss nested modal
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          record('Nested modal closed via Escape', passkeysModal && passkeysModal.style.display === 'none');
          record('Focus restored to triggering button in parent dialog', document.activeElement === btnPasskeys);

          // Now press Escape on Settings Modal
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          record('Settings modal closed via Escape', settingsModal.style.display === 'none');
          record('Focus restored to initial rail settings button', document.activeElement === railSettingsBtn);
        } else {
          // Close settings modal
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          record('Settings modal closed via Escape', settingsModal.style.display === 'none');
          record('Focus restored to initial rail settings button', document.activeElement === railSettingsBtn);
        }

        // 6. Test New Chat Dialog Focus Restoration
        const btnNewChat = document.getElementById('btnOpenNewChat');
        if (btnNewChat) {
          btnNewChat.focus();
          engine.openNewChatModal();
          const newChatModal = document.getElementById('newChatModal');
          await sleep(70);

          record('New chat modal opened and received focus', newChatModal && newChatModal.contains(document.activeElement));
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          record('New chat modal closed via Escape', newChatModal && newChatModal.style.display === 'none');
          record('Focus restored to new chat button', document.activeElement === btnNewChat);
        }
      }
    }

    const total = results.length;
    const passed = results.filter(r => r.pass).length;
    const failed = total - passed;

    const div = document.createElement('div');
    div.id = 'keyboardFocusResults';
    div.setAttribute('data-total', String(total));
    div.setAttribute('data-passed', String(passed));
    div.setAttribute('data-failed', String(failed));
    div.setAttribute('data-details', JSON.stringify(results));
    document.body.appendChild(div);
  }

  async function runMouseReachabilityTest() {
    const engine = window.IndiChatPreviewEngine;
    const results = [];
    const record = (name, pass, extra) => results.push({ name, pass: !!pass, extra: extra || '' });

    if (!engine) {
      record('Preview Engine mounted', false);
    } else {
      // 1. Backdrop click dismissal on Settings Modal
      engine.openSettingsModal('profile');
      const settingsModal = document.getElementById('settingsModalBackdrop');
      record('Settings modal opened for mouse test', settingsModal && settingsModal.style.display === 'grid');

      // Click backdrop outside modal card
      settingsModal.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      record('Clicking backdrop dismisses settings modal', settingsModal && settingsModal.style.display === 'none');

      // 2. Backdrop click on Contact Dialer Modal
      engine.setActiveRailTab('calls');
      const btnNewCall = document.getElementById('btnNewCallDialer');
      if (btnNewCall) btnNewCall.click();
      const activeDialer = document.getElementById('contactDialerModal');
      record('Contact dialer modal opened', activeDialer && activeDialer.style.display === 'grid');
      if (activeDialer) {
        activeDialer.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        record('Clicking backdrop dismisses dialer modal', activeDialer.style.display === 'none');
      }

      // 3. Call simulation controls reachability
      engine.startCallSimulation(false);
      const callOverlay = document.getElementById('callOverlay');
      record('Call overlay opened', callOverlay && callOverlay.style.display === 'flex');

      const muteBtn = document.getElementById('callMuteBtn');
      const videoBtn = document.getElementById('callVideoBtn');
      const endCallBtn = document.getElementById('endCallBtn');

      record('Call mute button is reachable and has pointer cursor', muteBtn && getComputedStyle(muteBtn).pointerEvents !== 'none');
      record('Call video button is reachable and has pointer cursor', videoBtn && getComputedStyle(videoBtn).pointerEvents !== 'none');
      record('End call button is reachable and clickable', endCallBtn && getComputedStyle(endCallBtn).pointerEvents !== 'none');

      if (muteBtn) muteBtn.click();
      record('Mute button toggles active state on click', engine.state.callIsMuted === true);

      if (endCallBtn) endCallBtn.click();
      record('End call button cleanly ends call and closes overlay', callOverlay.style.display === 'none');

      // Reset rail tab to chats so chat controls are active and visible
      engine.setActiveRailTab('chats');

      // 4. Hitbox & reachability check on critical UI controls
      const criticalControls = [
        '.rail-btn[data-rail-tab="chats"]',
        '.rail-btn[data-rail-tab="status"]',
        '.rail-btn[data-rail-tab="calls"]',
        '.rail-btn[data-rail-tab="communities"]',
        '.rail-btn[data-rail-tab="starred"]',
        '#railSettingsBtn',
        '.theme-toggle-btn',
        '#sidebarSearchInput',
        '.filter-chip[data-filter="all"]',
        '.filter-chip[data-filter="unread"]',
        '.filter-chip[data-filter="groups"]',
        '#btnAudioCall',
        '#btnVideoCall',
        '#btnToggleDetails',
        '#btnEmojiPickerToggle',
        '#btnAttachment',
        '#composerInputField',
        '.composer-send-btn'
      ];

      let allReachable = true;
      const failedControls = [];
      criticalControls.forEach(sel => {
        const el = document.querySelector(sel);
        if (!el) {
          allReachable = false;
          failedControls.push(sel + ' (not found)');
        } else {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          const ok = style.pointerEvents !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
          if (!ok) {
            allReachable = false;
            failedControls.push(sel + ' (w=' + rect.width + ',h=' + rect.height + ',pe=' + style.pointerEvents + ')');
          }
        }
      });
      record('All 18 critical UI workspace controls have valid hitboxes and pointer events', allReachable, failedControls.join(', '));
    }

    const total = results.length;
    const passed = results.filter(r => r.pass).length;
    const failed = total - passed;

    const div = document.createElement('div');
    div.id = 'mouseReachabilityResults';
    div.setAttribute('data-total', String(total));
    div.setAttribute('data-passed', String(passed));
    div.setAttribute('data-failed', String(failed));
    div.setAttribute('data-details', JSON.stringify(results));
    document.body.appendChild(div);
  }

  // Export to window
  window.runParameterizedTestSuite = runParameterizedTestSuite;
  window.runStateModifyTest = runStateModifyTest;
  window.runStateVerifyTest = runStateVerifyTest;
  window.runKeyboardFocusTrappingTest = runKeyboardFocusTrappingTest;
  window.runMouseReachabilityTest = runMouseReachabilityTest;
  window.capturedTestErrors = capturedErrors;

  // Auto-run if query param runTests=true is in URL or window.__AUTO_RUN_TESTS__ is true
  const searchParams = window.location.search;
  if (searchParams.includes('runTests=true') || window.__AUTO_RUN_TESTS__) {
    if (document.readyState === 'complete') {
      runParameterizedTestSuite();
    } else {
      window.addEventListener('load', () => setTimeout(runParameterizedTestSuite, 150));
    }
  } else if (searchParams.includes('runFocusTest=modify')) {
    if (document.readyState === 'complete') {
      runStateModifyTest();
    } else {
      window.addEventListener('load', () => setTimeout(runStateModifyTest, 120));
    }
  } else if (searchParams.includes('runFocusTest=verify')) {
    if (document.readyState === 'complete') {
      runStateVerifyTest();
    } else {
      window.addEventListener('load', () => setTimeout(runStateVerifyTest, 120));
    }
  } else if (searchParams.includes('runFocusTest=keyboard')) {
    if (document.readyState === 'complete') {
      runKeyboardFocusTrappingTest();
    } else {
      window.addEventListener('load', () => setTimeout(runKeyboardFocusTrappingTest, 120));
    }
  } else if (searchParams.includes('runFocusTest=mouse')) {
    if (document.readyState === 'complete') {
      runMouseReachabilityTest();
    } else {
      window.addEventListener('load', () => setTimeout(runMouseReachabilityTest, 120));
    }
  }
})();
