import React, { useState, useEffect } from 'react';
import { X, Smartphone, QrCode, Key, Check, ShieldCheck, RefreshCw } from 'lucide-react';
import { settingsService } from '../../services/settings';
import { APP_NAME } from '../../config/appConfig';


interface LinkDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceLinked?: () => void;
}

export const LinkDeviceModal: React.FC<LinkDeviceModalProps> = ({ isOpen, onClose, onDeviceLinked }) => {
  const [tab, setTab] = useState<'qr' | 'code'>('qr');
  const [phoneNumber, setPhoneNumber] = useState('+91 98765 43210');
  const [pairingCode, setPairingCode] = useState('WA-8924-XK');
  const [isLinking, setIsLinking] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSuccess(false);
      setIsLinking(false);
      // Generate random code
      const rand = Math.floor(1000 + Math.random() * 9000);
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      const c1 = chars.charAt(Math.floor(Math.random() * chars.length));
      const c2 = chars.charAt(Math.floor(Math.random() * chars.length));
      setPairingCode(`WA-${rand}-${c1}${c2}`);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSimulateScan = () => {
    setIsLinking(true);
    setTimeout(() => {
      // Add simulated device
      const platforms = ['windows', 'mac', 'android', 'ios'] as const;
      const chosenPlatform = platforms[Math.floor(Math.random() * platforms.length)];
      const names: Record<string, string> = {
        windows: 'Windows PC (Chrome 125)',
        mac: 'MacBook Pro (Safari 17.5)',
        android: `Samsung Galaxy S24 (${APP_NAME} Web)`,
        ios: 'iPad Pro (Safari)',
      };


      settingsService.addLinkedDevice({
        name: names[chosenPlatform],
        platform: chosenPlatform,
        browser: 'Browser Session',
        location: 'Pune, India',
        ipAddress: `192.168.1.${Math.floor(100 + Math.random() * 100)}`,
        lastActive: 'Active now',
      });

      setIsLinking(false);
      setIsSuccess(true);
      if (onDeviceLinked) onDeviceLinked();
      setTimeout(() => {
        onClose();
      }, 1500);
    }, 1600);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content link-device-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="settings-icon-badge badge-green">
              <QrCode size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Link a device</h3>
              <span style={{ fontSize: '10px', color: '#eab308', fontWeight: 600 }}>Preview Demonstration</span>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '24px 20px', gap: '20px' }}>
          {isSuccess ? (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(234, 179, 8, 0.15)',
                  color: '#eab308',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <Check size={36} strokeWidth={2.5} />
              </div>
              <h4 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Simulated Device Added!</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                A demonstration session was added to local state. Note that real multi-device cryptographic network pairing was not executed.
              </p>
            </div>
          ) : (
            <>
              <div style={{
                background: 'rgba(234, 179, 8, 0.12)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '12px',
                color: '#eab308',
                lineHeight: '1.4'
              }}>
                ⚠️ <strong>Demonstration Only</strong>: Device linking via QR code or phone code is a preview simulation. A mock session is created in local state; actual multi-device network pairing is pending.
              </div>

              {/* Tabs */}
              <div className="settings-tab-bar">
                <button
                  className={`settings-tab-btn ${tab === 'qr' ? 'active' : ''}`}
                  onClick={() => setTab('qr')}
                >
                  <QrCode size={16} /> QR Code
                </button>
                <button
                  className={`settings-tab-btn ${tab === 'code' ? 'active' : ''}`}
                  onClick={() => setTab('code')}
                >
                  <Key size={16} /> Link with Phone Code
                </button>
              </div>

              {tab === 'qr' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  {/* QR Box with Scan Beam */}
                  <div className="qr-container">
                    {/* SVG Realistic QR Code Pattern */}
                    <svg viewBox="0 0 200 200" width="180" height="180" className="qr-svg">
                      <rect width="200" height="200" fill="#ffffff" rx="8" />
                      {/* Corner 1 */}
                      <rect x="15" y="15" width="46" height="46" fill="#111b21" rx="4" />
                      <rect x="23" y="23" width="30" height="30" fill="#ffffff" />
                      <rect x="29" y="29" width="18" height="18" fill="#111b21" />
                      {/* Corner 2 */}
                      <rect x="139" y="15" width="46" height="46" fill="#111b21" rx="4" />
                      <rect x="147" y="23" width="30" height="30" fill="#ffffff" />
                      <rect x="153" y="29" width="18" height="18" fill="#111b21" />
                      {/* Corner 3 */}
                      <rect x="15" y="139" width="46" height="46" fill="#111b21" rx="4" />
                      <rect x="23" y="147" width="30" height="30" fill="#ffffff" />
                      <rect x="29" y="153" width="18" height="18" fill="#111b21" />
                      {/* Data dots */}
                      <rect x="75" y="20" width="8" height="8" fill="#111b21" />
                      <rect x="87" y="20" width="8" height="8" fill="#111b21" />
                      <rect x="99" y="20" width="8" height="8" fill="#111b21" />
                      <rect x="75" y="32" width="8" height="8" fill="#111b21" />
                      <rect x="111" y="32" width="8" height="8" fill="#111b21" />
                      <rect x="87" y="44" width="8" height="8" fill="#111b21" />
                      <rect x="75" y="56" width="8" height="8" fill="#111b21" />
                      <rect x="99" y="56" width="8" height="8" fill="#111b21" />
                      {/* Middle dots */}
                      <rect x="20" y="75" width="8" height="8" fill="#111b21" />
                      <rect x="32" y="87" width="8" height="8" fill="#111b21" />
                      <rect x="44" y="75" width="8" height="8" fill="#111b21" />
                      <rect x="44" y="99" width="8" height="8" fill="#111b21" />
                      <rect x="56" y="87" width="8" height="8" fill="#111b21" />
                      {/* Center WhatsApp icon circle */}
                      <circle cx="100" cy="100" r="22" fill="#00a884" />
                      <path
                        d="M93 93c.8-.8 1.8-.8 2.6 0l1.6 1.6c.8.8.8 2 0 2.8l-.8.8c.8 1.6 2 2.8 3.6 3.6l.8-.8c.8-.8 2-.8 2.8 0l1.6 1.6c.8.8.8 1.8 0 2.6-.8.8-1.8 1.4-2.8 1.4-3.2 0-7.2-4-7.2-7.2 0-1 .6-2 1.4-2.8z"
                        fill="#ffffff"
                        transform="scale(1.2) translate(-17, -17)"
                      />
                      {/* Bottom data */}
                      <rect x="75" y="140" width="8" height="8" fill="#111b21" />
                      <rect x="87" y="152" width="8" height="8" fill="#111b21" />
                      <rect x="99" y="140" width="8" height="8" fill="#111b21" />
                      <rect x="111" y="164" width="8" height="8" fill="#111b21" />
                      <rect x="123" y="152" width="8" height="8" fill="#111b21" />
                      <rect x="135" y="140" width="8" height="8" fill="#111b21" />
                      <rect x="147" y="164" width="8" height="8" fill="#111b21" />
                      <rect x="160" y="152" width="8" height="8" fill="#111b21" />
                      <rect x="172" y="140" width="8" height="8" fill="#111b21" />
                      <rect x="140" y="75" width="8" height="8" fill="#111b21" />
                      <rect x="152" y="87" width="8" height="8" fill="#111b21" />
                      <rect x="164" y="75" width="8" height="8" fill="#111b21" />
                      <rect x="176" y="99" width="8" height="8" fill="#111b21" />
                    </svg>

                    {/* Scanning radar line */}
                    <div className="qr-scan-line" />
                  </div>

                  <div className="link-instructions">
                    <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      To use {APP_NAME} on your devices:
                    </p>
                    <ol style={{ paddingLeft: '18px', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.7' }}>
                      <li>Open {APP_NAME} on your mobile phone</li>
                      <li>Tap <strong>Settings</strong> or <strong>Menu</strong> &gt; <strong>Linked Devices</strong></li>
                      <li>Tap <strong>Link a device</strong> and point your camera here</li>
                    </ol>
                  </div>

                  {/* Simulate Scan Button */}
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: '4px' }}
                    onClick={handleSimulateScan}
                    disabled={isLinking}
                  >
                    {isLinking ? (
                      <>
                        <RefreshCw size={18} className="spin" /> Simulating Scan...
                      </>
                    ) : (
                      <>
                        <Smartphone size={18} /> Simulate Mobile QR Scan (Demo)
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Enter this code on your phone to link without scanning:
                  </p>

                  <div className="pairing-code-box">
                    <span className="pairing-code-text">{pairingCode}</span>
                  </div>

                  <div className="link-instructions">
                    <ol style={{ paddingLeft: '18px', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.7' }}>
                      <li>Open {APP_NAME} on your phone &gt; <strong>Linked Devices</strong></li>
                      <li>Tap <strong>Link with phone number instead</strong></li>
                      <li>Type the 8-character code shown above into your phone</li>
                    </ol>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={handleSimulateScan}
                    disabled={isLinking}
                  >
                    {isLinking ? (
                      <>
                        <RefreshCw size={18} className="spin" /> Verifying Code (Demo)...
                      </>
                    ) : (
                      <>
                        <Check size={18} /> Confirm Code on Phone (Demo)
                      </>
                    )}
                  </button>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  marginTop: '4px',
                }}
              >
                <ShieldCheck size={15} color="#eab308" />
                <span>Device pairing preview · Real multi-device synchronization is pending</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
