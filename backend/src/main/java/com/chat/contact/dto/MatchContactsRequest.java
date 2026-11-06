package com.chat.contact.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record MatchContactsRequest(
    @NotEmpty(message = "Phone numbers list cannot be empty")
    @Size(max = 500, message = "Cannot match more than 500 phone numbers per request")
    List<String> phoneNumbers,
    String defaultRegion
) {}
