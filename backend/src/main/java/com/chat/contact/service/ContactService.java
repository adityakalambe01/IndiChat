package com.chat.contact.service;

import com.chat.contact.dto.ContactDto;
import com.chat.contact.dto.MatchContactsRequest;
import com.chat.contact.dto.MatchContactsResponse;
import com.chat.contact.dto.MatchedContactDto;
import com.chat.contact.entity.Contact;
import com.chat.contact.repository.ContactRepository;
import com.chat.presence.PresenceService;
import com.chat.user.dto.UserDto;
import com.chat.user.entity.User;
import com.chat.user.repository.UserRepository;
import com.google.i18n.phonenumbers.NumberParseException;
import com.google.i18n.phonenumbers.PhoneNumberUtil;
import com.google.i18n.phonenumbers.Phonenumber;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class ContactService {

    private static final Logger log = LoggerFactory.getLogger(ContactService.class);

    private final ContactRepository contactRepository;
    private final UserRepository userRepository;
    private final PresenceService presenceService;

    public ContactService(ContactRepository contactRepository, UserRepository userRepository, PresenceService presenceService) {
        this.contactRepository = contactRepository;
        this.userRepository = userRepository;
        this.presenceService = presenceService;
    }

    @Transactional(readOnly = true)
    public List<ContactDto> getUserContacts(UUID userId) {
        List<Contact> contacts = contactRepository.findByIdUserId(userId);
        return contacts.stream().map(c -> {
            boolean online = presenceService.isUserOnline(c.getContactUser().getId());
            return new ContactDto(
                c.getContactUser().getId(),
                c.getNickname(),
                c.getCreatedAt(),
                UserDto.fromEntity(c.getContactUser(), online)
            );
        }).toList();
    }

    @Transactional
    public ContactDto addContact(UUID userId, UUID contactUserId, String nickname) {
        if (userId.equals(contactUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot add yourself as contact");
        }

        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        User contactUser = userRepository.findById(contactUserId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact user not found"));

        Contact contact = new Contact(user, contactUser, nickname);
        contact = contactRepository.save(contact);

        boolean online = presenceService.isUserOnline(contactUserId);
        return new ContactDto(
            contactUserId,
            contact.getNickname(),
            contact.getCreatedAt(),
            UserDto.fromEntity(contactUser, online)
        );
    }

    @Transactional(readOnly = true)
    public MatchContactsResponse matchContacts(UUID requestingUserId, MatchContactsRequest request) {
        if (request == null || request.phoneNumbers() == null || request.phoneNumbers().isEmpty()) {
            return new MatchContactsResponse(List.of(), 0);
        }

        PhoneNumberUtil phoneUtil = PhoneNumberUtil.getInstance();
        String defaultRegion = (request.defaultRegion() != null && !request.defaultRegion().isBlank())
            ? request.defaultRegion().trim().toUpperCase()
            : "IN";

        // Normalize phone numbers to E.164 and deduplicate
        Set<String> normalizedNumbers = new HashSet<>();
        for (String raw : request.phoneNumbers()) {
            if (raw == null || raw.isBlank()) continue;
            String cleaned = raw.trim();
            try {
                Phonenumber.PhoneNumber parsed = phoneUtil.parse(cleaned, defaultRegion);
                if (phoneUtil.isValidNumber(parsed)) {
                    normalizedNumbers.add(phoneUtil.format(parsed, PhoneNumberUtil.PhoneNumberFormat.E164));
                } else {
                    // Fallback: if raw has '+' and valid length, include it
                    String fallback = cleaned.replaceAll("[^0-9+]", "");
                    if (fallback.startsWith("+") && fallback.length() >= 8 && fallback.length() <= 16) {
                        normalizedNumbers.add(fallback);
                    }
                }
            } catch (NumberParseException e) {
                String fallback = cleaned.replaceAll("[^0-9+]", "");
                if (fallback.startsWith("+") && fallback.length() >= 8 && fallback.length() <= 16) {
                    normalizedNumbers.add(fallback);
                }
            }
        }

        // Exclude requesting user's own phone number
        userRepository.findById(requestingUserId).ifPresent(currentUser -> {
            if (currentUser.getPhoneNumber() != null && !currentUser.getPhoneNumber().isBlank()) {
                normalizedNumbers.remove(currentUser.getPhoneNumber().trim());
                try {
                    Phonenumber.PhoneNumber parsedOwn = phoneUtil.parse(currentUser.getPhoneNumber().trim(), defaultRegion);
                    if (phoneUtil.isValidNumber(parsedOwn)) {
                        normalizedNumbers.remove(phoneUtil.format(parsedOwn, PhoneNumberUtil.PhoneNumberFormat.E164));
                    }
                } catch (Exception ignored) {}
            }
        });

        if (normalizedNumbers.isEmpty()) {
            return new MatchContactsResponse(List.of(), 0);
        }

        // Query active users matching any of the normalized phone numbers
        List<User> matchedUsers = userRepository.findActiveUsersByPhoneNumbers(normalizedNumbers);

        List<MatchedContactDto> matchedDtos = matchedUsers.stream().map(user -> {
            boolean online = presenceService.isUserOnline(user.getId());
            return new MatchedContactDto(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getAvatarKey(),
                user.getPhoneNumber(),
                online,
                user.getLastSeenAt()
            );
        }).toList();

        log.info("Contact discovery query evaluated: {} inputs, {} normalized, {} matches",
            request.phoneNumbers().size(), normalizedNumbers.size(), matchedDtos.size());

        return new MatchContactsResponse(matchedDtos, matchedDtos.size());
    }
}
