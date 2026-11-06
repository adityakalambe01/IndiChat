package com.chat.contact.dto;

import java.util.List;

public record MatchContactsResponse(
    List<MatchedContactDto> matches,
    int matchedCount
) {}
