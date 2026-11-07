package com.chat.message.dto;

import java.util.List;
import java.util.UUID;

public record ReactionSummaryDto(
    String emoji,
    int count,
    List<UUID> userIds
) {}

