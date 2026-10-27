import React from 'react';
import { Radio, Plus, Compass } from 'lucide-react';

interface ChannelsEmptyStateProps {
  onCreateChannel: () => void;
  onExploreChannels: () => void;
}

export const ChannelsEmptyState: React.FC<ChannelsEmptyStateProps> = ({
  onCreateChannel,
  onExploreChannels,
}) => {
  return (
    <div className="wa-empty-container">
      {/* Channels Icon */}
      <div className="wa-channels-empty-icon">
        <Radio size={54} color="#8696a0" />
      </div>

      <h1 className="wa-empty-title">Discover channels</h1>
      <p className="wa-empty-desc">
        Entertainment, sports, news, lifestyle, people and more. Follow the channels that interest you
      </p>

      {/* Action buttons: + Create channel & Explore channels */}
      <div className="wa-channels-actions-row">
        <button
          className="wa-calls-btn-dark"
          onClick={onCreateChannel}
          id="btn-create-channel"
        >
          <Plus size={18} />
          <span>Create channel</span>
        </button>

        <button
          className="wa-calls-btn-dark"
          onClick={onExploreChannels}
          id="btn-explore-channels"
        >
          <Compass size={18} />
          <span>Explore channels</span>
        </button>
      </div>
    </div>
  );
};
