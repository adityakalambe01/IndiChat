import React from 'react';
import { Users, Lock } from 'lucide-react';

interface CommunitiesEmptyStateProps {
  onStartCommunity: () => void;
}

export const CommunitiesEmptyState: React.FC<CommunitiesEmptyStateProps> = ({
  onStartCommunity,
}) => {
  return (
    <div className="wa-empty-container">
      {/* Communities Icon */}
      <div className="wa-channels-empty-icon">
        <Users size={56} color="#8696a0" />
      </div>

      <h1 className="wa-empty-title">Create communities</h1>
      <p className="wa-empty-desc">
        Bring members together in topic-based groups and easily send them admin announcements.
      </p>

      <button
        className="wa-calls-btn-green"
        onClick={onStartCommunity}
        id="btn-start-community-main"
        style={{ marginTop: '16px' }}
      >
        <Users size={18} />
        <span>Start your community</span>
      </button>

      {/* Encryption Footer */}
      <div className="wa-empty-encryption-footer">
        <Lock size={12} className="wa-lock-icon" />
        <span>Your personal messages in communities are end-to-end encrypted</span>
      </div>
    </div>
  );
};
