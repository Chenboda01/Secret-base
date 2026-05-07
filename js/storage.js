const STORAGE_PREFIX = 'secret_base_';
const DOCS_INDEX_KEY = STORAGE_PREFIX + 'docs_index';
const CURRENT_DOC_KEY = STORAGE_PREFIX + 'current_doc';

export const storage = {
  generateId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  getIndex() {
    try {
      const raw = localStorage.getItem(DOCS_INDEX_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  saveIndex(index) {
    localStorage.setItem(DOCS_INDEX_KEY, JSON.stringify(index));
  },

  listDocs() {
    const index = this.getIndex();
    return index.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  createDoc(title, content = null) {
    const id = this.generateId();
    const doc = {
      id,
      title: title || 'Untitled Document',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPublic: false,
    };
    const index = this.getIndex();
    index.push({ id: doc.id, title: doc.title, updatedAt: doc.updatedAt, isPublic: false });
    this.saveIndex(index);
    if (content) {
      this.saveContent(id, content);
    }
    return doc;
  },

  getDoc(id) {
    const index = this.getIndex();
    const entry = index.find(d => d.id === id);
    if (!entry) return null;
    return { ...entry };
  },

  saveDoc(id, updates) {
    const index = this.getIndex();
    const entry = index.find(d => d.id === id);
    if (!entry) return;
    Object.assign(entry, updates, { updatedAt: Date.now() });
    this.saveIndex(index);
  },

  deleteDoc(id) {
    let index = this.getIndex();
    index = index.filter(d => d.id !== id);
    this.saveIndex(index);
    localStorage.removeItem(STORAGE_PREFIX + 'content_' + id);
  },

  saveContent(id, content) {
    try {
      localStorage.setItem(STORAGE_PREFIX + 'content_' + id, JSON.stringify(content));
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.warn('Storage quota exceeded. Content not saved.');
      }
    }
  },

  loadContent(id) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + 'content_' + id);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setCurrentDocId(id) {
    if (id) {
      localStorage.setItem(CURRENT_DOC_KEY, id);
    } else {
      localStorage.removeItem(CURRENT_DOC_KEY);
    }
  },

  getCurrentDocId() {
    return localStorage.getItem(CURRENT_DOC_KEY);
  },
};
