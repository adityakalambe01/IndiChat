import React, { useState } from 'react';
import { ChannelItem, ChannelPost } from '../../data/channelData';
import { Share2, Bell, Check, ChevronLeft } from 'lucide-react';

interface ChannelFeedViewProps {
  channel: ChannelItem;
  onBack: () => void;
}

export const ChannelFeedView: React.FC<ChannelFeedViewProps> = ({ channel, onBack }) => {
  const [posts, setPosts] = useState<ChannelPost[]>(channel.posts);
  const [isFollowing, setIsFollowing] = useState(channel.isFollowed);

  const handleReact = (postId: string, emoji: string) => {
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id === postId) {
          const reactions = [...post.reactions];
          const existing = reactions.find((r) => r.emoji === emoji);
          if (existing) {
            existing.count += 1;
          } else {
            reactions.push({ emoji, count: 1 });
          }
          return { ...post, reactions };
        }
        return post;
      })
    );
  };

  return (
    <main className="chat-area wa-channel-feed-area">
      {/* Channel Header */}
      <header className="chat-header">
        <div className="chat-header-info">
          <button className="icon-btn" onClick={onBack} aria-label="Back">
            <ChevronLeft size={22} />
          </button>

          <div
            className="avatar"
            style={{ backgroundColor: channel.avatarBg, fontWeight: 700 }}
          >
            {channel.avatarLetter}
          </div>

          <div className="chat-header-details">
            <h2 className="chat-header-name" style={{ margin: 0, fontSize: '1rem' }}>
              {channel.name}
            </h2>
            <span className="chat-header-status">
              {channel.followers || 'Channel'} • Official
            </span>
          </div>
        </div>

        <div className="sidebar-actions">
          <button
            className={`wa-follow-btn ${isFollowing ? 'following' : ''}`}
            onClick={() => setIsFollowing((prev) => !prev)}
            style={{ marginRight: '8px' }}
          >
            {isFollowing ? (
              <>
                <Check size={14} style={{ marginRight: '4px' }} />
                Following
              </>
            ) : (
              'Follow'
            )}
          </button>

          <button
            className="icon-btn"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              alert('Channel link copied to clipboard!');
            }}
            title="Share channel"
          >
            <Share2 size={20} />
          </button>
        </div>
      </header>

      {/* Feed Posts */}
      <div className="messages-container wa-channel-posts-scroll">
        {channel.description && (
          <div className="wa-channel-desc-banner">
            <p>{channel.description}</p>
          </div>
        )}

        {posts.map((post) => (
          <div key={post.id} className="wa-channel-post-card">
            {post.imageUrl && (
              <img
                src={post.imageUrl}
                alt="Channel update"
                className="wa-channel-post-img"
              />
            )}

            <div className="wa-channel-post-text">{post.content}</div>

            <div className="wa-channel-post-footer">
              <div className="wa-channel-reactions-row">
                {post.reactions.map((r, i) => (
                  <button
                    key={i}
                    className="wa-channel-reaction-chip"
                    onClick={() => handleReact(post.id, r.emoji)}
                  >
                    <span>{r.emoji}</span>
                    <span className="wa-reaction-count">{r.count}</span>
                  </button>
                ))}
                <button
                  className="wa-channel-reaction-add"
                  onClick={() => handleReact(post.id, '❤️')}
                  title="React"
                >
                  +
                </button>
              </div>

              <div className="wa-channel-post-meta">
                {post.views && <span>{post.views} views • </span>}
                <span>{post.timestamp}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
};
