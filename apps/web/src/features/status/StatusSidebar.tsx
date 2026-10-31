import React, { useState } from 'react';
import { MoreVertical, Plus, Camera } from 'lucide-react';
import { User } from '@chat/shared-types';
import { INITIAL_STATUS_LIST, UserStatus } from '../../data/statusData';

interface StatusSidebarProps {
  currentUser: User | null;
  onSelectStatus: (status: UserStatus) => void;
  onOpenCreateStatus: (type: 'text' | 'image') => void;
}

/**
 * Segmented WhatsApp green status border around avatar
 */
export const SegmentedStatusRing: React.FC<{
  count: number;
  hasUnread?: boolean;
  children: React.ReactNode;
}> = ({ count, hasUnread = true, children }) => {
  const size = 48;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const strokeColor = hasUnread ? '#25d366' : '#8696a0';

  if (count <= 1) {
    return (
      <div className="wa-status-avatar-wrapper">
        <svg className="wa-status-svg" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
        </svg>
        <div className="wa-status-avatar-inner">{children}</div>
      </div>
    );
  }

  const gap = 4;
  const segmentLength = (circumference / count) - gap;

  return (
    <div className="wa-status-avatar-wrapper">
      <svg className="wa-status-svg" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${segmentLength} ${gap}`}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="wa-status-avatar-inner">{children}</div>
    </div>
  );
};

export const StatusSidebar: React.FC<StatusSidebarProps> = ({
  currentUser,
  onSelectStatus,
  onOpenCreateStatus,
}) => {
  const [statusList, setStatusList] = useState<UserStatus[]>(INITIAL_STATUS_LIST);
  const [myStatus, setMyStatus] = useState<UserStatus | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const recentStatuses = statusList.filter((s) => s.hasUnread);
  const viewedStatuses = statusList.filter((s) => !s.hasUnread);

  const handleOpenMyStatus = () => {
    if (myStatus && myStatus.stories.length > 0) {
      onSelectStatus(myStatus);
    } else {
      onOpenCreateStatus('text');
    }
  };

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="wa-sidebar-header">
        <h1 className="wa-header-title">Status</h1>

        <div className="wa-header-actions">
          {/* 3-dots Menu */}
          <div style={{ position: 'relative' }}>
            <button
              className="icon-btn"
              onClick={() => setShowMoreMenu((prev) => !prev)}
              title="Status privacy"
              aria-label="Status privacy"
            >
              <MoreVertical size={20} />
            </button>
            {showMoreMenu && (
              <div className="wa-dropdown-menu">
                <button
                  className="wa-dropdown-item"
                  onClick={() => {
                    setShowMoreMenu(false);
                    alert('Status privacy is currently set to: My contacts');
                  }}
                >
                  <span>Status privacy</span>
                </button>
              </div>
            )}
          </div>

          {/* Plus Add Status Button */}
          <button
            className="icon-btn"
            onClick={() => onOpenCreateStatus('image')}
            title="Add status update"
            aria-label="Add status update"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Status List */}
      <div className="conversation-list">
        {/* My Status */}
        <div className="conversation-item wa-my-status-item" onClick={handleOpenMyStatus}>
          <div className="wa-my-status-avatar-wrapper">
            <div className="avatar">
              {currentUser?.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="wa-my-status-add-badge">
              <Plus size={14} color="#ffffff" strokeWidth={3} />
            </div>
          </div>

          <div className="conversation-content">
            <span className="conversation-title">My status</span>
            <span className="conversation-subtitle" style={{ fontSize: '0.8rem' }}>
              {myStatus ? 'Tap to view status update' : 'Click to add status update'}
            </span>
          </div>
        </div>

        {/* Recent Updates Header */}
        {recentStatuses.length > 0 && (
          <div className="wa-section-header">Recent</div>
        )}

        {/* Recent Statuses */}
        {recentStatuses.map((status) => (
          <div
            key={status.id}
            className="conversation-item"
            onClick={() => {
              onSelectStatus(status);
              setStatusList((prev) =>
                prev.map((s) => (s.id === status.id ? { ...s, hasUnread: false } : s))
              );
            }}
          >
            <SegmentedStatusRing count={status.stories.length} hasUnread={status.hasUnread}>
              <div className="avatar">
                {status.userName.charAt(0).toUpperCase()}
              </div>
            </SegmentedStatusRing>

            <div className="conversation-content">
              <span className="conversation-title">{status.userName}</span>
              <span className="conversation-subtitle">{status.timeAgo}</span>
            </div>
          </div>
        ))}

        {/* Viewed Updates Header */}
        {viewedStatuses.length > 0 && (
          <div className="wa-section-header" style={{ marginTop: '16px' }}>Viewed updates</div>
        )}

        {/* Viewed Statuses */}
        {viewedStatuses.map((status) => (
          <div
            key={status.id}
            className="conversation-item"
            onClick={() => onSelectStatus(status)}
          >
            <SegmentedStatusRing count={status.stories.length} hasUnread={false}>
              <div className="avatar" style={{ opacity: 0.75 }}>
                {status.userName.charAt(0).toUpperCase()}
              </div>
            </SegmentedStatusRing>

            <div className="conversation-content">
              <span className="conversation-title" style={{ opacity: 0.85 }}>{status.userName}</span>
              <span className="conversation-subtitle">{status.timeAgo}</span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};
