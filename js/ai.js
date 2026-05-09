/**
 * AI Writing Assistant module
 * Integrates Puter.js AI into the document editor.
 * Loaded as an ES module — Puter.js is available globally via CDN script.
 */
import { editor } from './editor.js';

let dom = {};
let puterReady = false;
let puterLoading = null;

function loadPuter() {
  if (puterReady) return Promise.resolve();
  if (puterLoading) return puterLoading;
  if (typeof puter !== 'undefined') { puterReady = true; return Promise.resolve(); }

  puterLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.puter.com/v2/';
    script.onload = () => { puterReady = true; resolve(); };
    script.onerror = () => { puterLoading = null; reject(new Error('Failed to load Puter.js')); };
    document.head.appendChild(script);
  });
  return puterLoading;
}

function cacheDom() {
  dom = {
    aiBtn:       document.getElementById('aiBtn'),
    aiModal:     document.getElementById('aiModal'),
    closeAiBtn:  document.getElementById('closeAiModal'),
    aiPrompt:    document.getElementById('aiPrompt'),
    aiExpandBtn: document.getElementById('aiExpandBtn'),
    aiResult:    document.getElementById('aiResult'),
    aiOutput:    document.getElementById('aiOutput'),
    aiInsertBtn: document.getElementById('aiInsertBtn'),
  };
}

function openModal() {
  cacheDom();
  dom.aiModal.classList.remove('hidden');
  dom.aiResult.classList.add('hidden');
  dom.aiOutput.textContent = '';
  dom.aiPrompt.value = '';
  dom.aiPrompt.focus();
}

function closeModal() {
  cacheDom();
  dom.aiModal.classList.add('hidden');
}

async function handleGenerate() {
  cacheDom();
  const prompt = dom.aiPrompt.value.trim();
  if (!prompt) return;

  dom.aiOutput.textContent = '';
  dom.aiResult.classList.remove('hidden');
  dom.aiExpandBtn.disabled = true;
  dom.aiExpandBtn.textContent = 'Generating…';

  try {
    await loadPuter();

    if (typeof puter === 'undefined' || !puter.ai) {
      throw new Error('Puter.js is not available. Check your internet connection.');
    }

    const systemPrompt = `Continue the following text naturally. Keep the same tone and style. Only output the continuation, don't repeat what's already written:\n\n${prompt}`;

    const response = await puter.ai.chat(systemPrompt, {
      model: 'gpt-5-nano',
      stream: true,
      temperature: 0.7,
      testMode: true,
    });

    let fullText = '';

    for await (const chunk of response) {
      if (chunk.text) {
        fullText += chunk.text;
        dom.aiOutput.textContent = fullText;
      }
    }

    // Store generated text for insert
    dom.aiOutput.dataset.generated = fullText;
  } catch (err) {
    console.error('AI generation error:', err);
    dom.aiOutput.textContent = `Error: ${err.message || 'Something went wrong. Please try again.'}`;
  } finally {
    dom.aiExpandBtn.disabled = false;
    dom.aiExpandBtn.textContent = 'Generate ✨';
  }
}

function handleInsert() {
  cacheDom();
  const text = dom.aiOutput.dataset.generated || dom.aiOutput.textContent;
  if (!text || text.startsWith('Error:')) return;

  if (editor && editor.isActive) {
    editor.chain().focus().insertContent(text).run();
  } else {
    // Fallback: insert at the end via DOM (rare edge case)
    const editorEl = document.querySelector('.ProseMirror');
    if (editorEl) {
      editorEl.focus();
      // Attempt a basic content insertion if TipTap isn't fully initialised
      const selection = window.getSelection();
      if (selection.rangeCount) {
        selection.deleteFromDocument();
        selection.getRangeAt(0).insertNode(document.createTextNode(text));
      }
    }
  }

  closeModal();
}

let aiInitialized = false;

export function setupAI() {
  if (aiInitialized) return;
  aiInitialized = true;

  cacheDom();

  if (!dom.aiBtn) {
    console.warn('ai.js: AI button not found in DOM — skipping setup.');
    return;
  }

  dom.aiBtn.addEventListener('click', openModal);

  dom.closeAiBtn.addEventListener('click', closeModal);

  dom.aiModal.addEventListener('click', (e) => {
    if (e.target === dom.aiModal) closeModal();
  });

  dom.aiExpandBtn.addEventListener('click', handleGenerate);

  dom.aiInsertBtn.addEventListener('click', handleInsert);

  dom.aiPrompt.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleGenerate();
    }
  });
}
