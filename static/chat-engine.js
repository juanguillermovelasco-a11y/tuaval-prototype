/**
 * Tu Aval — Chat Engine
 * Motor de chat scripted para onboardings conversacionales.
 *
 * Uso:
 *   TuAvalChat.init({
 *     mountSelector: '#chat-root',
 *     storageKey: 'tu_aval_chat_estudiante',
 *     script: [...steps],
 *     onComplete: (data) => { ... }
 *   });
 *
 * Cada step:
 *   { id: 'name', bot: 'Hola, ¿cómo te llamas?', input: 'text', placeholder: 'Tu nombre' }
 *   { id: 'country', bot: '¿De dónde vienes?', input: 'choice', choices: ['México','Chile','Colombia','Argentina'] }
 *   { id: 'monto', bot: '¿Cuánto quieres invertir?', input: 'number', suffix: '€', min: 1000 }
 *   { id: 'info', bot: 'Genial, dame un momento...', delay: 1500 } // sin input, solo mensaje
 *
 * Soporta saltos: cada step puede tener `next: (answer, data) => 'idDelSiguiente'`
 */
(function () {
  const TYPING_DELAY = 700;
  const BOT_DELAY = 400;

  const css = `
    .tac-wrap { max-width: 760px; margin: 0 auto; height: calc(100vh - 64px); display: flex; flex-direction: column; }
    .tac-header { padding: 16px 20px; background: white; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 12px; }
    .tac-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #3BE2B0, #4A90E2); display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; }
    .tac-header-text h3 { font-family: Poppins, sans-serif; font-weight: 700; color: #0A2540; font-size: 16px; margin: 0; }
    .tac-header-text p { font-size: 12px; color: #24B47E; margin: 0; display: flex; align-items: center; gap: 5px; }
    .tac-header-text p::before { content: ''; width: 8px; height: 8px; background: #24B47E; border-radius: 50%; display: inline-block; }
    .tac-progress { height: 3px; background: #f3f4f6; }
    .tac-progress-bar { height: 100%; background: linear-gradient(90deg, #3BE2B0, #4A90E2); transition: width 0.4s ease; }
    .tac-messages { flex: 1; overflow-y: auto; padding: 24px 20px; display: flex; flex-direction: column; gap: 14px; background: #f9fafb; }
    .tac-msg { display: flex; gap: 10px; animation: tacFadeIn 0.3s ease; max-width: 85%; }
    .tac-msg-bot { align-self: flex-start; }
    .tac-msg-user { align-self: flex-end; flex-direction: row-reverse; }
    .tac-bubble { padding: 12px 16px; border-radius: 18px; font-size: 14px; line-height: 1.5; word-wrap: break-word; }
    .tac-msg-bot .tac-bubble { background: white; color: #0A2540; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
    .tac-msg-user .tac-bubble { background: linear-gradient(135deg, #3BE2B0, #4A90E2); color: white; border-bottom-right-radius: 4px; }
    .tac-typing { display: flex; gap: 4px; padding: 14px 16px; }
    .tac-typing span { width: 8px; height: 8px; background: #cbd5e1; border-radius: 50%; animation: tacBounce 1.2s infinite; }
    .tac-typing span:nth-child(2) { animation-delay: 0.2s; }
    .tac-typing span:nth-child(3) { animation-delay: 0.4s; }
    .tac-input-zone { padding: 16px 20px; background: white; border-top: 1px solid #e5e7eb; }
    .tac-input-row { display: flex; gap: 10px; }
    .tac-input { flex: 1; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 14px; font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.2s; }
    .tac-input:focus { border-color: #3BE2B0; }
    .tac-send { padding: 12px 20px; background: linear-gradient(135deg, #3BE2B0, #4A90E2); color: white; border: none; border-radius: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
    .tac-send:hover { opacity: 0.9; }
    .tac-send:disabled { opacity: 0.4; cursor: not-allowed; }
    .tac-choices { display: flex; flex-wrap: wrap; gap: 8px; }
    .tac-choice { padding: 10px 16px; background: white; border: 2px solid #3BE2B0; color: #0A2540; border-radius: 12px; font-size: 14px; cursor: pointer; font-weight: 500; transition: all 0.15s; font-family: inherit; }
    .tac-choice:hover { background: #3BE2B0; color: white; }
    .tac-done { text-align: center; padding: 20px; color: #24B47E; font-weight: 600; }
    @keyframes tacFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes tacBounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
    .tac-messages::-webkit-scrollbar { width: 6px; }
    .tac-messages::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
  `;

  function injectCss() {
    if (document.getElementById('tac-styles')) return;
    const s = document.createElement('style');
    s.id = 'tac-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function createUI(opts) {
    const wrap = document.createElement('div');
    wrap.className = 'tac-wrap';
    wrap.innerHTML = `
      <div class="tac-header">
        <div class="tac-avatar"><i class="fas fa-shield-alt"></i></div>
        <div class="tac-header-text">
          <h3>${opts.botName || 'Asistente Tu Aval'}</h3>
          <p>En línea</p>
        </div>
      </div>
      <div class="tac-progress"><div class="tac-progress-bar" style="width:0%"></div></div>
      <div class="tac-messages" id="tac-messages"></div>
      <div class="tac-input-zone" id="tac-input-zone"></div>
    `;
    return wrap;
  }

  function addBotMsg(messagesEl, text) {
    const m = document.createElement('div');
    m.className = 'tac-msg tac-msg-bot';
    m.innerHTML = `<div class="tac-bubble">${text}</div>`;
    messagesEl.appendChild(m);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addUserMsg(messagesEl, text) {
    const m = document.createElement('div');
    m.className = 'tac-msg tac-msg-user';
    m.innerHTML = `<div class="tac-bubble">${escapeHtml(text)}</div>`;
    messagesEl.appendChild(m);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping(messagesEl) {
    const m = document.createElement('div');
    m.className = 'tac-msg tac-msg-bot';
    m.id = 'tac-typing-now';
    m.innerHTML = `<div class="tac-bubble tac-typing"><span></span><span></span><span></span></div>`;
    messagesEl.appendChild(m);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    const t = document.getElementById('tac-typing-now');
    if (t) t.remove();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function init(opts) {
    injectCss();
    const root = document.querySelector(opts.mountSelector);
    if (!root) throw new Error('TuAvalChat: mount no encontrado: ' + opts.mountSelector);
    const ui = createUI(opts);
    root.appendChild(ui);

    const messagesEl = ui.querySelector('#tac-messages');
    const inputZone = ui.querySelector('#tac-input-zone');
    const progressBar = ui.querySelector('.tac-progress-bar');

    const data = JSON.parse(localStorage.getItem(opts.storageKey + '_data') || '{}');
    const script = opts.script;
    let stepIndex = 0;

    function findStepIndex(id) {
      return script.findIndex(s => s.id === id);
    }

    function updateProgress() {
      const pct = Math.min(100, (stepIndex / script.length) * 100);
      progressBar.style.width = pct + '%';
    }

    function persist() {
      localStorage.setItem(opts.storageKey + '_data', JSON.stringify(data));
    }

    async function runStep() {
      if (stepIndex >= script.length) return finish();
      const step = script[stepIndex];

      // Bot speaks
      if (step.bot) {
        showTyping(messagesEl);
        await sleep(TYPING_DELAY);
        hideTyping();
        const text = typeof step.bot === 'function' ? step.bot(data) : step.bot;
        addBotMsg(messagesEl, text);
        await sleep(BOT_DELAY);
      }

      // Step with no input → just advance
      if (!step.input) {
        if (step.delay) await sleep(step.delay);
        stepIndex++;
        updateProgress();
        return runStep();
      }

      // Render input zone for user
      renderInput(step);
    }

    function renderInput(step) {
      inputZone.innerHTML = '';
      if (step.input === 'choice') {
        const wrap = document.createElement('div');
        wrap.className = 'tac-choices';
        step.choices.forEach(choice => {
          const label = typeof choice === 'string' ? choice : choice.label;
          const value = typeof choice === 'string' ? choice : choice.value;
          const b = document.createElement('button');
          b.className = 'tac-choice';
          b.textContent = label;
          b.onclick = () => handleAnswer(step, value, label);
          wrap.appendChild(b);
        });
        inputZone.appendChild(wrap);
        return;
      }

      // Text / number / email
      const row = document.createElement('div');
      row.className = 'tac-input-row';
      const input = document.createElement('input');
      input.className = 'tac-input';
      input.type = step.input === 'number' ? 'number' : step.input === 'email' ? 'email' : 'text';
      input.placeholder = step.placeholder || 'Escribe aquí...';
      if (step.input === 'number') {
        if (step.min != null) input.min = step.min;
        if (step.max != null) input.max = step.max;
      }
      const btn = document.createElement('button');
      btn.className = 'tac-send';
      btn.textContent = 'Enviar';
      btn.onclick = submit;
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') submit();
      });
      function submit() {
        const v = input.value.trim();
        if (!v) return;
        handleAnswer(step, v, v);
      }
      row.appendChild(input);
      row.appendChild(btn);
      inputZone.appendChild(row);
      setTimeout(() => input.focus(), 100);
    }

    function handleAnswer(step, value, displayLabel) {
      addUserMsg(messagesEl, displayLabel);
      data[step.id] = value;
      persist();
      inputZone.innerHTML = '';

      // Optional jump
      if (typeof step.next === 'function') {
        const nextId = step.next(value, data);
        if (nextId) {
          const idx = findStepIndex(nextId);
          if (idx >= 0) {
            stepIndex = idx;
            updateProgress();
            return runStep();
          }
        }
      }

      stepIndex++;
      updateProgress();
      runStep();
    }

    function finish() {
      inputZone.innerHTML = '<div class="tac-done"><i class="fas fa-check-circle"></i> Conversación completada</div>';
      progressBar.style.width = '100%';
      if (typeof opts.onComplete === 'function') opts.onComplete(data);
    }

    runStep();
  }

  window.TuAvalChat = { init };
})();
