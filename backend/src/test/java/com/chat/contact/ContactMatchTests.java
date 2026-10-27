package com.chat.contact;

import com.chat.auth.dto.AuthResponse;
import com.chat.auth.dto.RegisterRequest;
import com.chat.auth.service.AuthService;
import com.chat.contact.dto.MatchContactsRequest;
import com.chat.contact.dto.MatchContactsResponse;
import com.chat.contact.dto.MatchedContactDto;
import com.chat.contact.service.ContactService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ContactMatchTests {

    @Autowired
    private ContactService contactService;

    @Autowired
    private AuthService authService;

    @Test
    void testMatchContactsSuccessAndNormalization() {
        // 1. Register Alice (+12025550100)
        AuthResponse alice = authService.register(new RegisterRequest(
            "+12025550100",
            "alice_match@test.com",
            "alice_match",
            "password123",
            "Alice Matcher"
        ));

        // 2. Register Bob (+12025550101)
        AuthResponse bob = authService.register(new RegisterRequest(
            "+12025550101",
            "bob_match@test.com",
            "bob_match",
            "password123",
            "Bob Contact"
        ));

        // 3. Register Charlie (+919876543210)
        AuthResponse charlie = authService.register(new RegisterRequest(
            "+919876543210",
            "charlie_match@test.com",
            "charlie_match",
            "password123",
            "Charlie India"
        ));

        // Alice searches contacts with formatted strings, international numbers, duplicates, and non-existing numbers
        List<String> rawNumbers = List.of(
            "(202) 555-0101",           // Bob domestic US
            "+1 202-555-0101",          // Bob with country code (duplicate of above)
            "+91 98765 43210",          // Charlie international
            "(202) 555-0100",           // Alice herself (should be self-excluded)
            "+1 202 555 9999",          // Not registered
            "invalid-phone-xyz",        // Unparseable garbage
            "123"                       // Too short / invalid
        );

        MatchContactsRequest request = new MatchContactsRequest(rawNumbers, "US");
        MatchContactsResponse response = contactService.matchContacts(alice.user().id(), request);

        assertNotNull(response);
        assertEquals(2, response.matchedCount(), "Bob and Charlie should match, Alice self-excluded");
        assertEquals(2, response.matches().size());

        // Verify Bob is matched
        MatchedContactDto bobMatched = response.matches().stream()
            .filter(c -> c.username().equals("bob_match"))
            .findFirst()
            .orElse(null);
        assertNotNull(bobMatched);
        assertEquals(bob.user().id(), bobMatched.userId());
        assertEquals("+12025550101", bobMatched.phoneNumber());
        assertEquals("Bob Contact", bobMatched.displayName());

        // Verify Charlie is matched
        MatchedContactDto charlieMatched = response.matches().stream()
            .filter(c -> c.username().equals("charlie_match"))
            .findFirst()
            .orElse(null);
        assertNotNull(charlieMatched);
        assertEquals(charlie.user().id(), charlieMatched.userId());
        assertEquals("+919876543210", charlieMatched.phoneNumber());

        // Verify Alice is not in matched results
        boolean containsAlice = response.matches().stream()
            .anyMatch(c -> c.username().equals("alice_match"));
        assertFalse(containsAlice, "User must not match their own phone number");
    }

    @Test
    void testMatchContactsEmptyList() {
        AuthResponse user = authService.register(new RegisterRequest(
            "+12025550199",
            "empty_match@test.com",
            "empty_match",
            "password123",
            "Empty Match User"
        ));

        MatchContactsResponse response = contactService.matchContacts(
            user.user().id(),
            new MatchContactsRequest(List.of(), "US")
        );

        assertNotNull(response);
        assertEquals(0, response.matchedCount());
        assertTrue(response.matches().isEmpty());
    }

    @Test
    void testMatchContactsInternationalRegionsAndSpecialFormatting() {
        AuthResponse searcher = authService.register(new RegisterRequest(
            "+447911123450",
            "searcher_uk@test.com",
            "searcher_uk",
            "password123",
            "UK Searcher"
        ));

        AuthResponse ukFriend = authService.register(new RegisterRequest(
            "+447911123456",
            "uk_friend@test.com",
            "uk_friend",
            "password123",
            "UK Friend"
        ));

        // Domestic UK number: 07911 123456, dotted format, duplicate
        List<String> ukNumbers = List.of(
            "07911 123456",
            "07911.123456",
            "+44 7911 123456"
        );

        MatchContactsResponse response = contactService.matchContacts(
            searcher.user().id(),
            new MatchContactsRequest(ukNumbers, "GB")
        );

        assertNotNull(response);
        assertEquals(1, response.matchedCount());
        assertEquals(ukFriend.user().id(), response.matches().get(0).userId());
        assertEquals("+447911123456", response.matches().get(0).phoneNumber());
        assertEquals("UK Friend", response.matches().get(0).displayName());
    }
}
