package com.chat.message.entity;

import com.chat.conversation.entity.Conversation;
import com.chat.user.entity.User;
import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "user_starred_messages")
public class UserStarredMessage {

    @EmbeddedId
    private StarredMessageId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("userId")
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("messageId")
    @JoinColumn(name = "message_id", nullable = false)
    private Message message;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public UserStarredMessage() {}

    public UserStarredMessage(User user, Message message, Conversation conversation) {
        this.id = new StarredMessageId(user.getId(), message.getId());
        this.user = user;
        this.message = message;
        this.conversation = conversation;
        this.createdAt = Instant.now();
    }

    public StarredMessageId getId() { return id; }
    public void setId(StarredMessageId id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Message getMessage() { return message; }
    public void setMessage(Message message) { this.message = message; }

    public Conversation getConversation() { return conversation; }
    public void setConversation(Conversation conversation) { this.conversation = conversation; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    @Embeddable
    public static class StarredMessageId implements Serializable {
        @Column(name = "user_id")
        private UUID userId;

        @Column(name = "message_id")
        private UUID messageId;

        public StarredMessageId() {}

        public StarredMessageId(UUID userId, UUID messageId) {
            this.userId = userId;
            this.messageId = messageId;
        }

        public UUID getUserId() { return userId; }
        public void setUserId(UUID userId) { this.userId = userId; }

        public UUID getMessageId() { return messageId; }
        public void setMessageId(UUID messageId) { this.messageId = messageId; }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            StarredMessageId that = (StarredMessageId) o;
            return Objects.equals(userId, that.userId) && Objects.equals(messageId, that.messageId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId, messageId);
        }
    }
}

