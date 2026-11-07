package com.chat.security;

import com.chat.conversation.entity.Conversation;
import com.chat.conversation.entity.ConversationMember;
import com.chat.conversation.repository.ConversationMemberRepository;
import com.chat.conversation.repository.ConversationRepository;
import com.chat.message.entity.Message;
import com.chat.message.repository.MessageReactionRepository;
import com.chat.message.repository.MessageRepository;
import com.chat.user.entity.User;
import com.chat.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URI;
import java.util.*;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT, properties = {
    "server.port=8189",
    "spring.profiles.active=test",
    "spring.datasource.url=jdbc:h2:mem:smokedb;DB_CLOSE_DELAY=-1;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.flyway.enabled=false",
    "spring.data.redis.repositories.enabled=false"
})
@ActiveProfiles("test")
public class ProductionAppReactionsSmokeTest {

    @LocalServerPort
    private int port;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private ConversationMemberRepository memberRepository;

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private MessageReactionRepository reactionRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private TestRestTemplate restTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private User alice;
    private User bob;
    private User eve;
    private Conversation conversation;
    private Message message;

    private String aliceToken;
    private String bobToken;
    private String eveToken;

    @BeforeEach
    void setUp() {
        reactionRepository.deleteAll();
        messageRepository.deleteAll();
        memberRepository.deleteAll();
        conversationRepository.deleteAll();
        userRepository.deleteAll();

        // 1. Create Users
        alice = userRepository.save(new User("+10000000001", "alice@smoke.com", "alice_smoke", "pass123", "Alice Smoke"));
        bob = userRepository.save(new User("+10000000002", "bob@smoke.com", "bob_smoke", "pass123", "Bob Smoke"));
        eve = userRepository.save(new User("+10000000003", "eve@smoke.com", "eve_smoke", "pass123", "Eve Smoke"));

        // 2. Create Conversation between Alice and Bob
        conversation = conversationRepository.save(new Conversation("DIRECT", null, alice.getId()));
        memberRepository.save(new ConversationMember(conversation, alice, "MEMBER"));
        memberRepository.save(new ConversationMember(conversation, bob, "MEMBER"));

        // 3. Create message in conversation
        message = messageRepository.save(new Message(conversation, alice, UUID.randomUUID(), "TEXT", "Smoke Test Message", null));

        // 4. Generate JWT tokens
        aliceToken = tokenProvider.generateAccessToken(alice.getId(), alice.getUsername(), alice.getDisplayName());
        bobToken = tokenProvider.generateAccessToken(bob.getId(), bob.getUsername(), bob.getDisplayName());
        eveToken = tokenProvider.generateAccessToken(eve.getId(), eve.getUsername(), eve.getDisplayName());
    }

