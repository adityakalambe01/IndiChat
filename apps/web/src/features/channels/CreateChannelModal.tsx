import React, { useState } from 'react';
import { X, Radio } from 'lucide-react';
import { ChannelItem } from '../../data/channelData';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChannelCreated: (channel: ChannelItem) => void;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  onClose,
  onChannelCreated,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newChannel: ChannelItem = {
      id: `channel-${Date.now()}`,
      name: name.trim(),
      avatarLetter: name.trim().charAt(0).toUpperCase(),
      avatarBg: '#059669',
      followers: '1 follower',
      timeStr: 'Just now',
      lastUpdateSnippet: description.trim() || 'Channel created',
      isFollowed: true,
      description: description.trim(),
      posts: [
        {
          id: `post-${Date.now()}`,
          content: `Welcome to ${name.trim()}! 🎉 Official announcements and updates will be posted here.`,
          timestamp: 'Just now',
          reactions: [{ emoji: '🎉', count: 1 }],
          views: '1',
        },
      ],
    };

    onChannelCreated(newChannel);
    onClose();
    alert(`Channel "${name.trim()}" created successfully!`);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="wa-create-channel-card" onClick={(e) => e.stopPropagation()}>
        <div className="wa-modal-header">
          <h2 className="wa-modal-title">Create a Channel</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="wa-create-channel-form">
          <div className="wa-channel-icon-preview">
            <Radio size={42} color="var(--accent-primary)" />
          </div>

          <div className="input-group">
            <label className="input-label">Channel name</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Tech News & Updates"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="input-group" style={{ marginTop: '12px' }}>
            <label className="input-label">Describe your channel</label>
            <textarea
              className="input-field"
              placeholder="Include a description to help people understand what your channel is about."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="wa-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!name.trim()}>
              Create Channel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
