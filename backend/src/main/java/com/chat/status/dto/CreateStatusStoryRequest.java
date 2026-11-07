package com.chat.status.dto;

public record CreateStatusStoryRequest(
    String mediaUrl,
    String mediaType,
    String caption
) {}

