package com.chat.status.service;

import com.chat.contact.repository.ContactRepository;
import com.chat.settings.entity.UserSettings;
import com.chat.settings.repository.UserSettingsRepository;
import com.chat.status.dto.CreateStatusStoryRequest;
import com.chat.status.dto.StatusStoryDto;
import com.chat.status.entity.UserStatusStory;
import com.chat.status.repository.UserStatusStoryRepository;
import com.chat.user.entity.User;
import com.chat.user.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class StatusStoryService {

    private final UserStatusStoryRepository storyRepository;
    private final UserRepository userRepository;
    private final UserSettingsRepository settingsRepository;
    private final ContactRepository contactRepository;

    public StatusStoryService(
        UserStatusStoryRepository storyRepository,
        UserRepository userRepository,
        UserSettingsRepository settingsRepository,
        ContactRepository contactRepository
    ) {
        this.storyRepository = storyRepository;
        this.userRepository = userRepository;
        this.settingsRepository = settingsRepository;
        this.contactRepository = contactRepository;
    }

    @Transactional
    public StatusStoryDto createStory(CreateStatusStoryRequest req, UUID userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        UserStatusStory story = new UserStatusStory(user, req.mediaUrl(), req.mediaType(), req.caption());
        story = storyRepository.save(story);
        return StatusStoryDto.fromEntity(story);
    }

    @Transactional(readOnly = true)
    public List<StatusStoryDto> getActiveStories(UUID currentUserId) {
        Instant now = Instant.now();
        List<UserStatusStory> stories = storyRepository.findByExpiresAtAfterOrderByCreatedAtDesc(now);

        UserSettings viewerSettings = settingsRepository.findById(currentUserId).orElse(null);
        Set<String> viewerExclusions = parseExclusions(viewerSettings != null ? viewerSettings.getPrivacyExcludedContacts() : null);

        return stories.stream()
            .filter(story -> {
                UUID authorId = story.getUser().getId();
                // 1. Author can always see their own stories
                if (authorId.equals(currentUserId)) {
                    return true;
                }

                // 2. If viewer has excluded/blocked this author, do not display
                if (viewerExclusions.contains(authorId.toString())) {
                    return false;
                }

                // 3. Inspect author's privacy configuration
                UserSettings authorSettings = settingsRepository.findById(authorId).orElse(null);
                String privacyStatus = authorSettings != null ? authorSettings.getPrivacyStatus() : "contacts";
                String authorExclusionsStr = authorSettings != null ? authorSettings.getPrivacyExcludedContacts() : "";
                Set<String> authorExclusions = parseExclusions(authorExclusionsStr);

                // If author explicitly excluded viewer
                if (authorExclusions.contains(currentUserId.toString())) {
                    return false;
                }

                // If author privacy is 'nobody'
                if ("nobody".equalsIgnoreCase(privacyStatus)) {
                    return false;
                }

                // If author privacy is 'everyone'
                if ("everyone".equalsIgnoreCase(privacyStatus)) {
                    return true;
                }

                // Default 'contacts': viewer must be in author's contacts
                return contactRepository.existsByIdUserIdAndIdContactUserId(authorId, currentUserId);
            })
            .map(StatusStoryDto::fromEntity)
            .toList();
    }

    private Set<String> parseExclusions(String exclusionsStr) {
        if (exclusionsStr == null || exclusionsStr.isBlank()) {
            return Collections.emptySet();
        }
        return Arrays.stream(exclusionsStr.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .collect(Collectors.toSet());
    }
}


