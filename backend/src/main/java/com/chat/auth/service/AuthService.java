package com.chat.auth.service;

import com.chat.auth.dto.*;
import com.chat.auth.entity.RefreshToken;
import com.chat.auth.repository.RefreshTokenRepository;
import com.chat.device.service.UserLinkedDeviceService;
import com.chat.security.JwtTokenProvider;
import com.chat.settings.entity.UserSettings;
import com.chat.settings.repository.UserSettingsRepository;
import com.chat.user.dto.UserDto;
import com.chat.user.entity.User;
import com.chat.user.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final UserSettingsRepository userSettingsRepository;
    private final UserLinkedDeviceService linkedDeviceService;

    public AuthService(
        UserRepository userRepository,
        RefreshTokenRepository refreshTokenRepository,
        PasswordEncoder passwordEncoder,
        JwtTokenProvider tokenProvider,
        UserSettingsRepository userSettingsRepository,
        UserLinkedDeviceService linkedDeviceService
    ) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
        this.userSettingsRepository = userSettingsRepository;
        this.linkedDeviceService = linkedDeviceService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        return register(req, null);
    }

    @Transactional
    public AuthResponse login(LoginRequest req) {
        return login(req, null);
    }

    @Transactional
    public AuthResponse register(RegisterRequest req, HttpServletRequest servletRequest) {
        if (userRepository.findByUsername(req.username()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already taken");
        }
        if (req.email() != null && !req.email().isBlank() && userRepository.findByEmail(req.email()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }
        if (req.phoneNumber() != null && !req.phoneNumber().isBlank() && userRepository.findByPhoneNumber(req.phoneNumber()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Phone number already registered");
        }

        String encodedPassword = passwordEncoder.encode(req.password());
        User user = new User(req.username(), req.email(), req.phoneNumber(), encodedPassword, req.displayName());
        user = userRepository.saveAndFlush(user);

        // Record initial device session
        recordDeviceLogin(user, null, null, null, null, null, servletRequest);

        return createAuthResponse(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest req, HttpServletRequest servletRequest) {
        User user = userRepository.findByUsernameOrEmail(req.usernameOrEmail())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password"));

        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }

        // Check Two-Step Verification (2FA)
        UserSettings settings = userSettingsRepository.findById(user.getId()).orElse(null);
        if (settings != null && settings.isTwoFactorEnabled()) {
            if (req.twoFactorPin() == null || req.twoFactorPin().trim().isEmpty()) {
                return AuthResponse.twoFactorRequired("Two-step verification PIN required");
            }

            String configuredPin = settings.getTwoFactorPin();
            if (configuredPin == null || configuredPin.isBlank() || !configuredPin.trim().equals(req.twoFactorPin().trim())) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Incorrect 6-digit two-step verification PIN");
            }
        }

        user.setLastSeenAt(Instant.now());
        userRepository.save(user);

        // Record or update linked device session
        recordDeviceLogin(
            user,
            req.deviceId(),
            req.deviceName(),
            req.platform(),
            req.browser(),
            null,
            servletRequest
        );

        return createAuthResponse(user);
    }

    @Transactional
    public AuthTokens refreshToken(RefreshRequest req) {
        String token = req.refreshToken();
        if (!tokenProvider.validateToken(token)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token");
        }

        RefreshToken refreshToken = refreshTokenRepository.findByTokenHash(token)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token not found"));

        if (refreshToken.isRevoked() || refreshToken.getExpiresAt().isBefore(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token expired or revoked");
        }

        User user = refreshToken.getUser();
        String newAccessToken = tokenProvider.generateAccessToken(user.getId(), user.getUsername(), user.getDisplayName());
        String newRefreshToken = tokenProvider.generateRefreshToken(user.getId());

        // Revoke old and save new
        refreshToken.setRevoked(true);
        refreshTokenRepository.save(refreshToken);

        RefreshToken nextToken = new RefreshToken(user, newRefreshToken, Instant.now().plus(7, ChronoUnit.DAYS));
        refreshTokenRepository.save(nextToken);

        return new AuthTokens(newAccessToken, newRefreshToken, "Bearer", tokenProvider.getExpirationMs());
    }

    @Transactional
    public UUID logout(UUID userId, String deviceIdStr, HttpServletRequest request) {
        if (userId == null && request != null) {
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                try {
                    if (tokenProvider.validateToken(token)) {
                        userId = tokenProvider.getUserIdFromToken(token);
                    }
                } catch (Exception ignored) {}
            }
        }

        UUID deviceUuid = null;
        if (deviceIdStr != null && !deviceIdStr.isBlank()) {
            try {
                deviceUuid = UUID.fromString(deviceIdStr.trim());
            } catch (Exception ignored) {}
        }
        if (deviceUuid == null && request != null) {
            String headerDevId = request.getHeader("X-Device-Id");
            if (headerDevId != null && !headerDevId.isBlank()) {
                try {
                    deviceUuid = UUID.fromString(headerDevId.trim());
                } catch (Exception ignored) {}
            }
        }

        if (userId != null) {
            if (deviceUuid != null) {
                linkedDeviceService.removeDevice(userId, deviceUuid);
                log.info("Removed device {} for user {} on logout", deviceUuid, userId);
            }
            refreshTokenRepository.deleteByUserId(userId);
            log.info("Revoked refresh tokens for user {} on logout", userId);
        }

        return userId;
    }

    private void recordDeviceLogin(
        User user,
        String deviceIdStr,
        String deviceName,
        String platform,
        String browser,
        String ipAddress,
        HttpServletRequest servletRequest
    ) {
        try {
            UUID deviceUuid = null;
            if (deviceIdStr != null && !deviceIdStr.isBlank()) {
                try {
                    deviceUuid = UUID.fromString(deviceIdStr.trim());
                } catch (Exception ignored) {}
            }
            if (deviceUuid == null && servletRequest != null) {
                String headerDevId = servletRequest.getHeader("X-Device-Id");
                if (headerDevId != null && !headerDevId.isBlank()) {
                    try {
                        deviceUuid = UUID.fromString(headerDevId.trim());
                    } catch (Exception ignored) {}
                }
            }
            if (deviceUuid == null) {
                deviceUuid = UUID.randomUUID();
            }

            if ((deviceName == null || deviceName.isBlank()) && servletRequest != null) {
                deviceName = servletRequest.getHeader("X-Device-Name");
            }
            if ((platform == null || platform.isBlank()) && servletRequest != null) {
                platform = servletRequest.getHeader("X-Device-Platform");
            }
            if ((browser == null || browser.isBlank()) && servletRequest != null) {
                browser = servletRequest.getHeader("X-Device-Browser");
            }
            if (ipAddress == null && servletRequest != null) {
                ipAddress = servletRequest.getHeader("X-Forwarded-For");
                if (ipAddress == null || ipAddress.isBlank()) {
                    ipAddress = servletRequest.getRemoteAddr();
                }
            }

            linkedDeviceService.registerOrUpdateDevice(user, deviceUuid, deviceName, platform, browser, ipAddress);
        } catch (Exception e) {
            log.warn("Failed to record device session: {}", e.getMessage());
        }
    }

    private AuthResponse createAuthResponse(User user) {
        String accessToken = tokenProvider.generateAccessToken(user.getId(), user.getUsername(), user.getDisplayName());
        String refreshTokenStr = tokenProvider.generateRefreshToken(user.getId());

        RefreshToken refreshToken = new RefreshToken(user, refreshTokenStr, Instant.now().plus(7, ChronoUnit.DAYS));
        refreshTokenRepository.save(refreshToken);

        AuthTokens tokens = new AuthTokens(accessToken, refreshTokenStr, "Bearer", tokenProvider.getExpirationMs());
        UserDto userDto = UserDto.fromEntity(user, true);

        return new AuthResponse(tokens, userDto);
    }
}
