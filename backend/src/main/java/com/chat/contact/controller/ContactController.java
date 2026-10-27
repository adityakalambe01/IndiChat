package com.chat.contact.controller;

import com.chat.contact.dto.ContactDto;
import com.chat.contact.dto.MatchContactsRequest;
import com.chat.contact.dto.MatchContactsResponse;
import com.chat.contact.service.ContactService;
import com.chat.security.CustomUserDetails;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/contacts")
public class ContactController {

    private final ContactService contactService;

    public ContactController(ContactService contactService) {
        this.contactService = contactService;
    }

    @GetMapping
    public ResponseEntity<List<ContactDto>> getContacts(@AuthenticationPrincipal CustomUserDetails userDetails) {
        List<ContactDto> contacts = contactService.getUserContacts(userDetails.getId());
        return ResponseEntity.ok(contacts);
    }

    public record AddContactRequest(UUID contactUserId, String nickname) {}

    @PostMapping
    public ResponseEntity<ContactDto> addContact(
        @RequestBody AddContactRequest request,
        @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        ContactDto contact = contactService.addContact(userDetails.getId(), request.contactUserId(), request.nickname());
        return ResponseEntity.status(HttpStatus.CREATED).body(contact);
    }

    @PostMapping("/match")
    public ResponseEntity<MatchContactsResponse> matchContacts(
        @Valid @RequestBody MatchContactsRequest request,
        @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        MatchContactsResponse response = contactService.matchContacts(userDetails.getId(), request);
        return ResponseEntity.ok(response);
    }
}

