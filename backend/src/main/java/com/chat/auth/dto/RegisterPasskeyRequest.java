package com.chat.auth.dto;

public record RegisterPasskeyRequest(
    String credentialId,
    String publicKey,
    String nickname
) {}

