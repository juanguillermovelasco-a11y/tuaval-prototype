/**
 * Tu Aval — AI Chat Engine
 * Conversación libre con Claude (vía /api/chat en Vercel).
 *
 * Uso:
 *   TuAvalChat.init({
 *     mountSelector: '#chat-root',
 *     role: 'student' | 'landlord' | 'investor',
 *     storageKey: 'tu_aval_chat_student',
 *     onComplete: (data) => { ... },    // llamado cuando IA emite [ONBOARDING_COMPLETE]
 *     apiEndpoint: '/api/chat',         // opcional, default /api/chat
 *     fallbackFirstMessage: '...'       // opcional, mensaje si la API falla
 *   });
 */

(function () {
  const css = `
    .tac-wrap { max-width: 760px; margin: 0 auto; height: calc(100vh - 80px); display: flex; flex-direction: column; background: white; }
    .tac-header { padding: 24px 24px 20px; background: white; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; gap: 14px; }
    .tac-avatar { width: 40px; height: 40px; border-radius: 10px; background: #0A2540; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; font-weight: 600; font-family: -apple-system, Inter, system-ui, sans-serif; letter-spacing: -0.04em; position: relative; }
    .tac-avatar::after { content: ''; position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; background: #3BE2B0; border-radius: 50%; border: 2px solid white; }
    .tac-header-text h3 { font-family: -apple-system, Inter, system-ui, sans-serif; font-weight: 600; color: #0A2540; font-size: 15px; margin: 0; letter-spacing: -0.01em; }
    .tac-header-text p { font-size: 12px; color: #9ca3af; margin: 2px 0 0; display: flex; align-items: center; gap: 6px; }
    .tac-header-text p::before { content: ''; width: 6px; height: 6px; background: #0D9B6A; border-radius: 50%; display: inline-block; }
    .tac-messages { flex: 1; overflow-y: auto; padding: 32px 24px; display: flex; flex-direction: column; gap: 12px; background: white; }
    .tac-msg { display: flex; gap: 10px; animation: tacFadeIn 0.3s ease; max-width: 85%; }
    .tac-msg-bot { align-self: flex-start; }
    .tac-msg-user { align-self: flex-end; flex-direction: row-reverse; }
    .tac-bubble { padding: 12px 18px; border-radius: 18px; font-size: 15px; line-height: 1.5; word-wrap: break-word; font-family: -apple-system, Inter, system-ui, sans-serif; white-space: pre-wrap; }
    .tac-msg-bot .tac-bubble { background: #f3f4f6; color: #0A2540; border-bottom-left-radius: 4px; }
    .tac-msg-user .tac-bubble { background: #0A2540; color: white; border-bottom-right-radius: 4px; }
    .tac-typing { display: flex; gap: 4px; padding: 14px 18px; background: #f3f4f6; border-radius: 18px; border-bottom-left-radius: 4px; }
    .tac-typing span { width: 7px; height: 7px; background: #9ca3af; border-radius: 50%; animation: tacBounce 1.2s infinite; }
    .tac-typing span:nth-child(2) { animation-delay: 0.2s; }
    .tac-typing span:nth-child(3) { animation-delay: 0.4s; }
    .tac-input-zone { padding: 16px 24px 24px; background: white; border-top: 1px solid #f3f4f6; }
    .tac-input-row { display: flex; gap: 10px; align-items: flex-end; }
    .tac-input { flex: 1; padding: 14px 20px; border: 1px solid #e5e7eb; border-radius: 22px; font-size: 15px; font-family: -apple-system, Inter, system-ui, sans-serif; outline: none; transition: border-color 0.2s; color: #0A2540; resize: none; min-height: 48px; max-height: 120px; line-height: 1.4; }
    .tac-input:focus { border-color: #0A2540; }
    .tac-input::placeholder { color: #9ca3af; }
    .tac-send { padding: 14px 24px; background: #0A2540; color: white; border: none; border-radius: 9999px; font-weight: 500; font-size: 14px; cursor: pointer; transition: opacity 0.2s; font-family: -apple-system, Inter, system-ui, sans-serif; white-space: nowrap; }
    .tac-send:hover { opacity: 0.85; }
    .tac-send:disabled { opacity: 0.3; cursor: not-allowed; }
    .tac-done { text-align: center; padding: 20px; color: #0D9B6A; font-weight: 500; font-family: -apple-system, Inter, system-ui, sans-serif; }
    .tac-error { padding: 12px 18px; background: #fef2f2; color: #991b1b; border-radius: 12px; font-size: 13px; margin-bottom: 12px; font-family: -apple-system, Inter, system-ui, sans-serif; }
    @keyframes tacFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes tacBounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
    .tac-messages::-webkit-scrollbar { width: 6px; }
    .tac-messages::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 3px; }
  `;

  const GREETINGS = {
    student: '¡Hola! 👋 Soy tu asistente de Tu Aval. En 2 minutos te monto tu garantía para alquilar en España. ¿Cómo te llamas?',
    landlord: '¡Bienvenido a Tu Aval! 👋 Soy tu asistente. Te ayudo a registrar tus propiedades en 2 minutos. ¿Cómo te llamas?',
    investor: '¡Hola! 👋 Soy tu asistente de inversión en Tu Aval. En 2 minutos configuramos tu perfil. ¿Cómo te llamas?',
  };

  const BOT_NAMES = {
    student: 'Asistente de Tu Aval',
    landlord: 'Asistente para propietarios',
    investor: 'Asesor de inversión',
  };

  function injectCss() {
    if (document.getElementById('tac-styles')) return;
    const s = document.createElement('style');
    s.id = 'tac-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  function init(opts) {
    injectCss();

    const root = document.querySelector(opts.mountSelector);
    if (!root) throw new Error('TuAvalChat: mount no encontrado');

    const role = opts.role || 'student';
    const endpoint = opts.apiEndpoint || '/api/chat';
    const storageKey = opts.storageKey || `tu_aval_chat_${role}`;

    // UI
    const wrap = document.createElement('div');
    wrap.className = 'tac-wrap';
    wrap.innerHTML = `
      <div class="tac-header">
        <div class="tac-avatar">a</div>
        <div class="tac-header-text">
          <h3>${BOT_NAMES[role] || 'Asistente Tu Aval'}</h3>
          <p>En línea</p>
        </div>
      </div>
      <div class="tac-messages" id="tac-messages"></div>
      <div class="tac-input-zone" id="tac-input-zone"></div>
    `;
    root.appendChild(wrap);

    const messagesEl = wrap.querySelector('#tac-messages');
    const inputZone = wrap.querySelector('#tac-input-zone');

    // Conversation state
    const history = []; // [{role:'user'|'assistant', content}]
    let isCompleted = false;

    function renderMessages() {
      messagesEl.innerHTML = '';
      history.forEach((m) => {
        const div = document.createElement('div');
        div.className = 'tac-msg ' + (m.role === 'user' ? 'tac-msg-user' : 'tac-msg-bot');
        div.innerHTML = `<div class="tac-bubble">${escapeHtml(m.displayContent || m.content)}</div>`;
        messagesEl.appendChild(div);
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function addTypingIndicator() {
      const div = document.createElement('div');
      div.className = 'tac-msg tac-msg-bot';
      div.id = 'tac-typing-now';
      div.innerHTML = `<div class="tac-typing"><span></span><span></span><span></span></div>`;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function removeTypingIndicator() {
      const t = document.getElementById('tac-typing-now');
      if (t) t.remove();
    }

    function addStreamingBotMsg() {
      const div = document.createElement('div');
      div.className = 'tac-msg tac-msg-bot';
      div.id = 'tac-streaming-now';
      div.innerHTML = `<div class="tac-bubble"></div>`;
      messagesEl.appendChild(div);
      return div.querySelector('.tac-bubble');
    }

    function renderInput() {
      if (isCompleted) return;
      inputZone.innerHTML = '';

      const row = document.createElement('div');
      row.className = 'tac-input-row';

      const input = document.createElement('textarea');
      input.className = 'tac-input';
      input.placeholder = 'Escribe tu respuesta...';
      input.rows = 1;

      // Auto-resize
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      });

      const btn = document.createElement('button');
      btn.className = 'tac-send';
      btn.textContent = 'Enviar';

      function submit() {
        const v = input.value.trim();
        if (!v || btn.disabled) return;
        sendMessage(v);
      }

      btn.onclick = submit;
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          submit();
        }
      });

      row.appendChild(input);
      row.appendChild(btn);
      inputZone.appendChild(row);
      setTimeout(() => input.focus(), 100);
    }

    function disableInput() {
      const btn = inputZone.querySelector('.tac-send');
      const input = inputZone.querySelector('.tac-input');
      if (btn) btn.disabled = true;
      if (input) input.disabled = true;
    }

    function enableInput() {
      const btn = inputZone.querySelector('.tac-send');
      const input = inputZone.querySelector('.tac-input');
      if (btn) btn.disabled = false;
      if (input) {
        input.disabled = false;
        input.value = '';
        input.style.height = 'auto';
        input.focus();
      }
    }

    function showError(msg) {
      const err = document.createElement('div');
      err.className = 'tac-error';
      err.textContent = msg;
      inputZone.insertBefore(err, inputZone.firstChild);
      setTimeout(() => err.remove(), 6000);
    }

    function checkForCompletion(fullText) {
      const marker = '[ONBOARDING_COMPLETE]';
      const idx = fullText.indexOf(marker);
      if (idx === -1) return { visible: fullText, complete: false, data: null };

      const visible = fullText.slice(0, idx).trim();
      const jsonPart = fullText.slice(idx + marker.length).trim();

      let data = null;
      try {
        // Try to extract JSON block
        const firstBrace = jsonPart.indexOf('{');
        const lastBrace = jsonPart.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          data = JSON.parse(jsonPart.slice(firstBrace, lastBrace + 1));
        }
      } catch (e) {
        console.warn('Failed to parse onboarding JSON:', e);
      }

      return { visible, complete: true, data };
    }

    function finish(data) {
      isCompleted = true;
      inputZone.innerHTML = '<div class="tac-done">✓ Conversación completada</div>';
      localStorage.setItem(storageKey + '_data', JSON.stringify(data || {}));
      localStorage.setItem(storageKey + '_complete', 'true');
      if (typeof opts.onComplete === 'function') {
        try { opts.onComplete(data || {}); } catch (e) { console.error(e); }
      }
    }

    async function sendMessage(userText) {
      // Add user message
      history.push({ role: 'user', content: userText });
      renderMessages();
      disableInput();
      addTypingIndicator();

      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role,
            messages: history.map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        if (!resp.ok) {
          removeTypingIndicator();
          const errText = await resp.text().catch(() => '');
          throw new Error(`API ${resp.status}: ${errText || resp.statusText}`);
        }

        removeTypingIndicator();
        const bubble = addStreamingBotMsg();

        // Stream text
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          // Hide the [ONBOARDING_COMPLETE] marker from the UI as it streams
          const { visible } = checkForCompletion(fullText);
          bubble.textContent = visible || fullText;
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        // Cleanup streaming id
        const streamingEl = document.getElementById('tac-streaming-now');
        if (streamingEl) streamingEl.id = '';

        // Final check
        const { visible, complete, data } = checkForCompletion(fullText);
        const displayContent = visible || fullText;

        history.push({
          role: 'assistant',
          content: fullText,
          displayContent,
        });

        // Re-render so escaping is consistent
        renderMessages();

        if (complete) {
          finish(data);
        } else {
          enableInput();
        }
      } catch (err) {
        removeTypingIndicator();
        console.error('Chat error:', err);
        enableInput();
        showError('No pude conectar con el asistente. Inténtalo de nuevo en un momento.');
      }
    }

    // Initial greeting (local, no API call)
    async function start() {
      addTypingIndicator();
      await new Promise((r) => setTimeout(r, 600));
      removeTypingIndicator();

      const greeting = opts.fallbackFirstMessage || GREETINGS[role];
      history.push({ role: 'assistant', content: greeting });
      renderMessages();
      renderInput();
    }

    start();
  }

  window.TuAvalChat = { init };
})();
