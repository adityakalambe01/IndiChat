import React, { useState } from 'react';
import { X, Send, Palette, Image as ImageIcon } from 'lucide-react';
import { UserStatus } from '../../data/statusData';

interface CreateStatusModalProps {
  isOpen: boolean;
  initialType?: 'text' | 'image';
  onClose: () => void;
  onStatusCreated: (newStatus: UserStatus) => void;
}

const BG_COLORS = [
  '#065f46', // Emerald
  '#1e3a8a', // Blue
  '#7c3aed', // Violet
  '#991b1b', // Red
  '#92400e', // Amber
  '#1e293b', // Slate
  '#831843', // Rose
];

export const CreateStatusModal: React.FC<CreateStatusModalProps> = ({
  isOpen,
  initialType = 'text',
  onClose,
  onStatusCreated,
}) => {
  if (!isOpen) return null;

  const [mode, setMode] = useState<'text' | 'image'>(initialType);
  const [textContent, setTextContent] = useState('');
  const [selectedBg, setSelectedBg] = useState(BG_COLORS[0]);
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'text' && !textContent.trim()) return;
    if (mode === 'image' && !imageUrl.trim()) return;

    const newStatus: UserStatus = {
      id: `my-status-${Date.now()}`,
      userId: 'me',
      userName: 'My status',
      timeAgo: 'Just now',
      updatedAt: new Date().toISOString(),
      hasUnread: false,
      stories: [
        mode === 'text'
          ? {
              id: `story-${Date.now()}`,
              type: 'text',
              content: textContent.trim(),
              bgColor: selectedBg,
              timestamp: 'Just now',
            }
          : {
              id: `story-${Date.now()}`,
              type: 'image',
              content: imageUrl.trim(),
              caption: caption.trim() || undefined,
              timestamp: 'Just now',
            },
      ],
    };

    onStatusCreated(newStatus);
    onClose();
    alert('Status update posted successfully!');
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="wa-create-status-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="wa-modal-header">
          <h2 className="wa-modal-title">New Status Update</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="wa-create-status-tabs">
          <button
            className={`wa-status-tab-btn ${mode === 'text' ? 'active' : ''}`}
            onClick={() => setMode('text')}
          >
            <Palette size={16} />
            <span>Text Status</span>
          </button>

          <button
            className={`wa-status-tab-btn ${mode === 'image' ? 'active' : ''}`}
            onClick={() => setMode('image')}
          >
            <ImageIcon size={16} />
            <span>Photo / Media</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="wa-create-status-form">
          {mode === 'text' ? (
            <>
              {/* Text Preview Box */}
              <div
                className="wa-status-text-preview"
                style={{ backgroundColor: selectedBg }}
              >
                <textarea
                  className="wa-status-text-textarea"
                  placeholder="Type a status update..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  maxLength={700}
                  autoFocus
                />
              </div>

              {/* Color Palette Selector */}
              <div className="wa-palette-row">
                {BG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`wa-palette-dot ${selectedBg === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setSelectedBg(color)}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Media Upload */}
              <div className="wa-status-media-upload">
                {imageUrl ? (
                  <div className="wa-status-media-preview">
                    <img src={imageUrl} alt="Status preview" />
                    <button
                      type="button"
                      className="wa-media-remove-btn"
                      onClick={() => setImageUrl('')}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="wa-media-dropzone">
                    <ImageIcon size={36} color="var(--accent-primary)" />
                    <span>Choose photo or video</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleImageFile}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>

              <input
                type="text"
                className="input-field"
                placeholder="Add a caption..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                style={{ marginTop: '12px' }}
              />
            </>
          )}

          <div className="wa-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={mode === 'text' ? !textContent.trim() : !imageUrl.trim()}
            >
              <Send size={16} style={{ marginRight: '6px' }} />
              Post Status
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
