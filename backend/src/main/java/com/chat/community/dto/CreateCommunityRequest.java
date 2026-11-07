package com.chat.community.dto;

import java.util.List;

public record CreateCommunityRequest(
    String name,
    String description,
    List<String> channelNames
) {}

