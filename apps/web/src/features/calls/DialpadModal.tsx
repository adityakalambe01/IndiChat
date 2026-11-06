import React, { useState } from 'react';
import { X, Phone, Delete, Video } from 'lucide-react';

interface DialpadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartCall: (number: string, isVideo: boolean) => void;
}

export const DialpadModal: React.FC<DialpadModalProps> = ({
  isOpen,
  onClose,
  onStartCall,
}) => {
  if (!isOpen) return null;

  const [phoneNumber, setPhoneNumber] = useState('');

  const handleDigit = (digit: string) => {
    setPhoneNumber((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const digits = [
    { num: '1', letters: '' },
    { num: '2', letters: 'ABC' },
    { num: '3', letters: 'DEF' },
    { num: '4', letters: 'GHI' },
    { num: '5', letters: 'JKL' },
    { num: '6', letters: 'MNO' },
    { num: '7', letters: 'PQRS' },
    { num: '8', letters: 'TUV' },
    { num: '9', letters: 'WXYZ' },
    { num: '*', letters: '' },
    { num: '0', letters: '+' },
    { num: '#', letters: '' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="wa-dialpad-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="wa-modal-header">
          <h2 className="wa-modal-title">Call a number</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Display */}
        <div className="wa-dialpad-display">
          <input
            type="text"
            className="wa-dialpad-input"
            placeholder="Enter phone number"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
          {phoneNumber && (
            <button className="wa-dialpad-backspace" onClick={handleBackspace} title="Delete">
              <Delete size={20} />
            </button>
          )}
        </div>

        {/* Dialpad Buttons Grid */}
        <div className="wa-dialpad-grid">
          {digits.map((d) => (
            <button
              key={d.num}
              className="wa-dialpad-key"
              onClick={() => handleDigit(d.num)}
            >
              <span className="wa-key-num">{d.num}</span>
              {d.letters && <span className="wa-key-letters">{d.letters}</span>}
            </button>
          ))}
        </div>

        {/* Call Actions */}
        <div className="wa-dialpad-actions">
          <button
            className="wa-dialpad-call-btn voice"
            disabled={!phoneNumber.trim()}
            onClick={() => {
              onStartCall(phoneNumber.trim(), false);
              onClose();
            }}
            title="Voice call"
          >
            <Phone size={22} />
          </button>

          <button
            className="wa-dialpad-call-btn video"
            disabled={!phoneNumber.trim()}
            onClick={() => {
              onStartCall(phoneNumber.trim(), true);
              onClose();
            }}
            title="Video call"
          >
            <Video size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};
