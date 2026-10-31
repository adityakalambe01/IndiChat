import React from 'react';
import { Video, Link, Grid, Lock } from 'lucide-react';
import { WhatsAppLaptopCallingGraphic } from '../chats/ChatEmptyState';

interface CallsEmptyStateProps {
  onStartCall: () => void;
  onNewCallLink: () => void;
  onCallNumber: () => void;
}

export const CallsEmptyState: React.FC<CallsEmptyStateProps> = ({
  onStartCall,
  onNewCallLink,
  onCallNumber,
}) => {
  return (
    <div className="wa-empty-container">
      {/* Center Featured Card */}
      <div className="wa-empty-card">
        <WhatsAppLaptopCallingGraphic size={170} />

        <h1 className="wa-empty-card-title">Voice and video calling</h1>
        <p className="wa-empty-card-desc">
          Share your screen, react with emoji and more, with up to 32 people.
        </p>
      </div>

      {/* Action Buttons Row */}
      <div className="wa-calls-action-buttons">
        {/* Start Call Green Button */}
        <button
          className="wa-calls-btn-green"
          onClick={onStartCall}
          id="btn-start-call-main"
        >
          <Video size={18} />
          <span>Start call</span>
        </button>

        {/* New Call Link */}
        <button
          className="wa-calls-btn-dark"
          onClick={onNewCallLink}
          id="btn-new-call-link"
        >
          <Link size={18} />
          <span>New call link</span>
        </button>

        {/* Call a number */}
        <button
          className="wa-calls-btn-dark"
          onClick={onCallNumber}
          id="btn-call-number"
        >
          <Grid size={18} />
          <span>Call a number</span>
        </button>
      </div>

      {/* Encryption Footer */}
      <div className="wa-empty-encryption-footer">
        <Lock size={12} className="wa-lock-icon" />
        <span>Your personal calls are end-to-end encrypted</span>
      </div>
    </div>
  );
};
