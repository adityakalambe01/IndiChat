package com.chat.call.dto;

import com.chat.call.entity.CallLog;
import com.chat.user.dto.UserDto;
import com.chat.user.entity.User;
import java.time.Instant;
import java.util.UUID;

public record CallLogDto(
    UUID id,
    UUID userId,
    UUID callerId,
    UUID receiverId,
    UUID peerId,
    UUID conversationId,
    String direction,
    String callType,
    String status,
    int durationSeconds,
    Instant createdAt,
    UserDto caller,
    UserDto receiver,
    UserDto peer
) {
    public static CallLogDto fromEntity(CallLog c) {
        UUID ownerId = c.getUser() != null ? c.getUser().getId() : c.getCaller().getId();
        boolean isOutgoing = "outgoing".equalsIgnoreCase(c.getDirection());
        User peerUser = isOutgoing ? c.getReceiver() : c.getCaller();
        UUID peerId = peerUser != null ? peerUser.getId() : null;

        return new CallLogDto(
            c.getId(),
            ownerId,
            c.getCaller().getId(),
            c.getReceiver().getId(),
            peerId,
            c.getConversation() != null ? c.getConversation().getId() : null,
            c.getDirection() != null ? c.getDirection().toLowerCase() : "outgoing",
            c.getCallType() != null ? c.getCallType().toLowerCase() : "voice",
            c.getStatus() != null ? c.getStatus().toLowerCase() : "completed",
            c.getDurationSeconds(),
            c.getCreatedAt(),
            UserDto.fromEntity(c.getCaller(), false),
            UserDto.fromEntity(c.getReceiver(), false),
            peerUser != null ? UserDto.fromEntity(peerUser, false) : null
        );
    }
}
