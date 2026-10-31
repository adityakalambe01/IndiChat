import React, { useState } from 'react';
import { Search, Plus, Check } from 'lucide-react';
import { INITIAL_CHANNELS, SUGGESTED_CHANNELS, ChannelItem } from '../../data/channelData';

interface ChannelsSidebarProps {
  selectedChannelId: string | null;
  onSelectChannel: (channel: ChannelItem) => void;
  onCreateChannel: () => void;
}

export const ChannelsSidebar: React.FC<ChannelsSidebarProps> = ({
  selectedChannelId,
  onSelectChannel,
  onCreateChannel,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [channels, setChannels] = useState<ChannelItem[]>(INITIAL_CHANNELS);
  const [suggested, setSuggested] = useState<ChannelItem[]>(SUGGESTED_CHANNELS);

  const filteredChannels = channels.filter((ch) =>
    ch.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFollowToggle = (suggId: string) => {
    const item = suggested.find((s) => s.id === suggId);
    if (!item) return;

    if (item.isFollowed) {
      setSuggested((prev) =>
        prev.map((s) => (s.id === suggId ? { ...s, isFollowed: false } : s))
      );
      setChannels((prev) => prev.filter((c) => c.id !== suggId));
    } else {
      const followedItem = { ...item, isFollowed: true, timeStr: 'Just now' };
      setSuggested((prev) =>
        prev.map((s) => (s.id === suggId ? { ...s, isFollowed: true } : s))
      );
      setChannels((prev) => [followedItem, ...prev]);
    }
  };

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="wa-sidebar-header">
        <h1 className="wa-header-title">Channels</h1>

        <div className="wa-header-actions">
          <button
            className="icon-btn"
            onClick={onCreateChannel}
            title="Create channel"
            aria-label="Create channel"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="sidebar-search">
        <div className="search-input-wrapper">
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Channels List */}
      <div className="conversation-list">
        {filteredChannels.map((channel) => {
          const isSelected = channel.id === selectedChannelId;

          return (
            <div
              key={channel.id}
              className={`conversation-item ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectChannel(channel)}
            >
              <div
                className="avatar"
                style={{ backgroundColor: channel.avatarBg, fontWeight: 700 }}
              >
                {channel.avatarLetter}
              </div>

              <div className="conversation-content">
                <div className="conversation-row">
                  <span className="conversation-title">{channel.name}</span>
                  <span className="conversation-time">{channel.timeStr}</span>
                </div>

                <div className="conversation-subtitle">
                  <span className="wa-channel-snippet">{channel.lastUpdateSnippet}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Find Channels to Follow Section */}
        <div className="wa-section-header" style={{ marginTop: '20px' }}>
          Find channels to follow
        </div>

        {suggested.map((sugg) => (
          <div key={sugg.id} className="wa-suggested-channel-item">
            <div
              className="avatar"
              style={{ backgroundColor: sugg.avatarBg, fontWeight: 700 }}
            >
              {sugg.avatarLetter}
            </div>

            <div className="wa-suggested-channel-info">
              <span className="wa-suggested-channel-name">{sugg.name}</span>
              <span className="wa-suggested-channel-followers">{sugg.followers}</span>
            </div>

            <button
              className={`wa-follow-btn ${sugg.isFollowed ? 'following' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleFollowToggle(sugg.id);
              }}
            >
              {sugg.isFollowed ? (
                <>
                  <Check size={14} style={{ marginRight: '4px' }} />
                  Following
                </>
              ) : (
                'Follow'
              )}
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
};