    private HttpHeaders createAuthHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    @Test
    @DisplayName("Smoke Test: Two real authenticated WebSocket clients receive reaction updates, including when already reacted")
    void testTwoAuthenticatedClients_ReactionsUpdateBoth() throws Exception {
        StandardWebSocketClient wsClient = new StandardWebSocketClient();

        BlockingQueue<String> aliceQueue = new LinkedBlockingQueue<>();
        BlockingQueue<String> bobQueue = new LinkedBlockingQueue<>();

        TextWebSocketHandler aliceWsHandler = new TextWebSocketHandler() {
            @Override
            protected void handleTextMessage(WebSocketSession session, TextMessage msg) {
                aliceQueue.offer(msg.getPayload());
            }
        };

        TextWebSocketHandler bobWsHandler = new TextWebSocketHandler() {
            @Override
            protected void handleTextMessage(WebSocketSession session, TextMessage msg) {
                bobQueue.offer(msg.getPayload());
            }
        };

        // 1. Connect Alice and Bob WebSocket sessions to live server on port 8189
        String wsBase = "ws://localhost:" + port + "/ws?token=";
        WebSocketSession aliceSession = wsClient.execute(aliceWsHandler, wsBase + aliceToken).get(5, TimeUnit.SECONDS);
        WebSocketSession bobSession = wsClient.execute(bobWsHandler, wsBase + bobToken).get(5, TimeUnit.SECONDS);

        assertTrue(aliceSession.isOpen(), "Alice WebSocket session must be open");
        assertTrue(bobSession.isOpen(), "Bob WebSocket session must be open");

        // Clear handshake messages (presence, offline receipts)
        Thread.sleep(500);
        aliceQueue.clear();
        bobQueue.clear();

        // -------------------------------------------------------------
        // Step 1: Alice reacts with 👍 (First reaction on message)
        // -------------------------------------------------------------
        String reactUrl = "http://localhost:" + port + "/api/v1/messages/" + message.getId() + "/reactions";
        HttpEntity<Map<String, String>> aliceReq1 = new HttpEntity<>(Map.of("emoji", "👍"), createAuthHeaders(aliceToken));
        ResponseEntity<Map> aliceRes1 = restTemplate.postForEntity(reactUrl, aliceReq1, Map.class);

        assertEquals(HttpStatus.OK, aliceRes1.getStatusCode(), "Alice reaction should succeed with 200 OK");
        assertNotNull(aliceRes1.getBody());
        assertEquals(message.getId().toString(), aliceRes1.getBody().get("messageId"));

        // Confirm Bob's client receives reaction broadcast over WebSocket
        String bobReceived1 = bobQueue.poll(5, TimeUnit.SECONDS);
        assertNotNull(bobReceived1, "Bob must receive WebSocket reaction event for Alice's 👍");
        assertTrue(bobReceived1.contains("message.reaction.updated"), "Payload must have type message.reaction.updated");
        assertTrue(bobReceived1.contains("👍"), "Payload must include emoji 👍");
        assertTrue(bobReceived1.contains(alice.getId().toString()), "Payload must include Alice's userId");

        // Confirm Alice also receives the WebSocket confirmation broadcast
        String aliceReceived1 = aliceQueue.poll(5, TimeUnit.SECONDS);
        assertNotNull(aliceReceived1, "Alice must receive WebSocket reaction event");
        assertTrue(aliceReceived1.contains("message.reaction.updated"));

        // -------------------------------------------------------------
        // Step 2: Bob reacts with ❤️ to the same message (Both have now reacted)
        // -------------------------------------------------------------
        HttpEntity<Map<String, String>> bobReq = new HttpEntity<>(Map.of("emoji", "❤️"), createAuthHeaders(bobToken));
        ResponseEntity<Map> bobRes = restTemplate.postForEntity(reactUrl, bobReq, Map.class);

        assertEquals(HttpStatus.OK, bobRes.getStatusCode(), "Bob reaction should succeed with 200 OK");
        List<?> bobSummaries = (List<?>) bobRes.getBody().get("summaries");
        assertEquals(2, bobSummaries.size(), "Summaries must contain both 👍 and ❤️");

        // Confirm Alice's client receives Bob's reaction update
        String aliceReceived2 = aliceQueue.poll(5, TimeUnit.SECONDS);
        assertNotNull(aliceReceived2, "Alice must receive Bob's ❤️ reaction update");
        assertTrue(aliceReceived2.contains("❤️"), "Alice received event must include ❤️");
        assertTrue(aliceReceived2.contains(bob.getId().toString()), "Alice received event must include Bob's userId");

        // Bob's client also receives confirmation of his own reaction
        String bobReceivedSelf = bobQueue.poll(5, TimeUnit.SECONDS);
        assertNotNull(bobReceivedSelf, "Bob must receive confirmation broadcast of his own ❤️ reaction");
        assertTrue(bobReceivedSelf.contains("❤️"));

        // -------------------------------------------------------------
        // Step 3: Alice adds another reaction (🚀) after having already reacted
        // -------------------------------------------------------------
        HttpEntity<Map<String, String>> aliceReq2 = new HttpEntity<>(Map.of("emoji", "🚀"), createAuthHeaders(aliceToken));
        ResponseEntity<Map> aliceRes2 = restTemplate.postForEntity(reactUrl, aliceReq2, Map.class);

        assertEquals(HttpStatus.OK, aliceRes2.getStatusCode(), "Alice secondary reaction should succeed with 200 OK");

        // Confirm Bob's client receives Alice's additional reaction
        String bobReceived2 = bobQueue.poll(5, TimeUnit.SECONDS);
        assertNotNull(bobReceived2, "Bob must receive Alice's 🚀 reaction update");
        assertTrue(bobReceived2.contains("🚀"), "Bob event must include 🚀");

        // Alice's client also receives the 🚀 event
        String aliceReceived3 = aliceQueue.poll(5, TimeUnit.SECONDS);
        assertNotNull(aliceReceived3);
        assertTrue(aliceReceived3.contains("🚀"));

        // -------------------------------------------------------------
        // Step 4: Alice removes 👍 reaction
        // -------------------------------------------------------------
        String removeUrl = reactUrl + "?emoji=👍";
        ResponseEntity<Map> removeRes = restTemplate.exchange(
            removeUrl, HttpMethod.DELETE, new HttpEntity<>(createAuthHeaders(aliceToken)), Map.class);
        assertEquals(HttpStatus.OK, removeRes.getStatusCode(), "Alice removing 👍 should return 200 OK");

        // Confirm Bob's client receives the removal update
        String bobReceived3 = bobQueue.poll(5, TimeUnit.SECONDS);
        assertNotNull(bobReceived3, "Bob must receive removal broadcast");
        assertTrue(bobReceived3.contains("remove"), "Action must be remove");

        // Alice's client also receives the removal update
        String aliceReceived4 = aliceQueue.poll(5, TimeUnit.SECONDS);
        assertNotNull(aliceReceived4);
        assertTrue(aliceReceived4.contains("remove"));

        // -------------------------------------------------------------
        // Step 5: Non-member (Eve) attempts to react -> 403 Forbidden
        // -------------------------------------------------------------
        HttpEntity<Map<String, String>> eveReq = new HttpEntity<>(Map.of("emoji", "🔥"), createAuthHeaders(eveToken));
        ResponseEntity<Map> eveRes = restTemplate.postForEntity(reactUrl, eveReq, Map.class);

        assertEquals(HttpStatus.FORBIDDEN, eveRes.getStatusCode(), "Non-member Eve must be rejected with 403 Forbidden");

        // Verify neither Alice nor Bob received any event from Eve
        assertNull(aliceQueue.poll(500, TimeUnit.MILLISECONDS), "Alice must not receive events from unauthorized user");
        assertNull(bobQueue.poll(500, TimeUnit.MILLISECONDS), "Bob must not receive events from unauthorized user");

        // Cleanup WebSocket sessions
        aliceSession.close();
        bobSession.close();
    }
}
