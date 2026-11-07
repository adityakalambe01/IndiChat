package com.chat.community.entity;

import com.chat.user.entity.User;
import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "community_members")
public class CommunityMember {

    @EmbeddedId
    private CommunityMemberId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("communityId")
    @JoinColumn(name = "community_id", nullable = false)
    private Community community;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("userId")
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 30)
    private String role = "MEMBER";

    @Column(name = "joined_at", nullable = false, updatable = false)
    private Instant joinedAt = Instant.now();

    public CommunityMember() {}

    public CommunityMember(Community community, User user, String role) {
        this.id = new CommunityMemberId(community.getId(), user.getId());
        this.community = community;
        this.user = user;
        this.role = role != null ? role : "MEMBER";
        this.joinedAt = Instant.now();
    }

    public CommunityMemberId getId() { return id; }
    public void setId(CommunityMemberId id) { this.id = id; }

    public Community getCommunity() { return community; }
    public void setCommunity(Community community) { this.community = community; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public Instant getJoinedAt() { return joinedAt; }
    public void setJoinedAt(Instant joinedAt) { this.joinedAt = joinedAt; }

    @Embeddable
    public static class CommunityMemberId implements Serializable {
        @Column(name = "community_id")
        private UUID communityId;

        @Column(name = "user_id")
        private UUID userId;

        public CommunityMemberId() {}

        public CommunityMemberId(UUID communityId, UUID userId) {
            this.communityId = communityId;
            this.userId = userId;
        }

        public UUID getCommunityId() { return communityId; }
        public void setCommunityId(UUID communityId) { this.communityId = communityId; }

        public UUID getUserId() { return userId; }
        public void setUserId(UUID userId) { this.userId = userId; }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            CommunityMemberId that = (CommunityMemberId) o;
            return Objects.equals(communityId, that.communityId) && Objects.equals(userId, that.userId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(communityId, userId);
        }
    }
}

