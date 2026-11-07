package com.chat.message.dto;

import com.chat.message.entity.MessageReaction;
import com.chat.user.dto.UserDto;
import java.time.Instant;
import java.util.UUID;

public record MessageReactionDto(
    UUID id,
    UUID messageId,
    UUID userId,
    String emoji,
    Instant createdAt,
    UserDto user
) {
    public static MessageReactionDto fromEntity(MessageReaction r) {
        return new MessageReactionDto(
            r.getId(),
            r.getMessage().getId(),
            r.getUser().getId(),
            r.getEmoji(),
            r.getCreatedAt(),
            UserDto.fromEntity(r.getUser(), false)
        );
    }
}

