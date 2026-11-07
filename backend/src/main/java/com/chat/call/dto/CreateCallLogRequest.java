package com.chat.call.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import java.util.UUID;

public record CreateCallLogRequest(
    UUID peerUserId,
    UUID callerId,
    UUID receiverId,
    UUID conversationId,
    String direction,
    @JsonAlias({"type"}) String callType,
    String status,
    Integer durationSeconds
) {
    // Backwards compatibility convenience constructor
    public CreateCallLogRequest(
        UUID receiverId,
        UUID conversationId,
        String callType,
        String status,
        int durationSeconds
    ) {
        this(null, null, receiverId, conversationId, "outgoing", callType, status, durationSeconds);
    }
}
