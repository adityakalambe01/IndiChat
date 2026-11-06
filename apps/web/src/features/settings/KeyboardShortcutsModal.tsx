import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Ctrl + Alt + /', desc: 'Search' },
    { key: 'Ctrl + Alt + N', desc: 'New chat' },
    { key: 'Ctrl + Alt + Shift + [', desc: 'Previous chat' },
    { key: 'Ctrl + Alt + Shift + ]', desc: 'Next chat' },
    { key: 'Ctrl + Alt + E', desc: 'Archive chat' },
    { key: 'Ctrl + Alt + Shift + M', desc: 'Mute chat' },
    { key: 'Ctrl + Alt + Shift + U', desc: 'Mark as unread' },
    { key: 'Ctrl + Alt + Backspace', desc: 'Delete chat' },
    { key: 'Escape', desc: 'Close chat / modal' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="wa-shortcuts-card" onClick={(e) => e.stopPropagation()}>
        <div className="wa-modal-header">
          <h2 className="wa-modal-title">Keyboard shortcuts</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="wa-shortcuts-grid">
          {shortcuts.map((s, idx) => (
            <div key={idx} className="wa-shortcut-row">
              <span className="wa-shortcut-desc">{s.desc}</span>
              <kbd className="wa-shortcut-kbd">{s.key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
