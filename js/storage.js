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

const KV_TIMEOUT = 4000;

async function cloudGet(key) {
  if (typeof puter !== 'undefined' && puter.kv) {
    try {
      const result = await Promise.race([
        puter.kv.get(key),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), KV_TIMEOUT)),
      ]);
      return result;
    } catch (e) {
      console.warn('Puter KV read failed, falling back to localStorage:', e.message);
    }
  }
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

async function cloudSet(key, value) {
  if (typeof puter !== 'undefined' && puter.kv) {
    try {
      await Promise.race([
        puter.kv.set(key, value),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), KV_TIMEOUT)),
      ]);
    } catch (e) {
      console.warn('Puter KV write failed, falling back to localStorage:', e.message);
    }
  }
  localStorage.setItem(key, JSON.stringify(value));
}

async function cloudDelete(key) {
  if (typeof puter !== 'undefined' && puter.kv) {
    try {
      await Promise.race([
        puter.kv.delete(key),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), KV_TIMEOUT)),
      ]);
    } catch (e) {
      console.warn('Puter KV delete failed, falling back to localStorage:', e.message);
    }
  }
  localStorage.removeItem(key);
}

async function init() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    cache.index = (await cloudGet(DOCS_INDEX_KEY)) || [];
    cache.currentDocId = (await cloudGet(CURRENT_DOC_KEY)) || null;

    const contentPromises = cache.index.map(doc =>
      cloudGet(PREFIX + 'content_' + doc.id).then(content => {
        if (content) cache.contents[doc.id] = content;
      })
    );
    await Promise.allSettled(contentPromises);

    ready = true;
  })();

  return initPromise;
}

async function persistIndex() {
  await cloudSet(DOCS_INDEX_KEY, cache.index);
}

async function persistContent(docId) {
  if (docId in cache.contents) {
    await cloudSet(PREFIX + 'content_' + docId, cache.contents[docId]);
  }
}

async function persistCurrentDoc() {
  if (cache.currentDocId) {
    await cloudSet(CURRENT_DOC_KEY, cache.currentDocId);
  } else {
    await cloudDelete(CURRENT_DOC_KEY);
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
    await cloudDelete(PREFIX + 'content_' + id);
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
