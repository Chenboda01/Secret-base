import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';

export let editor = null;

let toolbarWired = false;

export function initEditor(element, callbacks) {
  if (editor) {
    editor.destroy();
  }

  editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      TextStyleKit.configure({
        color: false,
        backgroundColor: false,
        lineHeight: false,
      }),
    ],
    onUpdate: () => {
      if (callbacks && callbacks.onUpdate) {
        callbacks.onUpdate();
      }
    },
    onSelectionUpdate: () => {
      if (callbacks && callbacks.onSelectionUpdate) {
        callbacks.onSelectionUpdate();
      }
    },
  });

  wireToolbar();
}

export function destroyEditor() {
  if (editor) {
    editor.destroy();
    editor = null;
  }
}

export function getJSON() {
  return editor ? editor.getJSON() : null;
}

export function setContent(content) {
  if (editor) {
    editor.commands.setContent(content);
  }
}

export function clearEditor() {
  if (editor) {
    editor.commands.clearContent();
  }
}

function wireToolbar() {
  if (toolbarWired) return;
  toolbarWired = true;

  document.querySelectorAll('[data-cmd]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      if (!editor) return;

      const chain = editor.chain().focus();

      switch (cmd) {
        case 'undo':
          chain.undo().run();
          break;
        case 'redo':
          chain.redo().run();
          break;
        case 'bold':
          chain.toggleBold().run();
          break;
        case 'italic':
          chain.toggleItalic().run();
          break;
        case 'underline':
          chain.toggleUnderline().run();
          break;
        case 'strike':
          chain.toggleStrike().run();
          break;
        case 'code':
          chain.toggleCode().run();
          break;
        case 'bulletList':
          chain.toggleBulletList().run();
          break;
        case 'orderedList':
          chain.toggleOrderedList().run();
          break;
        case 'blockquote':
          chain.toggleBlockquote().run();
          break;
      }
    });
  });

  const headingSelect = document.getElementById('headingSelect');
  if (headingSelect) {
    headingSelect.addEventListener('change', () => {
      if (!editor) return;
      const val = headingSelect.value;
      if (val === 'paragraph') {
        editor.chain().focus().setParagraph().run();
      } else {
        const level = parseInt(val.replace('h', ''), 10);
        editor.chain().focus().toggleHeading({ level }).run();
      }
    });
  }

  const fontFamilySelect = document.getElementById('fontFamilySelect');
  if (fontFamilySelect) {
    fontFamilySelect.addEventListener('change', () => {
      if (!editor) return;
      const val = fontFamilySelect.value;
      if (!val) {
        editor.chain().focus().unsetFontFamily().run();
      } else {
        editor.chain().focus().setFontFamily(val).run();
      }
    });
  }

  const fontSizeSelect = document.getElementById('fontSizeSelect');
  if (fontSizeSelect) {
    fontSizeSelect.addEventListener('change', () => {
      if (!editor) return;
      const val = fontSizeSelect.value;
      if (!val) {
        editor.chain().focus().unsetFontSize().run();
      } else {
        editor.chain().focus().setFontSize(val).run();
      }
    });
  }
}
