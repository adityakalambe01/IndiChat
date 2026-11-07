import React, { useState } from 'react';
import { X, Shield, Bell, Ban, Phone, Video, FileText, Image as ImageIcon } from 'lucide-react';
import { User, Conversation } from '@chat/shared-types';

interface ContactDetailsPanelProps {
  conversation: Conversation;
  currentUser: User;
  onClose: () => void;
  onOpenLightbox?: (url: string, title?: string) => void;
  onOpenDocViewer?: (docName: string) => void;
  onStartCall?: (targetUserId: string, isVideo: boolean) => void;
}

export const ContactDetailsPanel: React.FC<ContactDetailsPanelProps> = ({
  conversation,
  currentUser,
  onClose,
  onOpenLightbox,
  onOpenDocViewer,
  onStartCall,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [showSafetyNumbersModal, setShowSafetyNumbersModal] = useState(false);

  const otherMember = conversation.type === 'GROUP'
    ? null
    : conversation.members.find((m) => m.userId !== currentUser.id);

  const title = conversation.type === 'GROUP'
    ? (conversation.title || 'Group')
    : (otherMember?.user?.displayName || otherMember?.user?.username || 'Contact');

  const phone = otherMember?.user?.phoneNumber || '+91 98765 43210';
  const bio = 'Available';

  const demoMediaItems = [
    { id: 'm1', type: 'image', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80', title: 'Design System Asset' },
    { id: 'm2', type: 'image', url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400&q=80', title: 'Wallpaper Spec' },
    { id: 'm3', type: 'doc', name: 'IndiChat_v2_Architecture_Specification.pdf', size: '2.4 MB' },
  ];

  const avatarColor = conversation.type === 'GROUP' ? 'var(--brand-teal)' : '#005c4b';
  const avatarInitials = conversation.type === 'GROUP' ? 'GP' : title.slice(0, 2).toUpperCase();

  return (
    <aside className="app-details-panel" id="detailsPanel" aria-label="Contact information panel">
      <div className="details-header">
        <span>Contact info</span>
        <button
          className="icon-btn"
          id="closeDetailsBtn"
          onClick={onClose}
          title="Close details"
          aria-label="Close contact details"
        >
          ✕
        </button>
      </div>

      <div className="details-hero">
        <div className="details-hero-avatar" style={{ background: avatarColor }}>
          {avatarInitials}
        </div>
        <div className="details-hero-name">{title}</div>
        <div className="details-hero-phone">{phone}</div>
      </div>

      <div className="details-section">
        <div className="details-section-title" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>About</div>
        <div className="details-bio-box" style={{ fontSize: '13px', color: 'var(--text-sec)' }}>{bio}</div>
      </div>

      <div className="details-section">
        <div className="details-section-title" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>Media, Links and Docs</div>
        <div className="details-media-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {demoMediaItems.map((item) => (
            <div
              key={item.id}
              className="media-thumbnail-chip"
              title={item.title || item.name || 'Media'}
              onClick={() => {
                if (item.type === 'image' && onOpenLightbox && item.url) {
                  onOpenLightbox(item.url, item.title || '');
                } else if (item.type === 'doc' && onOpenDocViewer) {
                  onOpenDocViewer(item.name || 'Document.pdf');
                }
              }}
              style={{
                aspectRatio: '1',
                borderRadius: 'var(--radius-sm, 6px)',
                overflow: 'hidden',
                cursor: 'pointer',
                background: 'var(--card-bg)',
                border: '1px solid var(--border-subtle)',
                display: 'grid',
                placeItems: 'center',
                fontSize: '20px'
              }}
            >
              <span>{item.type === 'doc' ? '📄' : '🎨'}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        className="details-section"
        id="btnVerifyEncryptionSection"
        role="button"
        tabIndex={0}
        style={{ cursor: 'pointer' }}
        title="Click to verify safety numbers"
        onClick={() => setShowSafetyNumbersModal(true)}
      >
        <div className="details-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Encryption</span>
          {isVerified ? (
            <span style={{ color: 'var(--brand-emerald)', fontSize: '11px', fontWeight: 700 }}>✓ Verified</span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Click to verify</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '12px', color: 'var(--text-sec)', lineHeight: 1.4 }}>
          <span style={{ color: 'var(--brand-emerald)' }}>🔒</span>
          <div>
            Messages and calls are end-to-end encrypted. Tap to verify safety numbers.
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', marginTop: '6px', color: 'var(--text-muted)' }}>
              4521 9883 0129 4821 0938
            </div>
          </div>
        </div>
      </div>

      <div className="details-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Mute Notifications</span>
          <input
            type="checkbox"
            id="checkMuteContact"
            checked={isMuted}
            onChange={(e) => setIsMuted(e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: 'var(--brand-emerald)', cursor: 'pointer' }}
          />
        </div>
        <button
          className="studio-btn danger"
          id="btnBlockContactToggle"
          onClick={() => setIsBlocked((prev) => !prev)}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {isBlocked ? '✓ Unblock Contact' : `🛡 Block ${title.split(' ')[0]}`}
        </button>
      </div>

      {/* Safety Numbers Modal */}
      {showSafetyNumbersModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div
            className="modal-card"
            style={{
              maxWidth: '420px',
              width: '100%',
              background: 'var(--card-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg, 16px)',
              padding: '24px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Verify Safety Numbers
                </h3>
                <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', borderRadius: '4px', fontWeight: 600 }}>
                  Demonstration Only
                </span>
              </div>
              <button className="icon-btn" onClick={() => setShowSafetyNumbersModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{
              background: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '12px',
              color: '#eab308',
              marginBottom: '16px',
              lineHeight: '1.4'
            }}>
              ⚠️ <strong>Demonstration Only</strong>: This 60-digit number is a static UI placeholder. Cryptographic end-to-end encryption key verification (Signal / OMEMO protocol) is pending production implementation. No actual cryptographic key exchange has occurred.
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-sec)', marginBottom: '16px', lineHeight: '1.4' }}>
              To verify that messages and calls with <strong>{title}</strong> are end-to-end encrypted, compare the 60-digit number below with their phone or scan the QR code.
            </p>

            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '16px',
              borderRadius: 'var(--radius-md, 10px)',
              fontFamily: 'monospace',
              fontSize: '13px',
              letterSpacing: '1px',
              textAlign: 'center',
              color: 'var(--text-main)',
              lineHeight: '1.8',
              marginBottom: '20px'
            }}>
              45219 88301 29482 10938<br />
              99382 11049 84920 18273<br />
              01948 57391 29482 99482
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn-secondary"
                style={{ flex: 1, padding: '10px' }}
                onClick={() => setShowSafetyNumbersModal(false)}
              >
                Close
              </button>
              <button
                className="btn-primary"
                id="btnConfirmVerifiedNumbers"
                style={{ flex: 1, padding: '10px', background: 'var(--brand-teal)', color: '#fff', borderRadius: 'var(--radius-sm)' }}
                onClick={() => {
                  setIsVerified(true);
                  setShowSafetyNumbersModal(false);
                }}
              >
                Mark as Verified (Demo Simulation)
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
