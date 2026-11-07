import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, ArrowRight, Trash2 } from 'lucide-react';
import { Message, User } from '@chat/shared-types';
import { api } from '../../services/api';

interface StarredSidebarProps {
  currentUser: User;
  onSelectConversation: (conversationId: string) => void;
}

export const StarredSidebar: React.FC<StarredSidebarProps> = ({
  currentUser,
  onSelectConversation,
}) => {
  const [starredMessages, setStarredMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStarredMessages()
      .then((msgs) => setStarredMessages(msgs))
      .catch((err) => {
        console.warn('Failed to load starred messages:', err);
        setStarredMessages([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleUnstar = async (msgId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.toggleStarMessage(msgId);
      setStarredMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch (err) {
      console.error('Failed to unstar message:', err);
    }
  };

  return (
    <aside className="sidebar" id="sidebarView-starred">
      <div className="wa-sidebar-header">
        <h1 className="wa-header-title">Starred Messages</h1>
      </div>

      <div className="conversation-list" style={{ padding: '12px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-sec)' }}>
            Loading starred messages...
          </div>
        ) : starredMessages.length === 0 ? (
          <div className="wa-empty-list-notice" style={{ padding: '32px 16px', textAlign: 'center' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px auto',
              color: 'var(--accent-warning, #f59e0b)'
            }}>
              <Star size={28} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
              No starred messages
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-sec)', lineHeight: '1.4' }}>
              Star important messages in any chat to view them here later.
            </p>
          </div>
        ) : (
          starredMessages.map((msg) => {
            const senderName = msg.sender?.displayName || msg.sender?.username || (msg.senderId === currentUser.id ? 'You' : 'Sender');
            return (
              <div
                key={msg.id}
                className="starred-message-card"
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md, 10px)',
                  padding: '12px',
                  marginBottom: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand-teal)' }}>
                    {senderName}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-sec)' }}>
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                    </span>
                    <button
                      onClick={(e) => handleUnstar(msg.id, e)}
                      title="Remove star"
                      style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.4' }}>
                  {msg.content}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    className="jump-to-chat-btn"
                    data-jump-contact={msg.conversationId}
                    onClick={() => onSelectConversation(msg.conversationId)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--brand-teal)',
                      cursor: 'pointer'
                    }}
                  >
                    <span>Jump to Chat</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

