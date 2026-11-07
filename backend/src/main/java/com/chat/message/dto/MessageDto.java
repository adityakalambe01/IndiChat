package com.chat.message.dto;

import com.chat.message.entity.Message;
import com.chat.user.dto.UserDto;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record MessageDto(
    UUID id,
    UUID conversationId,
    UUID senderId,
    UUID clientMessageId,
    String type,
    String content,
    UUID replyToId,
    Instant createdAt,
    Instant editedAt,
    Instant deletedAt,
    UserDto sender,
    List<MessageReceiptDto> receipts,
    List<MessageReactionDto> reactions,
    List<ReactionSummaryDto> reactionSummaries,
    Boolean isStarred
) {
    public MessageDto(
        UUID id,
        UUID conversationId,
        UUID senderId,
        UUID clientMessageId,
        String type,
        String content,
        UUID replyToId,
        Instant createdAt,
        Instant editedAt,
        Instant deletedAt,
        UserDto sender,
        List<MessageReceiptDto> receipts
    ) {
        this(id, conversationId, senderId, clientMessageId, type, content, replyToId,
             createdAt, editedAt, deletedAt, sender, receipts, List.of(), List.of(), false);
    }

    public static MessageDto fromEntity(Message message, List<MessageReceiptDto> receipts, boolean senderOnline) {
        return fromEntity(message, receipts, senderOnline, List.of(), List.of(), false);
    }

    public static MessageDto fromEntity(
        Message message,
        List<MessageReceiptDto> receipts,
        boolean senderOnline,
        List<MessageReactionDto> reactions,
        List<ReactionSummaryDto> reactionSummaries,
        boolean isStarred
    ) {
        return new MessageDto(
            message.getId(),
            message.getConversation().getId(),
            message.getSender().getId(),
            message.getClientMessageId(),
            message.getType(),
            message.getContent(),
            message.getReplyToId(),
            message.getCreatedAt(),
            message.getEditedAt(),
            message.getDeletedAt(),
            UserDto.fromEntity(message.getSender(), senderOnline),
            receipts != null ? receipts : List.of(),
            reactions != null ? reactions : List.of(),
            reactionSummaries != null ? reactionSummaries : List.of(),
            isStarred
        );
    }
}
