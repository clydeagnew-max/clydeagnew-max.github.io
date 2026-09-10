(() => {
  const root = document.documentElement;
  const themeButton = document.querySelector('[data-theme-toggle]');
  const mobileButton = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('[data-nav]');
  const form = document.querySelector('#ai-form');
  const output = document.querySelector('#ai-output');
  const status = document.querySelector('#ai-status');
  const modeSelect = document.querySelector('#mode');
  const levelSelect = document.querySelector('#level');
  const topicInput = document.querySelector('#topic');
  const contextInput = document.querySelector('#context');
  const responseInput = document.querySelector('#response');
  const responseField = document.querySelector('[data-response-field]');
  const submitButton = document.querySelector('#generate-button');
  const copyButton = document.querySelector('#copy-output');
  const modeCards = Array.from(document.querySelectorAll('[data-mode-card]'));

  const storedTheme = localStorage.getItem('knight-theme');
  if (storedTheme) root.dataset.theme = storedTheme;

  function refreshThemeIcon() {
    if (!themeButton) return;
    const dark = root.dataset.theme !== 'light';
    themeButton.textContent = dark ? '☀' : '☾';
    themeButton.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  }
  refreshThemeIcon();

  themeButton?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('knight-theme', root.dataset.theme);
    refreshThemeIcon();
  });

  mobileButton?.addEventListener('click', () => {
    if (!nav) return;
    const open = nav.classList.toggle('open');
    mobileButton.setAttribute('aria-expanded', String(open));
  });

  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('open');
    mobileButton?.setAttribute('aria-expanded', 'false');
  }));

  const modeCopy = {
    ielts: { topic: 'e.g. technology, work-life balance, public transport', context: 'Optional: speaking part, writing task, target band, or focus area', needsResponse: false },
    speaking: { topic: 'e.g. job interview, presentation, explaining an opinion', context: 'Tell the coach what the situation is and what you want to sound like', needsResponse: true },
    workplace: { topic: 'e.g. disagreeing politely with a manager', context: 'Describe the workplace situation, relationship, and outcome you need', needsResponse: true },
    lesson: { topic: 'e.g. travel vocabulary, past simple, IELTS speaking', context: 'Age, lesson length, interests, materials available, or learning goal', needsResponse: false }
  };

  function setMode(mode) {
    if (!modeCopy[mode] || !modeSelect || !topicInput || !contextInput || !responseField || !responseInput) return;
    modeSelect.value = mode;
    topicInput.placeholder = modeCopy[mode].topic;
    contextInput.placeholder = modeCopy[mode].context;
    responseField.hidden = !modeCopy[mode].needsResponse;
    responseInput.required = modeCopy[mode].needsResponse;
    responseInput.disabled = !modeCopy[mode].needsResponse;
    modeCards.forEach(card => card.classList.toggle('active', card.dataset.modeCard === mode));
  }

  modeCards.forEach(card => card.addEventListener('click', () => {
    setMode(card.dataset.modeCard);
    document.querySelector('#studio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  modeSelect?.addEventListener('change', () => setMode(modeSelect.value));

  const params = new URLSearchParams(location.search);
  setMode(params.get('lab') || 'ielts');

  function getApiUrl() {
    const configured = window.KNIGHT_SCHOOL?.apiUrl?.trim();
    if (configured) return configured;
    if (location.hostname.endsWith('vercel.app') || location.hostname === 'localhost' || location.hostname === '127.0.0.1') return '/api/coach';
    return '';
  }

  function localDemo(payload) {
    const topic = payload.topic || 'your topic';
    const level = payload.level;
    if (payload.mode === 'ielts') return `DEMO MODE — AI connection pending

IELTS mission for ${level}: ${topic}

PART 1
• What role does ${topic} play in your daily life?
• Has your opinion about ${topic} changed over time?
• Is ${topic} important where you live?

PART 2
Describe an experience connected with ${topic}. Explain what happened, who was involved, why it mattered, and what you learned.

PART 3
• How has ${topic} changed in recent years?
• Who benefits most from developments in ${topic}?
• What problems may arise in the future?

Coach note: answer once for fluency, then repeat for structure and precision.`;
    if (payload.mode === 'speaking') return `DEMO MODE — AI connection pending

Speaking practice: ${topic}

1. State your main point clearly.
2. Add one specific example.
3. Explain why it matters.
4. Finish with a concise takeaway.

Your draft:
${payload.response || '(add your response)'}`;
    if (payload.mode === 'workplace') return `DEMO MODE — AI connection pending

Workplace mission: ${topic}

• Acknowledge the other person's point.
• State your concern neutrally.
• Give one concrete reason or example.
• Suggest a practical next step.
• Keep the relationship collaborative.`;
    return `DEMO MODE — AI connection pending

Lesson mission: ${topic} (${level})

Warm-up → clear target → model → guided practice → real communication → short game → exit task → next-step feedback.`;
  }

  // Only create allowlisted elements; model/user text is never parsed as HTML.
  function appendInline(parent, text) {
    const tokens = /(\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_|`([^`\n]+)`)/g;
    let offset = 0;
    for (const match of text.matchAll(tokens)) {
      parent.append(document.createTextNode(text.slice(offset, match.index)));
      const element = document.createElement(match[2] || match[3] ? 'strong' : match[6] ? 'code' : 'em');
      element.textContent = match[2] || match[3] || match[4] || match[5] || match[6];
      parent.append(element);
      offset = match.index + match[0].length;
    }
    parent.append(document.createTextNode(text.slice(offset)));
  }

  let outputSource = output?.textContent || '';
  function renderOutput(text) {
    outputSource = typeof text === 'string' ? text : 'No response was returned.';
    const fragment = document.createDocumentFragment();
    let paragraph = null;
    let list = null;
    for (const line of outputSource.replace(/\r\n?/g, '\n').split('\n')) {
      if (!line.trim()) { paragraph = null; list = null; continue; }
      const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/);
      const item = line.match(/^\s*(?:([-+*•])|([0-9]+)[.)])\s+(.+)$/);
      if (heading) {
        paragraph = null; list = null;
        const element = document.createElement('h' + Math.min(6, heading[1].length + 2));
        appendInline(element, heading[2]);
        fragment.append(element);
      } else if (item) {
        paragraph = null;
        const tag = item[2] ? 'OL' : 'UL';
        if (!list || list.tagName !== tag) {
          list = document.createElement(tag.toLowerCase());
          if (item[2]) list.start = Number(item[2]);
          fragment.append(list);
        }
        const element = document.createElement('li');
        appendInline(element, item[3]);
        list.append(element);
      } else {
        list = null;
        if (!paragraph) { paragraph = document.createElement('p'); fragment.append(paragraph); }
        else paragraph.append(document.createTextNode('\n'));
        appendInline(paragraph, line);
      }
    }
    output.replaceChildren(fragment);
  }

  async function copyOutput() {
    const text = outputSource.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const original = copyButton.textContent;
      copyButton.textContent = 'Copied ✓';
      setTimeout(() => copyButton.textContent = original, 1500);
    } catch {
      status.textContent = 'Copy failed. Select the response and copy it manually.';
    }
  }
  copyButton?.addEventListener('click', copyOutput);

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!output || !status || !submitButton) return;

    const payload = {
      mode: modeSelect.value,
      level: levelSelect.value,
      topic: topicInput.value.trim(),
      context: contextInput.value.trim(),
      response: responseInput.disabled ? '' : responseInput.value.trim()
    };

    status.textContent = 'Building your Knight School response…';
    renderOutput('');
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    submitButton.textContent = 'Thinking…';

    const apiUrl = getApiUrl();

    try {
      if (!apiUrl) {
        renderOutput(localDemo(payload));
        status.textContent = 'Demo mode is active on this domain.';
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      let res;
      try {
        res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The AI coach could not complete this request.');

      renderOutput(data.text || 'No response was returned.');
      status.textContent = `AI response ready · ${data.model || 'Knight School AI'}`;
    } catch (error) {
      renderOutput(localDemo(payload));
      status.textContent = error.name === 'AbortError'
        ? 'The AI request took too long. A local practice version is shown instead.'
        : `AI connection unavailable: ${error.message} A local practice version is shown instead.`;
    } finally {
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
      submitButton.textContent = 'Generate with AI';
    }
  });
})();