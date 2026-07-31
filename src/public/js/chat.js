(function () {
  const $ = (id) => document.getElementById(id);

  let sessionPhone = null;
  let activeJid = null;
  let activeIsGroup = false;
  let activeChatName = '';
  let ws = null;
  let reconnectTimer = null;
  let allChats = [];
  let groupNames = {};

  const STATUS_MAP = { 0: '', 1: 'sent', 2: 'delivered', 3: 'read', 4: 'played' };

  const SKIP_TYPES = new Set([
    'senderKeyDistributionMessage',
    'protocolMessage',
    'reactionMessage',
    'pollUpdateMessage',
    'messageContextInfo',
    'encReactionMessage',
    'callLogMesssage',
  ]);

  function isGroupJid(jid) {
    return typeof jid === 'string' && jid.endsWith('@g.us');
  }

  function jidDisplay(jid) {
    if (!jid) return 'Unknown';
    return jid.split('@')[0] ?? jid;
  }

  function chatDisplayName(chat) {
    if (isGroupJid(chat.remote_jid)) {
      return groupNames[chat.remote_jid] || chat.group_name || jidDisplay(chat.remote_jid);
    }
    return chat.push_name || jidDisplay(chat.remote_jid);
  }

  function avatarChar(name) {
    return (name || '?')[0].toUpperCase();
  }

  function formatTime(ms) {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(ms) {
    const d = new Date(ms);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function connectWs() {
    if (ws) {
      try {
        ws.close();
      } catch {}
    }

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}/ws`);

    ws.onopen = () => {
      clearTimeout(reconnectTimer);
      if (sessionPhone) {
        ws.send(JSON.stringify({ type: 'subscribe_chat', sessionPhone }));
      }
    };

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      handleWsMessage(msg);
    };

    ws.onclose = () => {
      reconnectTimer = setTimeout(connectWs, 3000);
    };
  }

  function handleWsMessage(msg) {
    if (msg.type === 'message') {
      const d = msg.data;
      if (d.sessionPhone !== sessionPhone) return;
      if (shouldSkipMessage(d)) return;

      upsertChatInSidebar(d);

      if (d.remoteJid === activeJid) {
        const area = $('messagesArea');
        const wasAtBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 80;
        area.appendChild(buildBubbleEl(d));
        if (wasAtBottom) {
          requestAnimationFrame(() => scrollToBottom());
        }
      }
    }

    if (msg.type === 'message_deleted') {
      const d = msg.data;
      if (d.remoteJid !== activeJid) return;
      const el = document.querySelector(`[data-msg-id="${CSS.escape(d.messageId)}"]`);
      if (el) {
        const bubble = el.querySelector('.bubble');
        if (bubble) {
          bubble.className = 'bubble deleted';
          bubble.textContent = 'This message was deleted';
        }
      }
    }

    if (msg.type === 'receipt') {
      const d = msg.data;
      const statusEl = document.querySelector(
        `[data-msg-id="${CSS.escape(d.messageId)}"] .message-status`,
      );
      if (statusEl) {
        statusEl.textContent = STATUS_MAP[d.status] ?? '';
        if (d.status === 3) statusEl.classList.add('read');
      }
    }

    if (msg.type === 'presence') {
      const d = msg.data;
      if (d.jid !== activeJid) return;
      const pres = Object.values(d.presences ?? {})[0];
      $('activeChatPresence').textContent =
        pres?.lastKnownPresence === 'composing' ? 'typing...' : '';
    }

    if (msg.type === 'chats') {
      renderChatList(msg.data);
    }
  }

  function shouldSkipMessage(d) {
    const text = d.textContent ?? d.text_content;
    const media = d.mediaType ?? d.media_type;
    const deleted = d.isDeleted || d.is_deleted;
    if (deleted) return false;
    if (text) return false;
    if (media) return false;
    return true;
  }

  function upsertChatInSidebar(d) {
    const jid = d.remoteJid;
    const isGroup = isGroupJid(jid);
    const existing = allChats.find((c) => c.remote_jid === jid);
    const text = d.textContent ?? d.text_content ?? null;
    const media = d.mediaType ?? d.media_type ?? null;
    const preview = text || (media ? mediaLabel(media) : null);

    if (existing) {
      if (preview) existing.last_text = preview;
      existing.last_timestamp = d.timestamp;
      if (!isGroup && (d.pushName || d.push_name)) {
        existing.push_name = d.pushName ?? d.push_name;
      }
    } else {
      allChats.unshift({
        remote_jid: jid,
        last_text: preview,
        last_timestamp: d.timestamp,
        push_name: isGroup ? null : (d.pushName ?? d.push_name ?? null),
        group_name: null,
      });
    }

    allChats.sort((a, b) => (b.last_timestamp ?? 0) - (a.last_timestamp ?? 0));
    renderChatList(allChats);
  }

  function mediaLabel(type) {
    const labels = {
      image: 'Photo',
      video: 'Video',
      audio: 'Voice message',
      document: 'Document',
      sticker: 'Sticker',
    };
    return labels[type] ?? 'Media';
  }

  function renderChatList(chats) {
    allChats = chats;
    const query = $('searchInput').value.toLowerCase();
    const filtered = query
      ? chats.filter((c) => {
          const name = chatDisplayName(c);
          return name.toLowerCase().includes(query);
        })
      : chats;

    const list = $('chatList');
    list.innerHTML = '';

    if (filtered.length === 0) {
      list.innerHTML =
        '<div style="padding:1.5rem;text-align:center;color:var(--text-dim);font-size:0.8rem;">No chats yet</div>';
      return;
    }

    for (const chat of filtered) {
      const name = chatDisplayName(chat);
      const preview = chat.last_text || '';
      const time = chat.last_timestamp ? formatTime(chat.last_timestamp) : '';
      const isActive = chat.remote_jid === activeJid;

      const item = document.createElement('div');
      item.className = `chat-item${isActive ? ' active' : ''}`;
      item.dataset.jid = chat.remote_jid;
      item.innerHTML = `
        <div class="chat-avatar">${escHtml(avatarChar(name))}</div>
        <div class="chat-item-info">
          <div class="chat-item-name">${escHtml(name)}</div>
          <div class="chat-item-preview">${escHtml(preview)}</div>
        </div>
        <div class="chat-item-time">${escHtml(time)}</div>
      `;
      item.addEventListener('click', () => openChat(chat.remote_jid, name));
      list.appendChild(item);
    }
  }

  async function openChat(jid, name) {
    activeJid = jid;
    activeIsGroup = isGroupJid(jid);
    activeChatName = name;

    document.querySelectorAll('.chat-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.jid === jid);
    });

    $('emptyState').style.display = 'none';
    const container = $('activeChat');
    container.classList.add('visible');

    $('activeChatAvatar').textContent = avatarChar(name);
    $('activeChatName').textContent = name;
    $('activeChatPresence').textContent = '';
    $('sendBtn').disabled = false;
    $('composeInput').disabled = false;

    const area = $('messagesArea');
    area.innerHTML =
      '<div style="text-align:center;color:var(--text-dim);font-size:0.78rem;padding:1rem;">Loading messages...</div>';

    try {
      const res = await fetch(
        `/api/messages?session=${encodeURIComponent(sessionPhone)}&jid=${encodeURIComponent(jid)}`,
      );
      const data = await res.json();
      renderMessages(data.messages ?? []);
      requestAnimationFrame(() => scrollToBottom());
    } catch {
      area.innerHTML =
        '<div style="text-align:center;color:var(--text-dim);font-size:0.78rem;padding:1rem;">Failed to load messages</div>';
    }
  }

  function renderMessages(messages) {
    const area = $('messagesArea');
    area.innerHTML = '';

    const visible = messages.filter((m) => !shouldSkipStoredMessage(m));
    const sorted = [...visible].sort((a, b) => a.timestamp - b.timestamp);
    let lastDate = null;

    const fragment = document.createDocumentFragment();

    for (const msg of sorted) {
      const dateStr = formatDate(msg.timestamp);
      if (dateStr !== lastDate) {
        const div = document.createElement('div');
        div.className = 'date-divider';
        div.textContent = dateStr;
        fragment.appendChild(div);
        lastDate = dateStr;
      }
      fragment.appendChild(buildBubbleEl(msg));
    }

    area.appendChild(fragment);
  }

  function shouldSkipStoredMessage(msg) {
    const text = msg.text_content ?? msg.textContent;
    const media = msg.media_type ?? msg.mediaType;
    const deleted = msg.is_deleted || msg.isDeleted;
    if (deleted) return false;
    if (text) return false;
    if (media) return false;
    return true;
  }

  function buildBubbleEl(msg) {
    const isOut = msg.from_me === 1 || msg.fromMe === true;
    const isGroup = activeIsGroup;

    const row = document.createElement('div');
    row.className = `message-row ${isOut ? 'outgoing' : 'incoming'}`;
    row.dataset.msgId = msg.message_id ?? msg.messageId ?? '';

    if (!isOut && isGroup) {
      const senderName = msg.push_name ?? msg.pushName ?? null;
      if (senderName) {
        const sender = document.createElement('div');
        sender.className = 'message-sender';
        sender.textContent = senderName;
        row.appendChild(sender);
      }
    }

    const bubble = document.createElement('div');

    const deleted = msg.is_deleted || msg.isDeleted;
    const text = msg.text_content ?? msg.textContent ?? null;
    const media = msg.media_type ?? msg.mediaType ?? null;

    if (deleted) {
      bubble.className = 'bubble deleted';
      bubble.textContent = 'This message was deleted';
    } else if (text) {
      bubble.className = 'bubble';
      bubble.textContent = text;
    } else if (media) {
      bubble.className = 'bubble';
      const icon = mediaIcon(media);
      const label = mediaLabel(media);
      const id = escHtml(msg.message_id ?? msg.messageId ?? '');
      bubble.innerHTML = `<span class="media-placeholder" data-media-id="${id}">${icon}${escHtml(label)}</span>`;
    } else {
      return document.createDocumentFragment();
    }

    row.appendChild(bubble);

    const meta = document.createElement('div');
    meta.className = 'message-meta';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-time';
    timeSpan.textContent = formatTime(msg.timestamp);
    meta.appendChild(timeSpan);

    if (isOut) {
      const statusSpan = document.createElement('span');
      statusSpan.className = 'message-status';
      statusSpan.textContent = STATUS_MAP[msg.status ?? 0] ?? '';
      meta.appendChild(statusSpan);
    }

    row.appendChild(meta);
    return row;
  }

  function mediaIcon(type) {
    const icons = {
      image:
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>',
      video:
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>',
      audio:
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>',
      document:
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>',
      sticker:
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" /></svg>',
    };
    return icons[type] ?? icons['document'];
  }

  function scrollToBottom() {
    const area = $('messagesArea');
    area.scrollTop = area.scrollHeight;
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function sendMessage() {
    const input = $('composeInput');
    const text = input.value.trim();
    if (!text || !activeJid) return;

    input.value = '';
    input.style.height = 'auto';
    $('sendBtn').disabled = true;

    try {
      await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionPhone, remoteJid: activeJid, text }),
      });
    } catch {}

    $('sendBtn').disabled = false;
  }

  $('composeInput').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    $('sendBtn').disabled = !this.value.trim() || !activeJid;
  });

  $('composeInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  $('sendBtn').addEventListener('click', sendMessage);

  $('searchInput').addEventListener('input', () => {
    renderChatList(allChats);
  });

  $('setupBtn').addEventListener('click', async () => {
    const val = $('sessionInput')
      .value.trim()
      .replace(/[^0-9]/g, '');
    const errEl = $('setupError');
    errEl.style.display = 'none';

    if (val.length < 10) {
      errEl.textContent = 'Enter a valid phone number with country code.';
      errEl.style.display = 'block';
      return;
    }

    $('setupBtn').disabled = true;
    $('setupBtn').textContent = 'Connecting...';

    try {
      const res = await fetch(`/api/chats?session=${encodeURIComponent(val)}`);
      if (!res.ok) throw new Error('Session not found or not connected yet');
      const data = await res.json();

      sessionPhone = val;
      $('setupScreen').style.display = 'none';
      $('chatApp').style.display = 'grid';
      $('sessionBadge').textContent = '+' + val;

      renderChatList(data.chats ?? []);
      connectWs();
    } catch (err) {
      errEl.textContent = err.message || 'Could not load session. Is this number connected?';
      errEl.style.display = 'block';
      $('setupBtn').disabled = false;
      $('setupBtn').textContent = 'Open Chat';
    }
  });

  $('sessionInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('setupBtn').click();
  });
})();
