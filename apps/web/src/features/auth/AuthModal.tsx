import React, { useState } from 'react';
import { api } from '../../services/api';
import { AuthResponse } from '@chat/shared-types';
import { MessageSquare, ShieldCheck, ArrowLeft, KeyRound } from 'lucide-react';
import { APP_NAME } from '../../config/appConfig';


interface AuthModalProps {
  onAuthenticated: (response: AuthResponse) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthenticated }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [isTwoFactorStep, setIsTwoFactorStep] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorPin, setTwoFactorPin] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        const res = await api.register({
          username,
          password,
          displayName: displayName || username,
          email: email || undefined,
          phoneNumber: phoneNumber || undefined,
        });
        if (res.tokens) {
          localStorage.setItem('chat_access_token', res.tokens.accessToken);
          localStorage.setItem('chat_refresh_token', res.tokens.refreshToken);
          onAuthenticated(res);
        }
      } else {
        const res = await api.login({
          usernameOrEmail: username,
          password,
        });
        if (res.requiresTwoFactor) {
          setIsTwoFactorStep(true);
          setError(null);
          setLoading(false);
          return;
        }
        if (res.tokens) {
          localStorage.setItem('chat_access_token', res.tokens.accessToken);
          localStorage.setItem('chat_refresh_token', res.tokens.refreshToken);
          onAuthenticated(res);
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Authentication failed. Please verify credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!twoFactorPin || twoFactorPin.trim().length !== 6) {
      setError('Please enter your 6-digit PIN');
      return;
    }
    setLoading(true);

    try {
      const res = await api.login({
        usernameOrEmail: username,
        password,
        twoFactorPin: twoFactorPin.trim(),
      });
      if (res.tokens) {
        localStorage.setItem('chat_access_token', res.tokens.accessToken);
        localStorage.setItem('chat_refresh_token', res.tokens.refreshToken);
        onAuthenticated(res);
      } else if (res.requiresTwoFactor) {
        setError('Verification PIN required. Please try again.');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Incorrect PIN. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (uname: string, name: string) => {
    setUsername(uname);
    setPassword('Password123!');
    setDisplayName(name);
    setError(null);
    setTwoFactorPin('');
    setIsTwoFactorStep(false);
    setLoading(true);

    try {
      const res = await api.login({
        usernameOrEmail: uname,
        password: 'Password123!',
      });
      if (res.requiresTwoFactor) {
        setIsTwoFactorStep(true);
        setError(null);
        setLoading(false);
        return;
      }
      if (res.tokens) {
        setIsTwoFactorStep(false);
        localStorage.setItem('chat_access_token', res.tokens.accessToken);
        localStorage.setItem('chat_refresh_token', res.tokens.refreshToken);
        onAuthenticated(res);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Authentication failed. Please verify credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '440px' }}>
        {isTwoFactorStep ? (
          /* Two-Step Verification View */
          <div>
            <div style={{ textAlign: 'center', padding: '28px 24px 16px 24px', background: 'linear-gradient(180deg, #182229 0%, #111b21 100%)' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 168, 132, 0.15)',
                border: '2px solid var(--accent-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
                marginBottom: '14px',
                boxShadow: '0 4px 20px rgba(0, 168, 132, 0.3)'
              }}>
                <ShieldCheck size={36} />
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Two-Step Verification
              </h2>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '6px', maxWidth: '320px', margin: '6px auto 0' }}>
                Account <strong style={{ color: 'var(--accent-primary)' }}>@{username}</strong> has two-step verification enabled. Enter your 6-digit PIN to complete sign in.
              </p>
              {username === 'alice' && (
                <div style={{ marginTop: '10px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '3px 10px', borderRadius: '12px' }}
                    onClick={() => setTwoFactorPin('112233')}
                  >
                    💡 Fill Demo PIN: 112233
                  </button>
                </div>
              )}
            </div>

            <form onSubmit={handleTwoFactorSubmit} className="modal-body" style={{ padding: '20px 24px' }}>
              {error && (
                <div style={{
                  backgroundColor: 'rgba(234, 67, 53, 0.15)',
                  color: '#ff6b6b',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '0.85rem'
                }}>
                  {error}
                </div>
              )}

              <div className="form-group" style={{ textAlign: 'center' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <KeyRound size={16} color="var(--accent-primary)" /> 6-Digit PIN
                </label>
                <input
                  type="password"
                  className="form-input"
                  style={{
                    textAlign: 'center',
                    fontSize: '1.6rem',
                    letterSpacing: '12px',
                    fontWeight: 700,
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '2px solid var(--border-color)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="••••••"
                  maxLength={6}
                  value={twoFactorPin}
                  onChange={(e) => setTwoFactorPin(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={loading || twoFactorPin.length !== 6}
                style={{ marginTop: '8px', padding: '12px', fontWeight: 600, fontSize: '0.95rem' }}
              >
                {loading ? 'Verifying PIN...' : 'Verify & Continue'}
              </button>

              <button
                type="button"
                className="btn-secondary"
                style={{
                  marginTop: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.86rem',
                }}
                onClick={() => {
                  setIsTwoFactorStep(false);
                  setTwoFactorPin('');
                  setError(null);
                }}
              >
                <ArrowLeft size={16} /> Back to Sign In
              </button>

              {/* Quick switch account from 2FA screen */}
              <div style={{
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px dashed var(--border-color)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
                  SWITCH TEST ACCOUNT:
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    onClick={() => handleQuickLogin('alice', 'Alice')}
                  >
                    🔒 Alice (2FA: 112233)
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    onClick={() => handleQuickLogin('bob', 'Bob')}
                  >
                    Bob
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    onClick={() => handleQuickLogin('charlie', 'Charlie')}
                  >
                    Charlie
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    onClick={() => handleQuickLogin('david', 'David Miller')}
                  >
                    David
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    onClick={() => handleQuickLogin('emma', 'Emma Watson')}
                  >
                    Emma
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    onClick={() => handleQuickLogin('frank', 'Frank Castle')}
                  >
                    Frank
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    onClick={() => handleQuickLogin('grace', 'Grace Hopper')}
                  >
                    Grace
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : (
          /* Standard Login / Register View */
          <div>
            <div style={{ textAlign: 'center', padding: '28px 24px 16px 24px', background: 'linear-gradient(180deg, #182229 0%, #111b21 100%)' }}>
              <div style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 12px auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                filter: 'drop-shadow(0 4px 14px rgba(0, 168, 132, 0.35))'
              }}>
                <img
                  src="/logo-192.png"
                  alt={APP_NAME}
                  style={{ width: '64px', height: '64px', borderRadius: '16px', objectFit: 'contain' }}
                />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {APP_NAME} Messenger
              </h2>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {isRegister ? 'Create an account to start messaging' : 'Sign in to your account'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="modal-body">
              {error && (
                <div style={{
                  backgroundColor: 'rgba(234, 67, 53, 0.15)',
                  color: '#ff6b6b',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '0.85rem'
                }}>
                  {error}
                </div>
              )}

              {isRegister && (
                <div className="form-group">
                  <label className="form-label">Full Name / Display Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Alice Cooper"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">{isRegister ? 'Username' : 'Username or Email'}</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. alice"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              {isRegister && (
                <>
                  <div className="form-group">
                    <label className="form-label">Email (Optional)</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="alice@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number (Optional)</label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="+1234567890"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '8px' }}>
                {loading ? 'Please wait...' : (isRegister ? 'Create Account' : 'Sign In')}
              </button>

              {/* Demo helper */}
              <div style={{
                background: 'var(--bg-chat-header)',
                borderRadius: '8px',
                padding: '10px 12px',
                marginTop: '4px',
                border: '1px dashed var(--border-color)'
              }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                  QUICK TEST PROFILES (Click to sign in):
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    onClick={() => handleQuickLogin('alice', 'Alice')}
                  >
                    🔒 Alice (2FA: 112233)
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    onClick={() => handleQuickLogin('bob', 'Bob')}
                  >
                    Bob
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    onClick={() => handleQuickLogin('charlie', 'Charlie')}
                  >
                    Charlie
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    onClick={() => handleQuickLogin('david', 'David Miller')}
                  >
                    David
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    onClick={() => handleQuickLogin('emma', 'Emma Watson')}
                  >
                    Emma
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    onClick={() => handleQuickLogin('frank', 'Frank Castle')}
                  >
                    Frank
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    onClick={() => handleQuickLogin('grace', 'Grace Hopper')}
                  >
                    Grace
                  </button>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '6px' }}>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setError(null);
                  }}
                >
                  {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
