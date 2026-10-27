import React, { useState } from 'react';
import { Camera, Check, Edit2, User as UserIcon, Info, AtSign } from 'lucide-react';
import { User } from '@chat/shared-types';
import { AppSettings, settingsService } from '../../services/settings';
import { api } from '../../services/api';

interface ProfileViewProps {
  currentUser: User;
  settings: AppSettings;
  onUpdateUser?: (updated: Partial<User>) => void;
  avatarUrl?: string;
  onAvatarChange?: (url: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  settings,
  onUpdateUser,
  avatarUrl,
  onAvatarChange,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser.displayName || '');
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [aboutText, setAboutText] = useState(settings.statusAbout || 'Current mood');

  const handleSaveName = async () => {
    if (!displayName.trim()) return;
    try {
      await api.updateProfile({ displayName: displayName.trim() });
      if (onUpdateUser) onUpdateUser({ displayName: displayName.trim() });
      setIsEditingName(false);
    } catch (e: any) {
      alert(e.message || 'Failed to update name');
    }
  };

  const handleSaveAbout = () => {
    settingsService.update({ statusAbout: aboutText.trim() });
    setIsEditingAbout(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const url = event.target.result as string;
          if (onAvatarChange) onAvatarChange(url);
          localStorage.setItem(`wa_custom_avatar_${currentUser.id}`, url);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="wa-profile-view-content">
      {/* Centered Large Avatar with change photo overlay */}
      <div className="wa-profile-avatar-center-wrap">
        <div className="wa-profile-large-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt={currentUser.displayName} className="wa-avatar-img" />
          ) : (
            <div className="avatar wa-profile-fallback-avatar">
              {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}
            </div>
          )}
          <label className="wa-avatar-hover-overlay" title="Change profile photo">
            <Camera size={26} color="#ffffff" />
            <span>CHANGE PROFILE PHOTO</span>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Your Name Section */}
      <div className="wa-profile-field-block">
        <span className="wa-profile-field-label">Your name</span>
        {isEditingName ? (
          <div className="wa-profile-field-row editing">
            <input
              type="text"
              className="wa-profile-edit-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoFocus
            />
            <button className="icon-btn" onClick={handleSaveName} style={{ color: '#00a884' }}>
              <Check size={18} />
            </button>
          </div>
        ) : (
          <div className="wa-profile-field-row" onClick={() => setIsEditingName(true)}>
            <span className="wa-profile-field-val">{currentUser.displayName || 'No name set'}</span>
            <Edit2 size={16} className="wa-edit-icon" />
          </div>
        )}
        <p className="wa-profile-field-hint">
          This is not your username or pin. This name will be visible to your WhatsApp contacts.
        </p>
      </div>

      {/* About / Mood Section */}
      <div className="wa-profile-field-block">
        <span className="wa-profile-field-label">About / Mood</span>
        {isEditingAbout ? (
          <div className="wa-profile-field-row editing">
            <input
              type="text"
              className="wa-profile-edit-input"
              value={aboutText}
              onChange={(e) => setAboutText(e.target.value)}
              autoFocus
            />
            <button className="icon-btn" onClick={handleSaveAbout} style={{ color: '#00a884' }}>
              <Check size={18} />
            </button>
          </div>
        ) : (
          <div className="wa-profile-field-row" onClick={() => setIsEditingAbout(true)}>
            <span className="wa-profile-field-val">{settings.statusAbout || 'Current mood'}</span>
            <Edit2 size={16} className="wa-edit-icon" />
          </div>
        )}
      </div>

      {/* Username Section */}
      <div className="wa-profile-field-block">
        <span className="wa-profile-field-label">Username</span>
        <div className="wa-profile-field-row readonly">
          <span className="wa-profile-field-val">@{currentUser.username}</span>
          <AtSign size={16} color="var(--text-muted)" />
        </div>
      </div>
    </div>
  );
};
