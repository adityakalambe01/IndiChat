package com.chat.community.dto;

import com.chat.community.entity.CommunityChannel;
import java.time.Instant;
import java.util.UUID;

public record CommunityChannelDto(
    UUID id,
    UUID communityId,
    UUID conversationId,
    String name,
    boolean isAnnouncement,
    Instant createdAt
) {
    public static CommunityChannelDto fromEntity(CommunityChannel c) {
        return new CommunityChannelDto(
            c.getId(),
            c.getCommunity().getId(),
            c.getConversation().getId(),
            c.getName(),
            c.isAnnouncement(),
            c.getCreatedAt()
        );
    }
}

