package com.chat.contact.dto;

import java.time.Instant;
import java.util.UUID;

public record MatchedContactDto(
    UUID userId,
    String username,
    String displayName,
    String avatarKey,
    String phoneNumber,
    boolean isOnline,
    Instant lastSeenAt
) {}
