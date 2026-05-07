import { storage } from './storage.js';

let initialized = false;

export function setupShare() {
  /* Guard against duplicate wiring (setupShare is called on every route change) */
  if (initialized) return;
  initialized = true;

  const shareBtn = document.getElementById('shareBtn');
  const shareModal = document.getElementById('shareModal');
  const closeBtn = document.getElementById('closeShareModal');
  const shareLinkInput = document.getElementById('shareLinkInput');
  const copyBtn = document.getElementById('copyLinkBtn');
  const publicToggle = document.getElementById('publicToggle');

  if (!shareBtn || !shareModal) return;

  shareBtn.addEventListener('click', () => {
    const docId = storage.getCurrentDocId();
    if (!docId) return;

    const doc = storage.getDoc(docId);
    if (!doc) return;

    const base = window.location.origin + window.location.pathname;
    const url = base + '#/doc/' + docId;
    shareLinkInput.value = url;

    publicToggle.checked = doc.isPublic || false;

    shareModal.classList.remove('hidden');
  });

  closeBtn.addEventListener('click', () => {
    shareModal.classList.add('hidden');
  });

  copyBtn.addEventListener('click', async () => {
    shareLinkInput.select();
    try {
      await navigator.clipboard.writeText(shareLinkInput.value);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
      }, 1500);
    } catch (err) {
      console.warn('Failed to copy link:', err);
    }
  });

  publicToggle.addEventListener('change', () => {
    const docId = storage.getCurrentDocId();
    if (!docId) return;
    storage.saveDoc(docId, { isPublic: publicToggle.checked });
  });
}
