import React, { useState } from 'react';
import { X, Fingerprint, ShieldCheck, Check, Trash2 } from 'lucide-react';
import { settingsService } from '../../services/settings';
import { APP_NAME } from '../../config/appConfig';


interface PasskeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  passkeyEnabled: boolean;
  onUpdate: (enabled: boolean) => void;
}

export const PasskeyModal: React.FC<PasskeyModalProps> = ({
  isOpen,
  onClose,
  passkeyEnabled,
  onUpdate,
}) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleCreatePasskey = () => {
    setLoading(true);
    setTimeout(() => {
      settingsService.update({
        passkeyEnabled: true,
        passkeyCreatedAt: new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
      });
      onUpdate(true);
      setLoading(false);
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1400);
    }, 1200);
  };

  const handleRemovePasskey = () => {
    if (confirm('Are you sure you want to remove your passkey?')) {
      settingsService.update({ passkeyEnabled: false });
      onUpdate(false);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="settings-icon-badge badge-blue">
              <Fingerprint size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Passkeys</h3>
              <span style={{ fontSize: '10px', color: '#eab308', fontWeight: 600 }}>Preview Demonstration</span>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '24px 20px', textAlign: 'center' }}>
          <div style={{
            background: 'rgba(234, 179, 8, 0.12)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '12px',
            color: '#eab308',
            marginBottom: '16px',
            textAlign: 'left',
            lineHeight: '1.4'
          }}>
            ⚠️ <strong>Demonstration Only</strong>: WebAuthn FIDO2 biometric authentication is pending backend challenge-response attestation. This modal demonstrates the preview interface without registering real biometric keys.
          </div>

          {success ? (
            <div style={{ padding: '20px 0' }}>
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(234, 179, 8, 0.15)',
                  color: '#eab308',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <Check size={32} />
              </div>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>Simulated Passkey Created!</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Demonstration passkey saved in preview state. Live WebAuthn credential attestation is in development.
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: passkeyEnabled ? 'rgba(0, 168, 132, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                  color: passkeyEnabled ? 'var(--accent-primary)' : '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <Fingerprint size={34} />
              </div>

              <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>
                {passkeyEnabled ? 'Passkey is active (Preview)' : 'Simple, secure login with passkeys'}
              </h4>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', marginBottom: '20px' }}>
                {passkeyEnabled
                  ? `Your biometric screen lock or security key is enabled in preview state for fast, passwordless login to your ${APP_NAME} account.`
                  : `Log in to ${APP_NAME} using your face, fingerprint, or device screen lock. Passkeys are securely stored in your password manager.`}
              </p>


              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  marginBottom: '20px',
                }}
              >
                <ShieldCheck size={16} color="#eab308" />
                <span>WebAuthn FIDO2 Standard (Integration In Development)</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                {passkeyEnabled ? (
                  <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                      Done
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{ background: 'rgba(234, 67, 53, 0.15)', color: '#ea4335' }}
                      onClick={handleRemovePasskey}
                    >
                      <Trash2 size={16} /> Remove Passkey
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleCreatePasskey}
                      disabled={loading}
                    >
                      {loading ? 'Creating Passkey (Demo)...' : 'Simulate Create Passkey (Demo)'}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
