package com.chat.user.service;

import com.chat.auth.dto.PasskeyCredentialDto;
import com.chat.auth.dto.RegisterPasskeyRequest;
import com.chat.auth.entity.UserPasskeyCredential;
import com.chat.auth.repository.UserPasskeyCredentialRepository;
import com.chat.presence.PresenceService;
import com.chat.settings.entity.UserSettings;
import com.chat.settings.repository.UserSettingsRepository;
import com.chat.user.dto.UpdateUserProfileRequest;
import com.chat.user.dto.UserDto;
import com.chat.user.entity.User;
import com.chat.user.repository.UserRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PresenceService presenceService;
    private final PasswordEncoder passwordEncoder;
    private final UserSettingsRepository settingsRepository;
    private final UserPasskeyCredentialRepository passkeyRepository;

    public UserService(
        UserRepository userRepository,
        PresenceService presenceService,
        @Lazy PasswordEncoder passwordEncoder,
        UserSettingsRepository settingsRepository,
        UserPasskeyCredentialRepository passkeyRepository
    ) {
        this.userRepository = userRepository;
        this.presenceService = presenceService;
        this.passwordEncoder = passwordEncoder;
        this.settingsRepository = settingsRepository;
        this.passkeyRepository = passkeyRepository;
    }

    @Transactional(readOnly = true)
    public UserDto getUserProfile(UUID userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        boolean online = presenceService.isUserOnline(userId);
        return UserDto.fromEntity(user, online);
    }

    @Transactional
    public UserDto updateUserProfile(UUID userId, UpdateUserProfileRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (request.displayName() != null && !request.displayName().trim().isEmpty()) {
            user.setDisplayName(request.displayName().trim());
        }

        if (request.username() != null && !request.username().trim().isEmpty()) {
            String newUsername = request.username().trim().toLowerCase();
            userRepository.findByUsername(newUsername)
                .filter(u -> !u.getId().equals(userId))
                .ifPresent(u -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already taken");
                });
            user.setUsername(newUsername);
        }

        if (request.email() != null && !request.email().trim().isEmpty()) {
            String newEmail = request.email().trim().toLowerCase();
            userRepository.findByEmail(newEmail)
                .filter(u -> !u.getId().equals(userId))
                .ifPresent(u -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already in use");
                });
            user.setEmail(newEmail);
        }

        if (request.phoneNumber() != null && !request.phoneNumber().trim().isEmpty()) {
            String newPhone = request.phoneNumber().trim();
            userRepository.findByPhoneNumber(newPhone)
                .filter(u -> !u.getId().equals(userId))
                .ifPresent(u -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Phone number already in use");
                });
            user.setPhoneNumber(newPhone);
        }

        user.setUpdatedAt(Instant.now());
        User saved = userRepository.save(user);
        boolean online = presenceService.isUserOnline(userId);
        return UserDto.fromEntity(saved, online);
    }

    @Transactional
    public void changePassword(UUID userId, String currentPassword, String newPassword) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password does not match");
        }

        if (newPassword == null || newPassword.length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New password must be at least 6 characters");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);
    }

    @Transactional
    public void updatePasskey(UUID userId, boolean enabled) {
        UserSettings s = settingsRepository.findById(userId).orElseGet(() -> {
            if (!userRepository.existsById(userId)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
            }
            return new UserSettings(userId);
        });
        s.setPasskeyEnabled(enabled);
        s.setUpdatedAt(Instant.now());
        settingsRepository.save(s);
    }

    @Transactional
    public void updateTwoFactor(UUID userId, boolean enabled, String pin) {
        UserSettings s = settingsRepository.findById(userId).orElseGet(() -> {
            if (!userRepository.existsById(userId)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
            }
            return new UserSettings(userId);
        });
        s.setTwoFactorEnabled(enabled);
        if (enabled) {
            if (pin != null && !pin.isBlank()) {
                s.setTwoFactorPin(pin.trim());
            }
        } else {
            s.setTwoFactorPin(null);
        }
        s.setUpdatedAt(Instant.now());
        settingsRepository.save(s);
    }

    @Transactional(readOnly = true)
    public List<PasskeyCredentialDto> getUserPasskeys(UUID userId) {
        return passkeyRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
            .map(PasskeyCredentialDto::fromEntity)
            .toList();
    }

    @Transactional
    public PasskeyCredentialDto registerPasskey(UUID userId, RegisterPasskeyRequest req) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        UserPasskeyCredential cred = new UserPasskeyCredential(user, req.credentialId(), req.publicKey(), req.nickname());
        cred = passkeyRepository.save(cred);

        updatePasskey(userId, true);
        return PasskeyCredentialDto.fromEntity(cred);
    }

    @Transactional
    public void removePasskey(UUID userId, String credentialId) {
        passkeyRepository.deleteByUserIdAndCredentialId(userId, credentialId);
        int remaining = passkeyRepository.countByUserId(userId);
        if (remaining == 0) {
            updatePasskey(userId, false);
        }
    }

    @Transactional(readOnly = true)
    public List<UserDto> searchUsers(String query, UUID currentUserId) {
        if (query == null || query.trim().length() < 1) {
            return userRepository.findAll().stream()
                .filter(u -> !u.getId().equals(currentUserId))
                .limit(20)
                .map(u -> UserDto.fromEntity(u, presenceService.isUserOnline(u.getId())))
                .toList();
        }

        return userRepository.searchUsers(query.trim()).stream()
            .filter(u -> !u.getId().equals(currentUserId))
            .map(u -> UserDto.fromEntity(u, presenceService.isUserOnline(u.getId())))
            .toList();
    }
}
