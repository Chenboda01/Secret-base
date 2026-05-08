import { storage } from './storage.js';
import { initEditor, destroyEditor, getJSON, setContent, clearEditor, editor } from './editor.js';
import { setupAI } from './ai.js';
import { setupPDF } from './pdf.js';
import { setupShare } from './share.js';

let currentDocId = null;
let pendingAutoSave = null;
let editorWired = false;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ── Router ─────────────────────────────── */

function getRoute() {
  const hash = location.hash.slice(1) || '/';
  const match = hash.match(/^\/doc\/([a-z]+)$/);
  if (match) return { route: 'doc', docId: match[1] };
  return { route: 'home', docId: null };
}

function navigateToDoc(docId) {
  location.hash = '#/doc/' + docId;
}

/* ── Document Management ──────────────── */

function getDefaultContent(title) {
  return {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title || 'Untitled Document' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Start writing...' }] },
    ],
  };
}

function openDocument(docId) {
  const doc = storage.getDoc(docId);
  if (!doc) {
    createNewDocument();
    return;
  }

  currentDocId = docId;
  storage.setCurrentDocId(docId);
  $('#docTitle').value = doc.title || '';
  updateWordCount();

  const content = storage.loadContent(docId);
  if (content) {
    setContent(content);
  } else {
    setContent(getDefaultContent(doc.title));
  }
  renderDocList();
  highlightDoc(docId);
}

function createNewDocument() {
  const title = 'Untitled Document';
  const doc = storage.createDoc(title);
  currentDocId = doc.id;
  storage.setCurrentDocId(doc.id);
  $('#docTitle').value = title;
  navigateToDoc(doc.id);
  // setContent handled by hashchange → openDocument
  renderDocList();
  highlightDoc(doc.id);
}

function saveCurrentDocument() {
  if (!currentDocId) return;
  const title = $('#docTitle').value.trim() || 'Untitled Document';
  const content = getJSON();
  if (!content) return;

  storage.saveDoc(currentDocId, { title });
  storage.saveContent(currentDocId, content);
  renderDocList();
  setStatus('Saved');
}

function saveCurrentDocumentNow() {
  if (pendingAutoSave) {
    clearTimeout(pendingAutoSave);
    pendingAutoSave = null;
  }
  saveCurrentDocument();
}

function scheduleAutoSave() {
  if (pendingAutoSave) clearTimeout(pendingAutoSave);
  pendingAutoSave = setTimeout(saveCurrentDocument, 1500);
}

function deleteDocument(docId) {
  if (!confirm('Delete this document? This cannot be undone.')) return;
  storage.deleteDoc(docId);
  if (currentDocId === docId) {
    currentDocId = null;
    storage.setCurrentDocId(null);
    const docs = storage.listDocs();
    if (docs.length > 0) {
      navigateToDoc(docs[0].id);
    } else {
      destroyEditor();
      showLanding();
    }
  } else {
    renderDocList();
  }
}

/* ── Sidebar ─────────────────────────────── */

function renderDocList() {
  const list = $('#docList');
  const docs = storage.listDocs();

  if (docs.length === 0) {
    list.innerHTML = '<p class="empty-state">No documents yet.<br />Create one to get started.</p>';
    return;
  }

  list.innerHTML = docs.map(d => {
    const name = d.title || 'Untitled';
    const isActive = d.id === currentDocId ? ' active' : '';
    return `
      <button class="doc-item${isActive}" data-id="${d.id}">
        <span class="doc-icon">📄</span>
        <span class="doc-name">${escHtml(name)}</span>
        <button class="doc-delete" data-id="${d.id}" title="Delete">✕</button>
      </button>
    `;
  }).join('');

  list.querySelectorAll('.doc-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('doc-delete')) return;
      const id = el.dataset.id;
      if (id !== currentDocId) {
        saveCurrentDocumentNow();
        navigateToDoc(id);
      }
    });
  });

  list.querySelectorAll('.doc-delete').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteDocument(el.dataset.id);
    });
  });
}

function highlightDoc(docId) {
  $$('.doc-item').forEach(el => el.classList.remove('active'));
  const active = document.querySelector(`.doc-item[data-id="${docId}"]`);
  if (active) active.classList.add('active');
}

/* ── Landing View ──────────────────────── */

function showLanding() {
  const area = $('#editorArea');
  area.innerHTML = `
    <div class="landing">
      <div class="landing-content">
        <div class="landing-icon">◈</div>
        <h2>Welcome to Secret Base</h2>
        <p>Create a new document to get started, or select one from the sidebar.</p>
        <button id="landingNewBtn" class="btn-primary">＋ New Document</button>
      </div>
    </div>
  `;
  $('#landingNewBtn').addEventListener('click', () => {
    createNewDocument();
  });
  $('#statusBar').style.display = 'none';
}

