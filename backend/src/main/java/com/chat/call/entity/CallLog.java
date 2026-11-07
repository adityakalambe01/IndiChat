package com.chat.call.entity;

import com.chat.conversation.entity.Conversation;
import com.chat.user.entity.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * CallLog represents a personal, client-reported call journal entry.
 * NOTE: These records are client-reported outcomes recorded upon call termination,
 * not server-verified WebRTC signaling transcripts or cryptographic proof.
 */
@Entity
@Table(name = "call_logs")
public class CallLog {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "caller_id", nullable = false)
    private User caller;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "receiver_id", nullable = false)
    private User receiver;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id")
    private Conversation conversation;

    @Column(name = "direction", nullable = false, length = 20)
    private String direction = "outgoing";

    @Column(name = "call_type", nullable = false, length = 20)
    private String callType = "voice";

    @Column(nullable = false, length = 30)
    private String status = "completed";

    @Column(name = "duration_seconds", nullable = false)
    private int durationSeconds = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public CallLog() {}

    public CallLog(User user, User caller, User receiver, Conversation conversation, String direction, String callType, String status, int durationSeconds) {
        this.user = user;
        this.caller = caller;
        this.receiver = receiver;
        this.conversation = conversation;
        this.direction = direction != null ? direction.toLowerCase() : "outgoing";
        this.callType = callType != null ? callType.toLowerCase() : "voice";
        this.status = status != null ? status.toLowerCase() : "completed";
        this.durationSeconds = durationSeconds;
        this.createdAt = Instant.now();
    }

    // Backwards-compatible constructor defaulting ownership to caller and direction to outgoing
    public CallLog(User caller, User receiver, Conversation conversation, String callType, String status, int durationSeconds) {
        this(caller, caller, receiver, conversation, "outgoing", callType, status, durationSeconds);
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public User getCaller() { return caller; }
    public void setCaller(User caller) { this.caller = caller; }

    public User getReceiver() { return receiver; }
    public void setReceiver(User receiver) { this.receiver = receiver; }

    public Conversation getConversation() { return conversation; }
    public void setConversation(Conversation conversation) { this.conversation = conversation; }

    public String getDirection() { return direction; }
    public void setDirection(String direction) { this.direction = direction; }

    public String getCallType() { return callType; }
    public void setCallType(String callType) { this.callType = callType; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(int durationSeconds) { this.durationSeconds = durationSeconds; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
