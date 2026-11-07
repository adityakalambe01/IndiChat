package com.chat.auth.entity;

import com.chat.user.entity.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_passkey_credentials")
public class UserPasskeyCredential {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "credential_id", nullable = false, unique = true, columnDefinition = "TEXT")
    private String credentialId;

    @Column(name = "public_key_cose")
    private byte[] publicKeyCose;

    @Column(name = "public_key_pem", columnDefinition = "TEXT")
    private String publicKeyPem;

    @Column(name = "sign_count", nullable = false)
    private long signCount = 0;

    @Column(columnDefinition = "TEXT")
    private String transports;

    @Column(nullable = false, length = 100)
    private String nickname = "Passkey";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    public UserPasskeyCredential() {}

    public UserPasskeyCredential(User user, String credentialId, String publicKeyPem, String nickname) {
        this.user = user;
        this.credentialId = credentialId;
        this.publicKeyPem = publicKeyPem;
        this.nickname = nickname != null ? nickname : "Passkey";
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getCredentialId() { return credentialId; }
    public void setCredentialId(String credentialId) { this.credentialId = credentialId; }

    public byte[] getPublicKeyCose() { return publicKeyCose; }
    public void setPublicKeyCose(byte[] publicKeyCose) { this.publicKeyCose = publicKeyCose; }

    public String getPublicKeyPem() { return publicKeyPem; }
    public void setPublicKeyPem(String publicKeyPem) { this.publicKeyPem = publicKeyPem; }

    public long getSignCount() { return signCount; }
    public void setSignCount(long signCount) { this.signCount = signCount; }

    public String getTransports() { return transports; }
    public void setTransports(String transports) { this.transports = transports; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getLastUsedAt() { return lastUsedAt; }
    public void setLastUsedAt(Instant lastUsedAt) { this.lastUsedAt = lastUsedAt; }
}

