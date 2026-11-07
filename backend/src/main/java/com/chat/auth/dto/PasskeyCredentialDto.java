package com.chat.auth.dto;

import com.chat.auth.entity.UserPasskeyCredential;
import java.time.Instant;

public record PasskeyCredentialDto(
    String id,
    String nickname,
    Instant createdAt,
    Instant lastUsedAt
) {
    public static PasskeyCredentialDto fromEntity(UserPasskeyCredential c) {
        return new PasskeyCredentialDto(
            c.getCredentialId(),
            c.getNickname(),
            c.getCreatedAt(),
            c.getLastUsedAt()
        );
    }
}

