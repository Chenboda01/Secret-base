const PREFIX = 'secret_base:';
const DOCS_INDEX_KEY = PREFIX + 'docs_index';
const CURRENT_DOC_KEY = PREFIX + 'current_doc';

let cache = {
  index: [],
  contents: {},
  currentDocId: null,
};

let ready = false;
let initPromise = null;

const KV_TIMEOUT = 3000;

const PUTER_CONNECTED_KEY = PREFIX + 'puter_connected';

function isPuterConnected() {
  return localStorage.getItem(PUTER_CONNECTED_KEY) === '1';
}

async function cloudTry(fn) {
  if (!isPuterConnected()) return;
  if (typeof puter === 'undefined' || !puter.kv) return;
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), KV_TIMEOUT)),
    ]);
  } catch (e) {
    // silently ignore — localStorage is the primary store
    if (e.message !== 'timeout') console.debug('Puter KV:', e.message);
  }
}

async function init() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    cache.index = JSON.parse(localStorage.getItem(DOCS_INDEX_KEY)) || [];
    cache.currentDocId = localStorage.getItem(CURRENT_DOC_KEY) || null;

    cache.index.forEach(doc => {
      const raw = localStorage.getItem(PREFIX + 'content_' + doc.id);
      if (raw) {
        try { cache.contents[doc.id] = JSON.parse(raw); } catch {}
      }
    });

    ready = true;
  })();

  return initPromise;
}

async function persistIndex() {
  localStorage.setItem(DOCS_INDEX_KEY, JSON.stringify(cache.index));
  await cloudTry(() => puter.kv.set(DOCS_INDEX_KEY, cache.index));
}

async function persistContent(docId) {
  if (!(docId in cache.contents)) return;
  const key = PREFIX + 'content_' + docId;
  localStorage.setItem(key, JSON.stringify(cache.contents[docId]));
  await cloudTry(() => puter.kv.set(key, cache.contents[docId]));
}

async function persistCurrentDoc() {
  if (cache.currentDocId) {
    localStorage.setItem(CURRENT_DOC_KEY, cache.currentDocId);
    await cloudTry(() => puter.kv.set(CURRENT_DOC_KEY, cache.currentDocId));
  } else {
    localStorage.removeItem(CURRENT_DOC_KEY);
    await cloudTry(() => puter.kv.delete(CURRENT_DOC_KEY));
  }
}

function ensureReady() {
  if (!ready) throw new Error('Storage not initialized. Call storage.init() first.');
}

export const storage = {
  async init() {
    return init();
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
    ensureReady();
    return [...cache.index].sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async createDoc(title, content) {
    ensureReady();
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
      await persistContent(id);
    }

    await persistIndex();
    return doc;
  },

  getDoc(id) {
    ensureReady();
    const entry = cache.index.find(d => d.id === id);
    if (!entry) return null;
    return { ...entry };
  },

  async saveDoc(id, updates) {
    ensureReady();
    const entry = cache.index.find(d => d.id === id);
    if (!entry) return;
    Object.assign(entry, updates, { updatedAt: Date.now() });
    await persistIndex();
  },

  async deleteDoc(id) {
    ensureReady();
    cache.index = cache.index.filter(d => d.id !== id);
    delete cache.contents[id];
    await persistIndex();
    localStorage.removeItem(PREFIX + 'content_' + id);
    await cloudTry(() => puter.kv.delete(PREFIX + 'content_' + id));
  },

  async saveContent(id, content) {
    ensureReady();
    cache.contents[id] = content;
    await persistContent(id);
  },

  loadContent(id) {
    ensureReady();
    return cache.contents[id] ? cache.contents[id] : null;
  },

  async setCurrentDocId(id) {
    cache.currentDocId = id || null;
    await persistCurrentDoc();
  },

  getCurrentDocId() {
    return cache.currentDocId;
  },
};
