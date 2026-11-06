import React from 'react';
import { Edit3, Camera, Lock } from 'lucide-react';

interface StatusEmptyStateProps {
  onTextStatus: () => void;
  onPhotoVideoStatus: () => void;
}

/**
 * Status Stories broken circle graphic matching WhatsApp Web
 */
export const WhatsAppStatusGraphic: React.FC<{ size?: number }> = ({ size = 100 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', margin: '0 auto 24px auto' }}
    >
      {/* Outer broken arc 1 */}
      <circle
        cx="50"
        cy="50"
        r="38"
        stroke="#8696a0"
        strokeWidth="3.5"
        strokeDasharray="40 18"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* Outer broken arc 2 */}
      <circle
        cx="50"
        cy="50"
        r="38"
        stroke="#8696a0"
        strokeWidth="3.5"
        strokeDasharray="25 35"
        strokeDashoffset="60"
        strokeLinecap="round"
        opacity="0.65"
      />
      {/* Inner solid status dot */}
      <circle cx="50" cy="50" r="16" fill="#8696a0" opacity="0.3" />
      <circle cx="50" cy="50" r="8" fill="#8696a0" opacity="0.6" />
    </svg>
  );
};

export const StatusEmptyState: React.FC<StatusEmptyStateProps> = ({
  onTextStatus,
  onPhotoVideoStatus,
}) => {
  return (
    <div className="wa-empty-container">
      {/* Center status illustration */}
      <WhatsAppStatusGraphic size={96} />

      <h1 className="wa-empty-title">Share statuses</h1>
      <p className="wa-empty-desc">
        Share photos, videos and text that disappear after 24 hours.
      </p>

      {/* Two circular action buttons: Text status & Photo and video */}
      <div className="wa-status-actions-row">
        {/* Text status */}
        <button
          className="wa-status-action-btn"
          onClick={onTextStatus}
          title="Create text status"
          id="btn-status-text"
        >
          <div className="wa-status-action-circle">
            <Edit3 size={20} />
          </div>
          <span className="wa-status-action-label">Text status</span>
        </button>

        {/* Photo and video */}
        <button
          className="wa-status-action-btn"
          onClick={onPhotoVideoStatus}
          title="Add photo or video status"
          id="btn-status-photo"
        >
          <div className="wa-status-action-circle">
            <Camera size={20} />
          </div>
          <span className="wa-status-action-label">Photo and video</span>
        </button>
      </div>

      {/* Encryption Footer */}
      <div className="wa-empty-encryption-footer">
        <Lock size={12} className="wa-lock-icon" />
        <span>Your status updates are end-to-end encrypted</span>
      </div>
    </div>
  );
};
