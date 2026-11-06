import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Send, Pause, Play } from 'lucide-react';
import { UserStatus } from '../../data/statusData';

interface StatusViewerModalProps {
  status: UserStatus | null;
  onClose: () => void;
  onSendReply?: (text: string, statusUserName: string) => void;
}

export const StatusViewerModal: React.FC<StatusViewerModalProps> = ({
  status,
  onClose,
  onSendReply,
}) => {
  if (!status || status.stories.length === 0) return null;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const currentStory = status.stories[currentIndex];

  const STORY_DURATION = (currentStory.duration || 6) * 1000; // ms

  useEffect(() => {
    setProgress(0);
    if (isPaused) return;

    const intervalMs = 50;
    const step = (intervalMs / STORY_DURATION) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          if (currentIndex + 1 < status.stories.length) {
            setCurrentIndex((idx) => idx + 1);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return prev + step;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [currentIndex, isPaused, status.stories.length, STORY_DURATION, onClose]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex((idx) => idx - 1);
      setProgress(0);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex + 1 < status.stories.length) {
      setCurrentIndex((idx) => idx + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    if (onSendReply) {
      onSendReply(replyText.trim(), status.userName);
    }
    setReplyText('');
    alert(`Reply sent to ${status.userName}: "${replyText.trim()}"`);
  };

  return (
    <div
      className="wa-status-viewer-backdrop"
      onMouseDown={() => setIsPaused(true)}
      onMouseUp={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <div className="wa-status-viewer-container" onClick={(e) => e.stopPropagation()}>
        {/* Top Progress Bars */}
        <div className="wa-status-progress-row">
          {status.stories.map((story, idx) => {
            let widthPercent = 0;
            if (idx < currentIndex) widthPercent = 100;
            else if (idx === currentIndex) widthPercent = progress;

            return (
              <div key={story.id} className="wa-status-progress-track">
                <div
                  className="wa-status-progress-fill"
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Status Header */}
        <div className="wa-status-viewer-header">
          <div className="wa-status-viewer-user">
            <div className="avatar wa-status-avatar-mini">
              {status.userName.charAt(0).toUpperCase()}
            </div>
            <div className="wa-status-viewer-user-text">
              <span className="wa-status-viewer-name">{status.userName}</span>
              <span className="wa-status-viewer-time">{currentStory.timestamp || status.timeAgo}</span>
            </div>
          </div>

          <div className="wa-status-viewer-actions">
            <button
              className="icon-btn"
              onClick={() => setIsPaused((prev) => !prev)}
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? <Play size={20} color="#ffffff" /> : <Pause size={20} color="#ffffff" />}
            </button>
            <button className="icon-btn" onClick={onClose} title="Close" aria-label="Close">
              <X size={24} color="#ffffff" />
            </button>
          </div>
        </div>

        {/* Story Body */}
        <div className="wa-status-viewer-body">
          {currentStory.type === 'image' ? (
            <div className="wa-status-image-wrapper">
              <img
                src={currentStory.content}
                alt={currentStory.caption || 'Status story'}
                className="wa-status-image"
              />
              {currentStory.caption && (
                <div className="wa-status-caption-bar">{currentStory.caption}</div>
              )}
            </div>
          ) : (
            <div
              className="wa-status-text-slide"
              style={{ backgroundColor: currentStory.bgColor || '#065f46' }}
            >
              <p className="wa-status-quote-text">{currentStory.content}</p>
            </div>
          )}

          {/* Nav tap areas */}
          <button className="wa-status-nav-btn prev" onClick={handlePrev} aria-label="Previous story">
            <ChevronLeft size={32} />
          </button>
          <button className="wa-status-nav-btn next" onClick={handleNext} aria-label="Next story">
            <ChevronRight size={32} />
          </button>
        </div>

        {/* Bottom Reply Bar */}
        <form className="wa-status-reply-bar" onSubmit={handleSend}>
          <input
            type="text"
            placeholder={`Reply to ${status.userName}...`}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onFocus={() => setIsPaused(true)}
            onBlur={() => setIsPaused(false)}
            className="wa-status-reply-input"
          />
          <button type="submit" className="wa-status-reply-submit" disabled={!replyText.trim()}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};
