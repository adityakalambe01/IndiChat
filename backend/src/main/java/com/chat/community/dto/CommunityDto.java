package com.chat.community.dto;

import com.chat.community.entity.Community;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CommunityDto(
    UUID id,
    String name,
    String description,
    String avatarKey,
    UUID createdBy,
    Instant createdAt,
    Instant updatedAt,
    List<CommunityChannelDto> channels,
    int memberCount
) {
    public static CommunityDto fromEntity(Community c, List<CommunityChannelDto> channels, int memberCount) {
        return new CommunityDto(
            c.getId(),
            c.getName(),
            c.getDescription(),
            c.getAvatarKey(),
            c.getCreatedBy().getId(),
            c.getCreatedAt(),
            c.getUpdatedAt(),
            channels != null ? channels : List.of(),
            memberCount
        );
    }
}

