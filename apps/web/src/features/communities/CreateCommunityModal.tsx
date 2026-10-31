import React, { useState } from 'react';
import { X, Users } from 'lucide-react';
import { CommunityItem } from '../../data/communityData';

interface CreateCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommunityCreated: (community: CommunityItem) => void;
}

export const CreateCommunityModal: React.FC<CreateCommunityModalProps> = ({
  isOpen,
  onClose,
  onCommunityCreated,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newComm: CommunityItem = {
      id: `comm-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      avatarBg: '#059669',
      memberCount: 1,
      groups: [
        {
          id: `cg-ann-${Date.now()}`,
          name: '📢 Announcements',
          description: 'Official announcements from community admins.',
          memberCount: 1,
          lastActive: 'Just now',
          isAnnouncement: true,
        },
        {
          id: `cg-gen-${Date.now()}`,
          name: '💬 General Discussion',
          description: 'Topic-based community discussions.',
          memberCount: 1,
          lastActive: 'Just now',
        },
      ],
    };

    onCommunityCreated(newComm);
    onClose();
    alert(`Community "${name.trim()}" created successfully!`);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="wa-create-community-card" onClick={(e) => e.stopPropagation()}>
        <div className="wa-modal-header">
          <h2 className="wa-modal-title">New Community</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="wa-create-community-form">
          <div className="wa-community-icon-preview">
            <Users size={44} color="var(--accent-primary)" />
          </div>

          <div className="input-group">
            <label className="input-label">Community name</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Science College Hub"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="input-group" style={{ marginTop: '12px' }}>
            <label className="input-label">Community description</label>
            <textarea
              className="input-field"
              placeholder="What is this community for? Helpful guidelines for your members."
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
              Create Community
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
