package com.chat.security;

import com.chat.conversation.entity.Conversation;
import com.chat.conversation.entity.ConversationMember;
import com.chat.conversation.repository.ConversationMemberRepository;
import com.chat.conversation.repository.ConversationRepository;
import com.chat.message.dto.MessageReactionDto;
import com.chat.message.dto.ReactionSummaryDto;
import com.chat.message.entity.Message;
import com.chat.message.repository.MessageReactionRepository;
import com.chat.message.repository.MessageRepository;
import com.chat.user.entity.User;
import com.chat.user.repository.UserRepository;
import com.chat.websocket.ChatWebSocketHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.net.URI;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class MessageReactionEndpointSecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

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
    private ChatWebSocketHandler chatWebSocketHandler;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private User alice;
    private User bob;
    private User eve;
    private Conversation conversation;
    private Message message;

    private String aliceRawToken;
    private String bobRawToken;
    private String eveRawToken;

    private String aliceAuthHeader;
    private String bobAuthHeader;
    private String eveAuthHeader;

    @BeforeEach
    void setUp() {
        reactionRepository.deleteAll();
        messageRepository.deleteAll();
        memberRepository.deleteAll();
        conversationRepository.deleteAll();
        userRepository.deleteAll();

        // 1. Create users
        alice = new User("+10000000001", "alice@test.com", "alice_user", "password123", "Alice");
        bob = new User("+10000000002", "bob@test.com", "bob_user", "password123", "Bob");
        eve = new User("+10000000003", "eve@test.com", "eve_user", "password123", "Eve");

        alice = userRepository.save(alice);
        bob = userRepository.save(bob);
        eve = userRepository.save(eve);

        // 2. Create conversation between Alice and Bob (Eve is NOT a member)
        conversation = new Conversation("DIRECT", null, alice.getId());
        conversation = conversationRepository.save(conversation);

        ConversationMember memberAlice = new ConversationMember(conversation, alice, "MEMBER");
        ConversationMember memberBob = new ConversationMember(conversation, bob, "MEMBER");
        memberRepository.save(memberAlice);
        memberRepository.save(memberBob);

        // 3. Create message in conversation
        message = new Message(conversation, alice, UUID.randomUUID(), "TEXT", "Hello Bob!", null);
        message = messageRepository.save(message);

        // 4. Generate JWT tokens
        aliceRawToken = tokenProvider.generateAccessToken(alice.getId(), alice.getUsername(), alice.getDisplayName());
        bobRawToken = tokenProvider.generateAccessToken(bob.getId(), bob.getUsername(), bob.getDisplayName());
        eveRawToken = tokenProvider.generateAccessToken(eve.getId(), eve.getUsername(), eve.getDisplayName());

        aliceAuthHeader = "Bearer " + aliceRawToken;
        bobAuthHeader = "Bearer " + bobRawToken;
        eveAuthHeader = "Bearer " + eveRawToken;
    }

    @Test
    @DisplayName("Anonymous caller cannot react to message -> 401/403")
    void testAnonymous_CannotReact() throws Exception {
        mockMvc.perform(post("/api/v1/messages/" + message.getId() + "/reactions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"emoji\":\"👍\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Authenticated conversation member (Alice) can add and remove reactions -> 200 OK")
    void testMemberAlice_AddAndRemoveReaction_Success() throws Exception {
        // Add reaction
        mockMvc.perform(post("/api/v1/messages/" + message.getId() + "/reactions")
                .header("Authorization", aliceAuthHeader)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"emoji\":\"👍\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messageId").value(message.getId().toString()))
                .andExpect(jsonPath("$.reactions[0].emoji").value("👍"))
                .andExpect(jsonPath("$.reactions[0].userId").value(alice.getId().toString()))
                .andExpect(jsonPath("$.summaries[0].emoji").value("👍"))
                .andExpect(jsonPath("$.summaries[0].count").value(1));

        // Bob (also a member) reacts with heart
        mockMvc.perform(post("/api/v1/messages/" + message.getId() + "/reactions")
                .header("Authorization", bobAuthHeader)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"emoji\":\"❤️\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reactions.length()").value(2));

        // Alice removes her thumbs up reaction
        mockMvc.perform(delete("/api/v1/messages/" + message.getId() + "/reactions?emoji=👍")
                .header("Authorization", aliceAuthHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reactions.length()").value(1))
                .andExpect(jsonPath("$.reactions[0].emoji").value("❤️"));
    }

    @Test
    @DisplayName("Authenticated non-member (Eve) cannot add reaction -> 403 Forbidden")
    void testNonMemberEve_AddReaction_Forbidden() throws Exception {
        mockMvc.perform(post("/api/v1/messages/" + message.getId() + "/reactions")
                .header("Authorization", eveAuthHeader)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"emoji\":\"🔥\"}"))
                .andExpect(status().isForbidden());

        // Verify no reaction was persisted
        assertEquals(0, reactionRepository.findByMessageId(message.getId()).size());
    }

    @Test
    @DisplayName("Authenticated non-member (Eve) cannot remove reaction -> 403 Forbidden")
    void testNonMemberEve_RemoveReaction_Forbidden() throws Exception {
        mockMvc.perform(delete("/api/v1/messages/" + message.getId() + "/reactions?emoji=🔥")
                .header("Authorization", eveAuthHeader))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("WebSocket inbound reaction from non-member Eve is rejected with error event")
    void testWebSocketInboundReaction_NonMemberRejected() throws Exception {
        WebSocketSession eveSession = mock(WebSocketSession.class);
        when(eveSession.isOpen()).thenReturn(true);
        when(eveSession.getId()).thenReturn("eve-session-1");
        when(eveSession.getUri()).thenReturn(URI.create("/ws?token=" + eveRawToken));
        when(eveSession.getHandshakeHeaders()).thenReturn(new org.springframework.http.HttpHeaders());
        when(eveSession.getAttributes()).thenReturn(new HashMap<>());

        // Connect Eve session so sessionToUser maps eveSession -> eve.getId()
        chatWebSocketHandler.afterConnectionEstablished(eveSession);

        String jsonPayload = objectMapper.writeValueAsString(Map.of(
            "type", "message.reaction",
            "payload", Map.of(
                "messageId", message.getId().toString(),
                "conversationId", conversation.getId().toString(),
                "emoji", "🚀"
            )
        ));

        java.lang.reflect.Method handleTextMethod = ChatWebSocketHandler.class.getDeclaredMethod(
            "handleTextMessage", WebSocketSession.class, TextMessage.class);
        handleTextMethod.setAccessible(true);
        handleTextMethod.invoke(chatWebSocketHandler, eveSession, new TextMessage(jsonPayload));

        ArgumentCaptor<TextMessage> msgCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(eveSession, atLeastOnce()).sendMessage(msgCaptor.capture());

        boolean receivedForbiddenError = msgCaptor.getAllValues().stream().anyMatch(tm -> {
            try {
                Map<?, ?> map = objectMapper.readValue(tm.getPayload(), Map.class);
                return "error".equals(map.get("type")) &&
                       map.get("payload") != null &&
                       map.get("payload").toString().contains("Not a member of this conversation");
            } catch (Exception e) {
                return false;
            }
        });

        assertTrue(receivedForbiddenError, "Eve must receive error event with 'Not a member of this conversation'");
    }

    @Test
    @DisplayName("WebSocket broadcast of reaction update is scoped strictly to conversation members (Alice & Bob), never Eve")
    void testWebSocketBroadcastReaction_ScopedExclusivelyToMembers() throws Exception {
        // Register active sessions for Alice, Bob, and Eve
        WebSocketSession sessionAlice = mock(WebSocketSession.class);
        when(sessionAlice.isOpen()).thenReturn(true);
        when(sessionAlice.getId()).thenReturn("alice-ws-1");
        when(sessionAlice.getUri()).thenReturn(URI.create("/ws?token=" + aliceRawToken));
        when(sessionAlice.getHandshakeHeaders()).thenReturn(new org.springframework.http.HttpHeaders());
        when(sessionAlice.getAttributes()).thenReturn(new HashMap<>());

        WebSocketSession sessionBob = mock(WebSocketSession.class);
        when(sessionBob.isOpen()).thenReturn(true);
        when(sessionBob.getId()).thenReturn("bob-ws-1");
        when(sessionBob.getUri()).thenReturn(URI.create("/ws?token=" + bobRawToken));
        when(sessionBob.getHandshakeHeaders()).thenReturn(new org.springframework.http.HttpHeaders());
        when(sessionBob.getAttributes()).thenReturn(new HashMap<>());

        WebSocketSession sessionEve = mock(WebSocketSession.class);
        when(sessionEve.isOpen()).thenReturn(true);
        when(sessionEve.getId()).thenReturn("eve-ws-1");
        when(sessionEve.getUri()).thenReturn(URI.create("/ws?token=" + eveRawToken));
        when(sessionEve.getHandshakeHeaders()).thenReturn(new org.springframework.http.HttpHeaders());
        when(sessionEve.getAttributes()).thenReturn(new HashMap<>());

        // Establish connections
        chatWebSocketHandler.afterConnectionEstablished(sessionAlice);
        chatWebSocketHandler.afterConnectionEstablished(sessionBob);
        chatWebSocketHandler.afterConnectionEstablished(sessionEve);

        // Reset invocations from handshake (e.g. presence, receipt queries)
        reset(sessionAlice, sessionBob, sessionEve);
        when(sessionAlice.isOpen()).thenReturn(true);
        when(sessionBob.isOpen()).thenReturn(true);
        when(sessionEve.isOpen()).thenReturn(true);

        List<MessageReactionDto> dummyReactions = List.of(
            new MessageReactionDto(UUID.randomUUID(), message.getId(), alice.getId(), "👍", null, null)
        );
        List<ReactionSummaryDto> dummySummaries = List.of(
            new ReactionSummaryDto("👍", 1, List.of(alice.getId()))
        );

        chatWebSocketHandler.broadcastReactionUpdated(
            message.getId(),
            alice.getId(),
            "👍",
            "add",
            dummyReactions,
            dummySummaries
        );

        // Verify: Alice and Bob are members of conversation -> receive reaction update
        ArgumentCaptor<TextMessage> aliceCaptor = ArgumentCaptor.forClass(TextMessage.class);
        ArgumentCaptor<TextMessage> bobCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(sessionAlice, atLeastOnce()).sendMessage(aliceCaptor.capture());
        verify(sessionBob, atLeastOnce()).sendMessage(bobCaptor.capture());

        assertTrue(aliceCaptor.getValue().getPayload().contains("message.reaction.updated"));
        assertTrue(bobCaptor.getValue().getPayload().contains("message.reaction.updated"));

        // Eve is NOT a member -> Eve's session must NEVER receive reaction update
        verify(sessionEve, never()).sendMessage(any(TextMessage.class));
    }
}
