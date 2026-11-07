package com.chat.security;

import com.chat.conversation.entity.Conversation;
import com.chat.conversation.entity.ConversationMember;
import com.chat.conversation.repository.ConversationMemberRepository;
import com.chat.message.controller.MessageReactionController;
import com.chat.message.dto.MessageReactionDto;
import com.chat.message.dto.ReactionSummaryDto;
import com.chat.message.entity.Message;
import com.chat.message.entity.MessageReaction;
import com.chat.message.repository.MessageReactionRepository;
import com.chat.message.repository.MessageRepository;
import com.chat.message.service.MessageReactionService;
import com.chat.message.service.StarredMessageService;
import com.chat.notification.service.PushNotificationService;
import com.chat.presence.PresenceService;
import com.chat.user.entity.User;
import com.chat.user.repository.UserRepository;
import com.chat.websocket.ChatWebSocketHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.lang.reflect.Field;
import java.net.URI;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class MessageReactionIntegrationTests {

    @Mock private MessageReactionRepository reactionRepository;
    @Mock private MessageRepository messageRepository;
    @Mock private UserRepository userRepository;
    @Mock private ConversationMemberRepository memberRepository;
    @Mock private StarredMessageService starredMessageService;
    @Mock private ChatWebSocketHandler chatWebSocketHandler;
    @Mock private JwtTokenProvider tokenProvider;
    @Mock private com.chat.message.service.MessageService messageService;
    @Mock private PresenceService presenceService;
    @Mock private PushNotificationService pushNotificationService;
    @Mock private com.chat.device.repository.UserLinkedDeviceRepository deviceRepository;
    @Mock private WebSocketSession sessionAlice;
    @Mock private WebSocketSession sessionBob;
    @Mock private WebSocketSession sessionEve;

    private MessageReactionService reactionService;
    private MessageReactionController reactionController;
    private ObjectMapper objectMapper;

    private final UUID convId = UUID.randomUUID();
    private final UUID msgId = UUID.randomUUID();
    private final UUID aliceId = UUID.randomUUID();
    private final UUID bobId = UUID.randomUUID();
    private final UUID eveId = UUID.randomUUID();

    private Conversation conversation;
    private Message message;
    private User alice;
    private User bob;
    private User eve;

    private static void setField(Object target, String fieldName, Object value) {
        try {
            Field f = target.getClass().getDeclaredField(fieldName);
            f.setAccessible(true);
            f.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        reactionService = new MessageReactionService(
            reactionRepository,
            messageRepository,
            userRepository,
            memberRepository
        );
        reactionController = new MessageReactionController(
            reactionService,
            starredMessageService,
            chatWebSocketHandler
        );

        conversation = new Conversation();
        setField(conversation, "id", convId);

        alice = new User();
        setField(alice, "id", aliceId);
        alice.setUsername("alice");
        alice.setDisplayName("Alice");

        bob = new User();
        setField(bob, "id", bobId);
        bob.setUsername("bob");
        bob.setDisplayName("Bob");

        eve = new User();
        setField(eve, "id", eveId);
        eve.setUsername("eve");
        eve.setDisplayName("Eve");

        message = new Message(conversation, alice, UUID.randomUUID(), "TEXT", "Hello Bob", null);
        setField(message, "id", msgId);
    }

    @Nested
    @DisplayName("1. MessageReactionService Membership & Mutation Tests")
    class ReactionServiceMembershipTests {

        @Test
        @DisplayName("Active conversation member can add emoji reaction")
        void activeMemberCanAddReaction() {
            when(messageRepository.findById(msgId)).thenReturn(Optional.of(message));
            when(memberRepository.existsByIdConversationIdAndIdUserId(convId, bobId)).thenReturn(true);
            when(reactionRepository.findByMessageIdAndUserIdAndEmoji(msgId, bobId, "❤️")).thenReturn(Optional.empty());
            when(userRepository.findById(bobId)).thenReturn(Optional.of(bob));
            when(reactionRepository.findByMessageId(msgId)).thenReturn(List.of(
                new MessageReaction(message, bob, "❤️")
            ));

            List<MessageReactionDto> result = reactionService.addReaction(msgId, bobId, "❤️");

            assertNotNull(result);
            assertEquals(1, result.size());
            assertEquals("❤️", result.get(0).emoji());
            verify(reactionRepository).save(any(MessageReaction.class));
        }

        @Test
        @DisplayName("Non-member is denied reaction with 403 Forbidden")
        void nonMemberCannotAddReaction() {
            when(messageRepository.findById(msgId)).thenReturn(Optional.of(message));
            when(memberRepository.existsByIdConversationIdAndIdUserId(convId, eveId)).thenReturn(false);

            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                reactionService.addReaction(msgId, eveId, "👍")
            );

            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
            assertTrue(ex.getReason().contains("Not a member"));
            verify(reactionRepository, never()).save(any());
        }

        @Test
        @DisplayName("Non-member cannot remove reaction (403 Forbidden)")
        void nonMemberCannotRemoveReaction() {
            when(messageRepository.findById(msgId)).thenReturn(Optional.of(message));
            when(memberRepository.existsByIdConversationIdAndIdUserId(convId, eveId)).thenReturn(false);

            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                reactionService.removeReaction(msgId, eveId, "👍")
            );

            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
            verify(reactionRepository, never()).deleteByMessageIdAndUserIdAndEmoji(any(), any(), any());
        }

        @Test
        @DisplayName("Summarize reactions calculates grouping and counts correctly")
        void summarizeReactionsCalculatesCounts() {
            List<MessageReactionDto> dtos = List.of(
                new MessageReactionDto(UUID.randomUUID(), msgId, aliceId, "❤️", Instant.now(), null),
                new MessageReactionDto(UUID.randomUUID(), msgId, bobId, "❤️", Instant.now(), null),
                new MessageReactionDto(UUID.randomUUID(), msgId, aliceId, "👍", Instant.now(), null)
            );

            List<ReactionSummaryDto> summaries = reactionService.summarizeReactions(dtos);

            assertEquals(2, summaries.size());
            ReactionSummaryDto heartSummary = summaries.stream().filter(s -> s.emoji().equals("❤️")).findFirst().orElseThrow();
            assertEquals(2, heartSummary.count());
            assertTrue(heartSummary.userIds().contains(aliceId));
            assertTrue(heartSummary.userIds().contains(bobId));

            ReactionSummaryDto thumbsSummary = summaries.stream().filter(s -> s.emoji().equals("👍")).findFirst().orElseThrow();
            assertEquals(1, thumbsSummary.count());
        }
    }

    @Nested
    @DisplayName("2. REST Controller Mutation & Broadcast Trigger Tests")
    class ControllerMutationTests {

        @Test
        @DisplayName("POST /reactions calls broadcastReactionUpdated when authorized")
        void postReactionTriggersBroadcast() {
            CustomUserDetails bobUser = new CustomUserDetails(bob);

            when(messageRepository.findById(msgId)).thenReturn(Optional.of(message));
            when(memberRepository.existsByIdConversationIdAndIdUserId(convId, bobId)).thenReturn(true);
            when(reactionRepository.findByMessageIdAndUserIdAndEmoji(msgId, bobId, "😂")).thenReturn(Optional.empty());
            when(userRepository.findById(bobId)).thenReturn(Optional.of(bob));
            when(reactionRepository.findByMessageId(msgId)).thenReturn(List.of(
                new MessageReaction(message, bob, "😂")
            ));

            ResponseEntity<Map<String, Object>> response = reactionController.addReaction(
                msgId,
                new MessageReactionController.ReactionRequest("😂"),
                bobUser
            );

            assertEquals(HttpStatus.OK, response.getStatusCode());
            assertNotNull(response.getBody());
            assertEquals(msgId, response.getBody().get("messageId"));

            verify(chatWebSocketHandler).broadcastReactionUpdated(
                eq(msgId), eq(bobId), eq("😂"), eq("add"), any(), any()
            );
        }

        @Test
        @DisplayName("POST /reactions throws 403 and prevents broadcast when non-member calls")
        void postReactionNonMemberThrowsAndDoesNotBroadcast() {
            CustomUserDetails eveUser = new CustomUserDetails(eve);

            when(messageRepository.findById(msgId)).thenReturn(Optional.of(message));
            when(memberRepository.existsByIdConversationIdAndIdUserId(convId, eveId)).thenReturn(false);

            assertThrows(ResponseStatusException.class, () ->
                reactionController.addReaction(
                    msgId,
                    new MessageReactionController.ReactionRequest("😂"),
                    eveUser
                )
            );

            verify(chatWebSocketHandler, never()).broadcastReactionUpdated(any(), any(), any(), any(), any(), any());
        }
    }

    @Nested
    @DisplayName("3. WebSocket Inbound Handling & Recipient Scoping Tests")
    @org.mockito.junit.jupiter.MockitoSettings(strictness = org.mockito.quality.Strictness.LENIENT)
    class WebSocketReactionTests {

        private ChatWebSocketHandler wsHandler;

        @BeforeEach
        void initWsHandler() {
            objectMapper = new ObjectMapper();
            objectMapper.findAndRegisterModules();
            wsHandler = new ChatWebSocketHandler(
                tokenProvider,
                messageService,
                messageRepository,
                memberRepository,
                userRepository,
                presenceService,
                pushNotificationService,
                objectMapper,
                deviceRepository,
                reactionService
            );
        }

        @Test
        @DisplayName("WebSocket inbound message.reaction from member succeeds and broadcasts")
        void wsMemberReactionSucceeds() throws Exception {
            String sessionId = "sess-alice";
            when(sessionAlice.getId()).thenReturn(sessionId);
            when(sessionAlice.isOpen()).thenReturn(true);
            when(sessionAlice.getUri()).thenReturn(URI.create("ws://localhost:8080/ws?token=mock&deviceId=" + UUID.randomUUID()));
            when(tokenProvider.validateToken("mock")).thenReturn(true);
            when(tokenProvider.getUserIdFromToken("mock")).thenReturn(aliceId);
            when(deviceRepository.existsByIdAndUserId(any(), eq(aliceId))).thenReturn(true);

            wsHandler.afterConnectionEstablished(sessionAlice);

            when(messageRepository.findById(msgId)).thenReturn(Optional.of(message));
            when(memberRepository.existsByIdConversationIdAndIdUserId(convId, aliceId)).thenReturn(true);
            when(reactionRepository.findByMessageIdAndUserIdAndEmoji(msgId, aliceId, "🙏")).thenReturn(Optional.empty());
            when(userRepository.findById(aliceId)).thenReturn(Optional.of(alice));
            when(reactionRepository.findByMessageId(msgId)).thenReturn(List.of(
                new MessageReaction(message, alice, "🙏")
            ));

            ConversationMember memAlice = new ConversationMember(conversation, alice, "ADMIN");
            ConversationMember memBob = new ConversationMember(conversation, bob, "MEMBER");
            when(memberRepository.findByIdConversationId(convId)).thenReturn(List.of(memAlice, memBob));

            String payload = String.format(
                "{\"type\":\"message.reaction\",\"payload\":{\"messageId\":\"%s\",\"emoji\":\"🙏\",\"action\":\"add\"}}",
                msgId
            );

            wsHandler.handleMessage(sessionAlice, new TextMessage(payload));

            verify(reactionRepository).save(any(MessageReaction.class));
            verify(sessionAlice, atLeastOnce()).sendMessage(any(TextMessage.class));
        }

        @Test
        @DisplayName("WebSocket inbound message.reaction from non-member emits error event without saving")
        void wsNonMemberReactionEmitsError() throws Exception {
            String sessionId = "sess-eve";
            when(sessionEve.getId()).thenReturn(sessionId);
            when(sessionEve.isOpen()).thenReturn(true);
            when(sessionEve.getUri()).thenReturn(URI.create("ws://localhost:8080/ws?token=mock&deviceId=" + UUID.randomUUID()));
            when(tokenProvider.validateToken("mock")).thenReturn(true);
            when(tokenProvider.getUserIdFromToken("mock")).thenReturn(eveId);
            when(deviceRepository.existsByIdAndUserId(any(), eq(eveId))).thenReturn(true);

            wsHandler.afterConnectionEstablished(sessionEve);

            when(messageRepository.findById(msgId)).thenReturn(Optional.of(message));
            when(memberRepository.existsByIdConversationIdAndIdUserId(convId, eveId)).thenReturn(false);

            String payload = String.format(
                "{\"type\":\"message.reaction\",\"payload\":{\"messageId\":\"%s\",\"emoji\":\"🔥\",\"action\":\"add\"}}",
                msgId
            );

            wsHandler.handleMessage(sessionEve, new TextMessage(payload));

            verify(reactionRepository, never()).save(any());

            ArgumentCaptor<TextMessage> msgCaptor = ArgumentCaptor.forClass(TextMessage.class);
            verify(sessionEve).sendMessage(msgCaptor.capture());
            String responseJson = msgCaptor.getValue().getPayload();
            assertTrue(responseJson.contains("\"type\":\"error\""));
            assertTrue(responseJson.contains("Not a member"));
        }

        @Test
        @DisplayName("Recipient Scoping: broadcast sends exclusively to conversation members, not unrelated users")
        void broadcastScopedExclusivelyToConversationMembers() throws Exception {
            String sessAliceId = "sess-alice";
            when(sessionAlice.getId()).thenReturn(sessAliceId);
            when(sessionAlice.isOpen()).thenReturn(true);
            when(sessionAlice.getUri()).thenReturn(URI.create("ws://localhost:8080/ws?token=tAlice&deviceId=" + UUID.randomUUID()));
            when(tokenProvider.validateToken("tAlice")).thenReturn(true);
            when(tokenProvider.getUserIdFromToken("tAlice")).thenReturn(aliceId);
            when(deviceRepository.existsByIdAndUserId(any(), eq(aliceId))).thenReturn(true);

            String sessBobId = "sess-bob";
            when(sessionBob.getId()).thenReturn(sessBobId);
            when(sessionBob.isOpen()).thenReturn(true);
            when(sessionBob.getUri()).thenReturn(URI.create("ws://localhost:8080/ws?token=tBob&deviceId=" + UUID.randomUUID()));
            when(tokenProvider.validateToken("tBob")).thenReturn(true);
            when(tokenProvider.getUserIdFromToken("tBob")).thenReturn(bobId);
            when(deviceRepository.existsByIdAndUserId(any(), eq(bobId))).thenReturn(true);

            String sessEveId = "sess-eve";
            when(sessionEve.getId()).thenReturn(sessEveId);
            when(sessionEve.isOpen()).thenReturn(true);
            when(sessionEve.getUri()).thenReturn(URI.create("ws://localhost:8080/ws?token=tEve&deviceId=" + UUID.randomUUID()));
            when(tokenProvider.validateToken("tEve")).thenReturn(true);
            when(tokenProvider.getUserIdFromToken("tEve")).thenReturn(eveId);
            when(deviceRepository.existsByIdAndUserId(any(), eq(eveId))).thenReturn(true);

            wsHandler.afterConnectionEstablished(sessionAlice);
            wsHandler.afterConnectionEstablished(sessionBob);
            wsHandler.afterConnectionEstablished(sessionEve);

            when(messageRepository.findById(msgId)).thenReturn(Optional.of(message));
            ConversationMember memAlice = new ConversationMember(conversation, alice, "ADMIN");
            ConversationMember memBob = new ConversationMember(conversation, bob, "MEMBER");
            when(memberRepository.findByIdConversationId(convId)).thenReturn(List.of(memAlice, memBob));

            wsHandler.broadcastReactionUpdated(msgId, aliceId, "❤️", "add", List.of(), List.of());

            verify(sessionAlice, atLeastOnce()).sendMessage(any(TextMessage.class));
            verify(sessionBob, atLeastOnce()).sendMessage(any(TextMessage.class));
            verify(sessionEve, never()).sendMessage(any(TextMessage.class));
        }
    }
}