function showEditor() {
  const area = $('#editorArea');
  area.innerHTML = `
    <div id="toolbar" class="toolbar">
      <div class="toolbar-group">
        <button data-cmd="undo" class="toolbar-btn" title="Undo (Ctrl+Z)">↩</button>
        <button data-cmd="redo" class="toolbar-btn" title="Redo (Ctrl+Shift+Z)">↪</button>
      </div>
      <div class="toolbar-group">
        <button data-cmd="bold" class="toolbar-btn" title="Bold (Ctrl+B)"><strong>B</strong></button>
        <button data-cmd="italic" class="toolbar-btn" title="Italic (Ctrl+I)"><em>I</em></button>
        <button data-cmd="underline" class="toolbar-btn" title="Underline (Ctrl+U)"><u>U</u></button>
        <button data-cmd="strike" class="toolbar-btn" title="Strikethrough"><s>S</s></button>
        <button data-cmd="code" class="toolbar-btn" title="Code">⟨⟩</button>
      </div>
      <div class="toolbar-group">
        <select id="headingSelect" class="toolbar-select" title="Heading level">
          <option value="paragraph">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
      </div>
      <div class="toolbar-group">
        <select id="fontFamilySelect" class="toolbar-select" title="Font family">
          <option value="">Font</option>
          <option value="serif">Serif</option>
          <option value="sans-serif">Sans-serif</option>
          <option value="monospace">Monospace</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="'Courier New', monospace">Courier New</option>
        </select>
        <select id="fontSizeSelect" class="toolbar-select" title="Font size">
          <option value="">Size</option>
          <option value="12px">12</option>
          <option value="14px">14</option>
          <option value="16px">16</option>
          <option value="18px">18</option>
          <option value="20px">20</option>
          <option value="24px">24</option>
          <option value="28px">28</option>
          <option value="36px">36</option>
        </select>
      </div>
      <div class="toolbar-group">
        <button data-cmd="bulletList" class="toolbar-btn" title="Bullet list">• List</button>
        <button data-cmd="orderedList" class="toolbar-btn" title="Ordered list">1. List</button>
        <button data-cmd="blockquote" class="toolbar-btn" title="Blockquote">❝ Quote</button>
      </div>
    </div>
    <div id="editor"></div>
    <div id="statusBar">
      <span id="statusText">Ready</span>
      <span id="wordCount"></span>
    </div>
  `;
  $('#statusBar').style.display = '';
}

/* ── Status Bar ────────────────────────── */

function setStatus(msg) {
  const el = $('#statusText');
  if (!el) return;
  el.textContent = msg;
  el.style.color = 'var(--accent)';
  setTimeout(() => {
    if (el) { el.textContent = 'Ready'; el.style.color = ''; }
  }, 2000);
}

function updateWordCount() {
  const el = $('#wordCount');
  if (!el) return;
  const text = document.querySelector('.ProseMirror')?.textContent || '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  el.textContent = `${words} words · ${chars} characters`;
}

/* ── UI Utilities ─────────────────────── */

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ── Route Handler ─────────────────────── */

function handleRoute() {
  const route = getRoute();
  if (route.route === 'doc') {
    if (!editor) {
      showEditor();
      const editorEl = $('#editor');
      initEditor(editorEl, {
        onUpdate: () => { scheduleAutoSave(); updateWordCount(); },
        onSelectionUpdate: () => { updateToolbarState(); },
      });
      setupAI();
      setupPDF();
      setupShare();
    } else {
      destroyEditor();
      initEditor($('#editor'), {
        onUpdate: () => { scheduleAutoSave(); updateWordCount(); },
        onSelectionUpdate: () => { updateToolbarState(); },
      });
    }
    openDocument(route.docId);
  } else {
    saveCurrentDocumentNow();
    destroyEditor();
    currentDocId = null;
    storage.setCurrentDocId(null);
    showLanding();
    renderDocList();
  }
}

/* ── Boot ───────────────────────────────── */

function boot() {
  /* Event wiring */
  $('#newDocBtn').addEventListener('click', () => {
    saveCurrentDocumentNow();
    destroyEditor();
    createNewDocument();
  });

  $('#docTitle').addEventListener('change', () => {
    saveCurrentDocumentNow();
  });

  $('#docTitle').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.target.blur();
  });

  $('#menuToggle').addEventListener('click', () => {
    $('#sidebar').classList.toggle('collapsed');
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentDocumentNow();
    }
  });

  $$('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  });

  window.addEventListener('hashchange', () => {
    handleRoute();
  });

  /* Initial load */
  const route = getRoute();
  if (route.route === 'doc') {
    handleRoute();
  } else {
    const lastDocId = storage.getCurrentDocId();
    if (lastDocId && storage.getDoc(lastDocId)) {
      navigateToDoc(lastDocId);
    } else {
      showLanding();
    }
  }

  renderDocList();
  setStatus('Ready');
}

/* ── Toolbar State ────────────────────── */

function updateToolbarState() {
  if (!editor) return;

  const cmds = ['bold', 'italic', 'underline', 'strike', 'code', 'bulletList', 'orderedList', 'blockquote'];
  cmds.forEach(cmd => {
    const btn = document.querySelector(`[data-cmd="${cmd}"]`);
    if (!btn) return;
    const isActive = editor.isActive(cmd);
    btn.classList.toggle('is-active', isActive);
  });

  const headingSelect = $('#headingSelect');
  if (headingSelect) {
    if (editor.isActive('heading')) {
      const level = editor.getAttributes('heading').level;
      headingSelect.value = 'h' + level;
    } else {
      headingSelect.value = 'paragraph';
    }
  }

  const fontFamily = $('#fontFamilySelect');
  if (fontFamily) {
    if (editor.isActive('textStyle') && editor.getAttributes('textStyle').fontFamily) {
      fontFamily.value = editor.getAttributes('textStyle').fontFamily;
    } else {
      fontFamily.value = '';
    }
  }

  const fontSize = $('#fontSizeSelect');
  if (fontSize) {
    if (editor.isActive('textStyle') && editor.getAttributes('textStyle').fontSize) {
      fontSize.value = editor.getAttributes('textStyle').fontSize;
    } else {
      fontSize.value = '';
    }
  }
}

document.addEventListener('DOMContentLoaded', boot);
