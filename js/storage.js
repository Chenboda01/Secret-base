const PREFIX = 'secret_base:';
const DOCS_INDEX_KEY = PREFIX + 'docs_index';
const CURRENT_DOC_KEY = PREFIX + 'current_doc';

let cache = {
  index: [],
  contents: {},
  currentDocId: null,
};

function init() {
  cache.index = JSON.parse(localStorage.getItem(DOCS_INDEX_KEY)) || [];
  cache.currentDocId = localStorage.getItem(CURRENT_DOC_KEY) || null;
  cache.index.forEach(doc => {
    const raw = localStorage.getItem(PREFIX + 'content_' + doc.id);
    if (raw) {
      try { cache.contents[doc.id] = JSON.parse(raw); } catch {}
    }
  });
}

function persistAll() {
  localStorage.setItem(DOCS_INDEX_KEY, JSON.stringify(cache.index));
  if (cache.currentDocId) {
    localStorage.setItem(CURRENT_DOC_KEY, cache.currentDocId);
  } else {
    localStorage.removeItem(CURRENT_DOC_KEY);
  }
}

export const storage = {
  init() {
    init();
  },

  generateId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  listDocs() {
    return [...cache.index].sort((a, b) => b.updatedAt - a.updatedAt);
  },

  createDoc(title, content) {
    const id = this.generateId();
    const doc = {
      id,
      title: title || 'Untitled Document',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPublic: false,
    };
    cache.index.push({ ...doc });

    if (content) {
      cache.contents[id] = content;
      localStorage.setItem(PREFIX + 'content_' + id, JSON.stringify(content));
    }

    persistAll();
    return doc;
  },

  getDoc(id) {
    const entry = cache.index.find(d => d.id === id);
    if (!entry) return null;
    return { ...entry };
  },

  saveDoc(id, updates) {
    const entry = cache.index.find(d => d.id === id);
    if (!entry) return;
    Object.assign(entry, updates, { updatedAt: Date.now() });
    persistAll();
  },

  deleteDoc(id) {
    cache.index = cache.index.filter(d => d.id !== id);
    delete cache.contents[id];
    persistAll();
    localStorage.removeItem(PREFIX + 'content_' + id);
  },

  saveContent(id, content) {
    cache.contents[id] = content;
    localStorage.setItem(PREFIX + 'content_' + id, JSON.stringify(content));
  },

  loadContent(id) {
    return cache.contents[id] ? cache.contents[id] : null;
  },

  setCurrentDocId(id) {
    cache.currentDocId = id || null;
    persistAll();
  },

  getCurrentDocId() {
    return cache.currentDocId;
  },
};
