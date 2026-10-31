import React, { useState } from 'react';
import { Plus, Users, ChevronRight, Lock } from 'lucide-react';
import { INITIAL_COMMUNITIES, CommunityItem } from '../../data/communityData';

interface CommunitiesSidebarProps {
  onStartCommunity: () => void;
  onSelectCommunityGroup?: (groupName: string) => void;
}

/**
 * Modern vector community illustration with notebook, apple, calculator & people
 */
export const WhatsAppCommunityIllustration: React.FC<{ size?: number }> = ({ size = 120 }) => {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.9)}
      viewBox="0 0 140 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', margin: '0 auto 16px auto' }}
    >
      {/* Background card with rounded corners */}
      <rect x="10" y="10" width="120" height="100" rx="16" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="1.5" />

      {/* People silhouettes group in upper left */}
      <circle cx="28" cy="28" r="6" fill="#22c55e" />
      <path d="M19 44 C19 38, 37 38, 37 44" fill="#22c55e" />
      <circle cx="42" cy="28" r="6" fill="#16a34a" />
      <path d="M33 44 C33 38, 51 38, 51 44" fill="#16a34a" />

      {/* Pencil leaning on notepad */}
      <rect x="58" y="24" width="8" height="40" rx="3" fill="#fbbf24" transform="rotate(40 58 24)" />
      <polygon points="86,47 92,54 84,55" fill="#f87171" />

      {/* Green Apple */}
      <circle cx="44" cy="80" r="14" fill="#84cc16" />
      <path d="M44 66 C44 62, 48 60, 50 62 C50 66, 44 66, 44 66 Z" fill="#4d7c0f" />

      {/* Calculator with math symbols (+ - x) */}
      <rect x="76" y="60" width="46" height="42" rx="8" fill="#14b8a6" />
      {/* Math keys */}
      <rect x="82" y="66" width="14" height="12" rx="3" fill="#0d9488" />
      <text x="89" y="75" fontSize="9" fontWeight="bold" fill="#ffffff" textAnchor="middle">+</text>

      <rect x="102" y="66" width="14" height="12" rx="3" fill="#0d9488" />
      <text x="109" y="74" fontSize="9" fontWeight="bold" fill="#ffffff" textAnchor="middle">-</text>

      <rect x="82" y="84" width="14" height="12" rx="3" fill="#0d9488" />
      <text x="89" y="93" fontSize="8" fontWeight="bold" fill="#ffffff" textAnchor="middle">×</text>

      <rect x="102" y="84" width="14" height="12" rx="3" fill="#0d9488" />
      <text x="109" y="93" fontSize="8" fontWeight="bold" fill="#ffffff" textAnchor="middle">÷</text>
    </svg>
  );
};

export const CommunitiesSidebar: React.FC<CommunitiesSidebarProps> = ({
  onStartCommunity,
  onSelectCommunityGroup,
}) => {
  const [communities] = useState<CommunityItem[]>(INITIAL_COMMUNITIES);
  const [showExamples, setShowExamples] = useState(false);

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="wa-sidebar-header">
        <h1 className="wa-header-title">Communities</h1>

        <div className="wa-header-actions">
          <button
            className="icon-btn"
            onClick={onStartCommunity}
            title="Start your community"
            aria-label="Start your community"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Communities Content */}
      <div className="conversation-list" style={{ padding: '16px' }}>
        {/* Intro banner card matching Screenshot 5 */}
        <div className="wa-community-intro-card">
          <WhatsAppCommunityIllustration size={130} />

          <h2 className="wa-community-intro-title">Stay connected with a community</h2>
          <p className="wa-community-intro-desc">
            Communities bring members together in topic-based groups, and make it easy to get admin
            announcements. Any community you're added to will appear here.
          </p>

          <button
            className="wa-community-link-btn"
            onClick={() => setShowExamples((prev) => !prev)}
          >
            {showExamples ? 'Hide example communities' : 'See example communities'}
          </button>

          <button
            className="wa-start-community-btn"
            onClick={onStartCommunity}
            id="btn-start-community-sidebar"
          >
            Start your community
          </button>
        </div>

        {/* Existing / Example Communities */}
        {showExamples && (
          <div className="wa-community-list" style={{ marginTop: '20px' }}>
            <div className="wa-section-header">Example Communities</div>
            {communities.map((comm) => (
              <div key={comm.id} className="wa-community-item-block">
                <div className="wa-community-item-header">
                  <div
                    className="avatar"
                    style={{ backgroundColor: comm.avatarBg }}
                  >
                    <Users size={18} />
                  </div>
                  <div className="wa-community-item-meta">
                    <span className="wa-community-item-name">{comm.name}</span>
                    <span className="wa-community-item-members">{comm.memberCount} members</span>
                  </div>
                </div>

                {/* Sub groups */}
                <div className="wa-community-subgroups">
                  {comm.groups.map((group) => (
                    <div
                      key={group.id}
                      className="wa-community-subgroup-row"
                      onClick={() => onSelectCommunityGroup?.(group.name)}
                    >
                      <div className="wa-subgroup-info">
                        <span className="wa-subgroup-name">{group.name}</span>
                        <span className="wa-subgroup-desc">{group.description}</span>
                      </div>
                      <ChevronRight size={16} color="var(--text-muted)" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
