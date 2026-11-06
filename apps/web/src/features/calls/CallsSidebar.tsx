import React, { useState } from 'react';
import {
  Phone,
  Search,
  MoreVertical,
  ArrowUpRight,
  ArrowDownLeft,
  Video,
  Plus,
  BellOff,
  X,
  PhoneCall,
  UserPlus
} from 'lucide-react';
import { INITIAL_CALLS_LIST, CallLogItem } from '../../data/callData';

interface CallsSidebarProps {
  onStartCallWithContact: (contactName: string, isVideo: boolean) => void;
  onOpenNewCallModal: () => void;
  onShowDialpad: () => void;
}

export const CallsSidebar: React.FC<CallsSidebarProps> = ({
  onStartCallWithContact,
  onOpenNewCallModal,
  onShowDialpad,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [callsList, setCallsList] = useState<CallLogItem[]>(INITIAL_CALLS_LIST);
  const [showNotificationBanner, setShowNotificationBanner] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [favourites, setFavourites] = useState<{ id: string; name: string }[]>([]);

  const filteredCalls = callsList.filter((call) =>
    call.contactName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddFavourite = () => {
    const name = prompt('Enter contact name or number to add to Favourites:');
    if (name?.trim()) {
      setFavourites((prev) => [...prev, { id: `fav-${Date.now()}`, name: name.trim() }]);
    }
  };

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="wa-sidebar-header">
        <h1 className="wa-header-title">Calls</h1>

        <div className="wa-header-actions">
          {/* 3-dots Menu */}
          <div style={{ position: 'relative' }}>
            <button
              className="icon-btn"
              onClick={() => setShowMoreMenu((prev) => !prev)}
              title="More options"
              aria-label="More options"
            >
              <MoreVertical size={20} />
            </button>
            {showMoreMenu && (
              <div className="wa-dropdown-menu">
                <button
                  className="wa-dropdown-item"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onOpenNewCallModal();
                  }}
                >
                  <PhoneCall size={16} />
                  <span>New call</span>
                </button>
                <button
                  className="wa-dropdown-item"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onShowDialpad();
                  }}
                >
                  <span>Dial pad</span>
                </button>
                <button
                  className="wa-dropdown-item"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setCallsList([]);
                  }}
                >
                  <span>Clear call log</span>
                </button>
              </div>
            )}
          </div>

          {/* Green Call Button */}
          <button
            className="wa-header-green-btn"
            onClick={onOpenNewCallModal}
            title="Start new call"
            aria-label="Start new call"
            id="btn-calls-new-call"
          >
            <Phone size={18} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="sidebar-search">
        <div className="search-input-wrapper">
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search name, number or @username"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Notification Banner */}
      {showNotificationBanner && (
        <div className="sidebar-notification-banner">
          <div className="sidebar-notification-banner-icon">
            <BellOff size={18} color="#00a884" />
          </div>
          <div className="sidebar-notification-banner-content">
            <span className="sidebar-notification-banner-title">Notifications are off. <a href="#turn-on" onClick={(e) => { e.preventDefault(); alert('Please allow notifications in your browser permissions.'); }}>Turn on</a></span>
          </div>
          <button
            className="sidebar-notification-banner-close"
            onClick={() => setShowNotificationBanner(false)}
            aria-label="Dismiss banner"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Scrollable Calls List */}
      <div className="conversation-list">
        {/* Favourites Section */}
        <div className="wa-section-header">Favourites</div>
        <div
          className="wa-add-favourite-row"
          onClick={handleAddFavourite}
          role="button"
          tabIndex={0}
        >
          <div className="wa-add-favourite-circle">
            <Plus size={18} />
          </div>
          <span className="wa-add-favourite-text">Add favourite</span>
        </div>

        {favourites.map((fav) => (
          <div
            key={fav.id}
            className="conversation-item"
            onClick={() => onStartCallWithContact(fav.name, false)}
          >
            <div className="avatar">{fav.name.charAt(0).toUpperCase()}</div>
            <div className="conversation-content">
              <span className="conversation-title">{fav.name}</span>
              <span style={{ fontSize: '0.8rem', color: '#00a884' }}>Favourite contact</span>
            </div>
          </div>
        ))}

        {/* Recent Calls Section */}
        <div className="wa-section-header" style={{ marginTop: '12px' }}>Recent</div>

        {filteredCalls.length === 0 ? (
          <div className="wa-empty-list-notice">
            <p>No recent calls found</p>
          </div>
        ) : (
          filteredCalls.map((call) => {
            const isMissed = call.type === 'missed';
            const isOutgoing = call.type === 'outgoing';

            return (
              <div
                key={call.id}
                className="conversation-item wa-call-item"
                onClick={() => onStartCallWithContact(call.contactName, call.isVideo)}
              >
                <div
                  className="avatar"
                  style={call.avatarBg ? { backgroundColor: call.avatarBg } : undefined}
                >
                  {call.avatarLetter || call.contactName.charAt(0).toUpperCase()}
                </div>

                <div className="conversation-content">
                  <div className="conversation-row">
                    <span
                      className="conversation-title"
                      style={isMissed ? { color: '#f15c6d' } : undefined}
                    >
                      {call.contactName}
                    </span>
                    <span className="conversation-time">{call.timeStr}</span>
                  </div>

                  <div className="conversation-subtitle">
                    <div className="wa-call-status-indicator">
                      {isOutgoing && (
                        <ArrowUpRight size={15} color="#00a884" style={{ marginRight: '4px' }} />
                      )}
                      {call.type === 'incoming' && (
                        <ArrowDownLeft size={15} color="#8696a0" style={{ marginRight: '4px' }} />
                      )}
                      {isMissed && (
                        <ArrowDownLeft size={15} color="#f15c6d" style={{ marginRight: '4px' }} />
                      )}

                      {call.isVideo && (
                        <Video size={13} color="var(--text-secondary)" style={{ marginRight: '4px' }} />
                      )}

                      <span style={isMissed ? { color: '#f15c6d' } : undefined}>
                        {isMissed ? 'Missed' : isOutgoing ? 'Outgoing' : 'Incoming'}
                        {call.callCount && call.callCount > 1 ? ` (${call.callCount})` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
