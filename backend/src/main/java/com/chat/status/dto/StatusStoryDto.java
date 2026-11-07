package com.chat.status.dto;

import com.chat.status.entity.UserStatusStory;
import com.chat.user.dto.UserDto;
import java.time.Instant;
import java.util.UUID;

public record StatusStoryDto(
    UUID id,
    UUID userId,
    String mediaUrl,
    String mediaType,
    String caption,
    Instant createdAt,
    Instant expiresAt,
    UserDto user
) {
    public static StatusStoryDto fromEntity(UserStatusStory s) {
        return new StatusStoryDto(
            s.getId(),
            s.getUser().getId(),
            s.getMediaUrl(),
            s.getMediaType(),
            s.getCaption(),
            s.getCreatedAt(),
            s.getExpiresAt(),
            UserDto.fromEntity(s.getUser(), false)
        );
    }
}

