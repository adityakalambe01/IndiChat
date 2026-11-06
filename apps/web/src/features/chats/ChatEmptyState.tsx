import React from 'react';
import {
  FileText,
  UserPlus,
  Mail,
  Video,
  Lock,
} from 'lucide-react';
import { MetaAiSwirlIcon } from '../../components/NavigationRail';

interface ChatEmptyStateProps {
  onGoToCalls: () => void;
  onSendDocument: () => void;
  onAddContact: () => void;
  onInviteFriend: () => void;
  onNewCall: () => void;
  onAskMetaAi: () => void;
}

/**
 * High-fidelity vector laptop calling illustration matching WhatsApp Web
 */
export const WhatsAppLaptopCallingGraphic: React.FC<{ size?: number }> = ({ size = 180 }) => {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.72)}
      viewBox="0 0 200 144"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', margin: '0 auto 20px auto' }}
    >
      {/* Laptop Screen Body Outer */}
      <rect x="26" y="12" width="148" height="96" rx="8" fill="#1f2c34" stroke="#2a3942" strokeWidth="2.5" />
      {/* Laptop Screen Bezel Inner */}
      <rect x="32" y="18" width="136" height="84" rx="4" fill="#0b141a" />
      {/* Laptop Camera dot */}
      <circle cx="100" cy="15" r="1.5" fill="#53bdeb" />

      {/* Screen App Window (White/Cream base) */}
      <rect x="38" y="24" width="124" height="72" rx="4" fill="#f8fafc" />

      {/* Window Top Controls (Left green window - Video Call Active) */}
      <rect x="42" y="28" width="56" height="62" rx="3" fill="#25d366" />
      {/* Mini window control buttons */}
      <circle cx="48" cy="34" r="1.5" fill="#ffffff" opacity="0.9" />
      <circle cx="53" cy="34" r="1.5" fill="#ffffff" opacity="0.6" />
      <circle cx="58" cy="34" r="1.5" fill="#ffffff" opacity="0.6" />

      {/* Horizontal Call status lines on green window */}
      <rect x="48" y="42" width="28" height="2.5" rx="1" fill="#ffffff" opacity="0.95" />
      <rect x="48" y="47" width="18" height="2" rx="1" fill="#ffffff" opacity="0.75" />
      <rect x="48" y="52" width="22" height="2" rx="1" fill="#ffffff" opacity="0.75" />

      {/* Phone receiver handset silhouette in screen */}
      <path
        d="M125 44 C120 44, 114 47, 110 52 C106 57, 107 64, 112 70 C117 76, 124 77, 129 73 C132 70, 131 66, 127 64 L123 62 C121 61, 119 62, 118 63 C116 61, 114 59, 112 56 C113 55, 114 53, 113 51 L111 47 C109 44, 106 44, 125 44 Z"
        fill="#00a884"
        transform="translate(10, -3) scale(0.9)"
      />
      <circle cx="126" cy="58" r="16" fill="#00a884" opacity="0.12" />
      <path
        d="M121 53 C120 53, 118.5 54, 117.5 55.5 C116.5 57, 117 59.5, 118.5 61.5 C120 63.5, 122.5 64, 124 63 C125 62, 125 61, 124 60 L122.5 59 C121.8 58.5, 121 59, 120.5 59.5 C120 59, 119 58, 118.5 57 C119 56.5, 119.5 56, 119 55 L118 53.5 C117.5 53, 121 53, 121 53 Z"
        fill="#00a884"
      />

      {/* Laptop Keyboard Deck Base */}
      <path d="M12 108 L188 108 L174 118 L26 118 Z" fill="#2a3942" />
      {/* Front Edge & Trackpad */}
      <rect x="24" y="118" width="152" height="4" rx="2" fill="#1f2c34" />
      <rect x="88" y="112" width="24" height="2.5" rx="1.2" fill="#374248" />
    </svg>
  );
};

export const ChatEmptyState: React.FC<ChatEmptyStateProps> = ({
  onGoToCalls,
  onSendDocument,
  onAddContact,
  onInviteFriend,
  onNewCall,
  onAskMetaAi,
}) => {
  return (
    <div className="wa-empty-container">
      {/* Center Featured Card */}
      <div className="wa-empty-card">
        <WhatsAppLaptopCallingGraphic size={170} />

        <h1 className="wa-empty-card-title">Voice and video calling is now available</h1>
        <p className="wa-empty-card-desc">
          Now you can make and join calls on WhatsApp Web.
        </p>

        <button
          className="wa-empty-call-btn"
          onClick={onGoToCalls}
          id="btn-go-to-calls"
        >
          Go to Calls
        </button>
      </div>

      {/* Quick Actions Row */}
      <div className="wa-empty-actions-row">
        {/* Send Document */}
        <button
          className="wa-empty-action-item"
          onClick={onSendDocument}
          title="Send document"
        >
          <div className="wa-empty-action-circle">
            <FileText size={20} />
          </div>
          <span className="wa-empty-action-label">Send document</span>
        </button>

        {/* Add Contact */}
        <button
          className="wa-empty-action-item"
          onClick={onAddContact}
          title="Add contact"
        >
          <div className="wa-empty-action-circle">
            <UserPlus size={20} />
          </div>
          <span className="wa-empty-action-label">Add contact</span>
        </button>

        {/* Invite a friend */}
        <button
          className="wa-empty-action-item"
          onClick={onInviteFriend}
          title="Invite a friend"
        >
          <div className="wa-empty-action-circle">
            <Mail size={20} />
          </div>
          <span className="wa-empty-action-label">Invite a friend</span>
        </button>

        {/* New Call */}
        <button
          className="wa-empty-action-item"
          onClick={onNewCall}
          title="New call"
        >
          <div className="wa-empty-action-circle">
            <Video size={20} />
          </div>
          <span className="wa-empty-action-label">New call</span>
        </button>

        {/* Ask Meta AI */}
        <button
          className="wa-empty-action-item"
          onClick={onAskMetaAi}
          title="Ask Meta AI"
        >
          <div className="wa-empty-action-circle wa-circle-ai">
            <MetaAiSwirlIcon size={22} />
          </div>
          <span className="wa-empty-action-label">Ask Meta AI</span>
        </button>
      </div>

      {/* End-to-End Encryption Notice at Bottom */}
      <div className="wa-empty-encryption-footer">
        <Lock size={12} className="wa-lock-icon" />
        <span>Your personal messages are end-to-end encrypted</span>
      </div>
    </div>
  );
};
