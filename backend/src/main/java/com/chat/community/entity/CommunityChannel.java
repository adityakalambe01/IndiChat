package com.chat.community.entity;

import com.chat.conversation.entity.Conversation;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "community_channels")
public class CommunityChannel {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "community_id", nullable = false)
    private Community community;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(name = "is_announcement", nullable = false)
    private boolean isAnnouncement = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public CommunityChannel() {}

    public CommunityChannel(Community community, Conversation conversation, String name, boolean isAnnouncement) {
        this.community = community;
        this.conversation = conversation;
        this.name = name;
        this.isAnnouncement = isAnnouncement;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Community getCommunity() { return community; }
    public void setCommunity(Community community) { this.community = community; }

    public Conversation getConversation() { return conversation; }
    public void setConversation(Conversation conversation) { this.conversation = conversation; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public boolean isAnnouncement() { return isAnnouncement; }
    public void setAnnouncement(boolean announcement) { isAnnouncement = announcement; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

