import React, { useRef, useEffect } from 'react';
import { FileText, Image as ImageIcon, Camera } from 'lucide-react';

interface AttachmentMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFiles: (files: File[]) => void;
  onOpenCamera: () => void;
}

export const AttachmentMenu: React.FC<AttachmentMenuProps> = ({
  isOpen,
  onClose,
  onSelectFiles,
  onOpenCamera
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // Close on click outside or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onSelectFiles(Array.from(e.target.files));
      onClose();
    }
    e.target.value = '';
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onSelectFiles(Array.from(e.target.files));
      onClose();
    }
    e.target.value = '';
  };

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={documentInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleDocumentChange}
        // No accept filter -> ANY file can be chosen!
      />

      <input
        ref={mediaInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={handleMediaChange}
      />

      {/* WhatsApp Web Attachment Flyout Menu */}
      <div ref={menuRef} className="whatsapp-attachment-menu" role="menu" aria-label="Attach options">
        {/* 1. Document (Any file) */}
        <button
          type="button"
          id="attachOptionDoc"
          className="attachment-menu-item"
          onClick={() => documentInputRef.current?.click()}
          title="Document (Send any file)"
        >
          <div className="attachment-icon-btn document">
            <FileText size={24} color="#ffffff" />
          </div>
          <span className="attachment-item-label">Document</span>
        </button>

        {/* 2. Photos & Videos */}
        <button
          type="button"
          id="attachOptionPhotos"
          className="attachment-menu-item"
          onClick={() => mediaInputRef.current?.click()}
          title="Photos & Videos"
        >
          <div className="attachment-icon-btn media">
            <ImageIcon size={24} color="#ffffff" />
          </div>
          <span className="attachment-item-label">Photos & videos</span>
        </button>

        {/* 3. Camera */}
        <button
          type="button"
          id="attachOptionCamera"
          className="attachment-menu-item"
          onClick={() => {
            onClose();
            onOpenCamera();
          }}
          title="Camera (Take photo)"
        >
          <div className="attachment-icon-btn camera">
            <Camera size={24} color="#ffffff" />
          </div>
          <span className="attachment-item-label">Camera</span>
        </button>

        {/* 4. Poll */}
        <button
          type="button"
          id="attachOptionPoll"
          className="attachment-menu-item"
          onClick={() => {
            onClose();
            const pollFile = new File([JSON.stringify({ question: 'Which design do you prefer?', options: ['Obsidian Dark', 'Daylight Light', 'Liquid Glass'] })], 'poll.json', { type: 'application/json' });
            onSelectFiles([pollFile]);
          }}
          title="Poll (Create poll)"
        >
          <div className="attachment-icon-btn poll" style={{ background: '#f59e0b' }}>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>📊</span>
          </div>
          <span className="attachment-item-label">Poll</span>
        </button>
      </div>
    </>
  );
};
