package com.chat.websocket;

import com.chat.conversation.entity.ConversationMember;
import com.chat.conversation.repository.ConversationMemberRepository;
import com.chat.message.dto.MessageDto;
import com.chat.message.dto.MessageReceiptDto;
import com.chat.message.dto.SendMessageRequest;
import com.chat.message.repository.MessageRepository;
import com.chat.message.service.MessageService;
import com.chat.notification.service.PushNotificationService;
import com.chat.presence.PresenceService;
import com.chat.security.JwtTokenProvider;
import com.chat.user.entity.User;
import com.chat.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(ChatWebSocketHandler.class);

    private final JwtTokenProvider tokenProvider;
    private final MessageService messageService;
    private final MessageRepository messageRepository;
    private final ConversationMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final PresenceService presenceService;
    private final PushNotificationService pushNotificationService;
    private final ObjectMapper objectMapper;
    private final com.chat.device.repository.UserLinkedDeviceRepository deviceRepository;
    private final com.chat.message.service.MessageReactionService reactionService;

    // Active session mappings
    private final Map<UUID, Set<WebSocketSession>> userSessions = new ConcurrentHashMap<>();
    private final Map<String, UUID> sessionToUser = new ConcurrentHashMap<>();
    private final Map<String, UUID> sessionToDevice = new ConcurrentHashMap<>();

    public ChatWebSocketHandler(
        JwtTokenProvider tokenProvider,
        MessageService messageService,
        MessageRepository messageRepository,
        ConversationMemberRepository memberRepository,
        UserRepository userRepository,
        PresenceService presenceService,
        PushNotificationService pushNotificationService,
        ObjectMapper objectMapper,
        com.chat.device.repository.UserLinkedDeviceRepository deviceRepository,
        @org.springframework.context.annotation.Lazy com.chat.message.service.MessageReactionService reactionService
    ) {
        this.tokenProvider = tokenProvider;
        this.messageService = messageService;
        this.messageRepository = messageRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.presenceService = presenceService;
        this.pushNotificationService = pushNotificationService;
        this.objectMapper = objectMapper;
        this.deviceRepository = deviceRepository;
        this.reactionService = reactionService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        UUID userId = extractUserId(session);
        UUID deviceId = extractDeviceId(session);
        if (userId == null) {
            log.warn("Unauthorized WebSocket handshake attempt");
            session.close(CloseStatus.POLICY_VIOLATION);
            return;
        }

        if (deviceId != null && !deviceRepository.existsByIdAndUserId(deviceId, userId)) {
            log.warn("WebSocket rejected: device {} is not linked to user {}", deviceId, userId);
            sendToSession(session, Map.of(
                "type", "DEVICE_REMOVED",
                "payload", Map.of(
                    "deviceId", deviceId.toString(),
                    "reason", "This device has been removed from linked devices."
                )
            ));
            try {
                session.close(new CloseStatus(4001, "Device session revoked"));
            } catch (Exception ignored) {}
            return;
        }

        sessionToUser.put(session.getId(), userId);
        if (deviceId != null) {
            sessionToDevice.put(session.getId(), deviceId);
        }
        userSessions.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(session);
        presenceService.setUserOnline(userId);

        log.info("WebSocket connected for user: {} (device: {})", userId, deviceId);

        // Broadcast presence
        broadcastPresence(userId, true, Instant.now());

        // Process any pending receipts for messages sent to this user while offline
        try {
            List<MessageService.PendingReceiptInfo> pendingReceipts = messageService.markAllPendingDeliveredForUser(userId);
            for (MessageService.PendingReceiptInfo info : pendingReceipts) {
                broadcastReceipt(info.receipt(), info.conversationId() != null ? info.conversationId().toString() : null);
            }
        } catch (Exception e) {
            log.error("Error marking pending delivered receipts on connect for user {}", userId, e);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        sessionToDevice.remove(session.getId());
        UUID userId = sessionToUser.remove(session.getId());
        if (userId != null) {
            Set<WebSocketSession> sessions = userSessions.get(userId);
            if (sessions != null) {
                sessions.remove(session);
                if (sessions.isEmpty()) {
                    userSessions.remove(userId);
                    presenceService.setUserOffline(userId);

                    Instant now = Instant.now();
                    userRepository.findById(userId).ifPresent(u -> {
                        u.setLastSeenAt(now);
                        userRepository.save(u);
                    });

                    broadcastPresence(userId, false, now);
                }
            }
            log.info("WebSocket closed for user: {}", userId);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        UUID userId = sessionToUser.get(session.getId());
        if (userId == null) return;

        try {
            JsonNode root = objectMapper.readTree(message.getPayload());
            String type = root.path("type").asText();
            String requestId = root.path("requestId").asText(null);
            JsonNode payload = root.path("payload");

            switch (type) {
                case "message.send" -> handleSendMessage(userId, requestId, payload);
                case "message.delivered" -> handleMessageDelivered(userId, payload);
                case "message.read" -> handleMessageRead(userId, payload);
                case "message.reaction" -> handleMessageReaction(session, userId, payload);
                case "typing.start" -> handleTyping(userId, payload, true);
                case "typing.stop" -> handleTyping(userId, payload, false);
                case "presence.subscribe" -> handlePresenceSubscribe(session, payload);
                case "call.signal" -> handleCallSignal(userId, payload);
                default -> log.debug("Unknown socket message type: {}", type);
            }
        } catch (Exception e) {
            log.error("Error processing socket message", e);
            sendToSession(session, Map.of(
                "type", "error",
                "payload", Map.of("message", e.getMessage() != null ? e.getMessage() : "Internal error")
            ));
        }
    }

    private void handleSendMessage(UUID senderId, String requestId, JsonNode payload) {
        UUID conversationId = UUID.fromString(payload.path("conversationId").asText());
        UUID clientMessageId = UUID.fromString(payload.path("clientMessageId").asText());
        String content = payload.path("content").asText("");
        String messageType = payload.path("messageType").asText("TEXT");
        UUID replyToId = payload.hasNonNull("replyToId") ? UUID.fromString(payload.path("replyToId").asText()) : null;

        SendMessageRequest req = new SendMessageRequest(conversationId, clientMessageId, messageType, content, replyToId);
        MessageDto created = messageService.sendMessage(req, senderId);
        broadcastMessageCreated(conversationId, created, requestId);
        pushNotificationService.sendNotificationForMessage(conversationId, created, senderId);
    }

    public void broadcastMessageCreated(UUID conversationId, MessageDto created, String requestId) {
        List<ConversationMember> members = memberRepository.findByIdConversationId(conversationId);
        Map<String, Object> event = new HashMap<>();
        event.put("type", "message.created");
        if (requestId != null) event.put("requestId", requestId);
        event.put("payload", created);

        for (ConversationMember member : members) {
            sendToUser(member.getUser().getId(), event);
        }
    }

    private void handleMessageDelivered(UUID userId, JsonNode payload) {
        UUID messageId = UUID.fromString(payload.path("messageId").asText());
        MessageReceiptDto receipt = messageService.markDelivered(messageId, userId);
        if (receipt != null) {
            broadcastReceipt(receipt, payload.path("conversationId").asText(null));
        }
    }

    private void handleMessageRead(UUID userId, JsonNode payload) {
        UUID messageId = UUID.fromString(payload.path("messageId").asText());
        MessageReceiptDto receipt = messageService.markRead(messageId, userId);
        if (receipt != null) {
            broadcastReceipt(receipt, payload.path("conversationId").asText(null));
        }
    }

    public void broadcastReceipt(MessageReceiptDto receipt, String conversationIdStr) {
        Map<String, Object> event = Map.of(
            "type", "message.receipt.updated",
            "payload", receipt
        );

        UUID conversationId = null;
        if (conversationIdStr != null && !conversationIdStr.isBlank()) {
            conversationId = UUID.fromString(conversationIdStr);
        } else if (receipt.messageId() != null) {
            conversationId = messageRepository.findById(receipt.messageId())
                .map(m -> m.getConversation().getId())
                .orElse(null);
        }

        if (conversationId != null) {
            List<ConversationMember> members = memberRepository.findByIdConversationId(conversationId);
            for (ConversationMember member : members) {
                sendToUser(member.getUser().getId(), event);
            }
        }
    }

    private void handleMessageReaction(WebSocketSession session, UUID userId, JsonNode payload) {
        if (reactionService == null) {
            log.warn("MessageReactionService is not available");
            return;
        }
        try {
            UUID messageId = UUID.fromString(payload.path("messageId").asText());
            String emoji = payload.path("emoji").asText();
            String action = payload.path("action").asText("add");

            if (emoji == null || emoji.isBlank()) {
                sendToSession(session, Map.of(
                    "type", "error",
                    "payload", Map.of("message", "Emoji cannot be blank")
                ));
                return;
            }

            var reactions = "remove".equalsIgnoreCase(action)
                ? reactionService.removeReaction(messageId, userId, emoji)
                : reactionService.addReaction(messageId, userId, emoji);

            var summaries = reactionService.summarizeReactions(reactions);
            broadcastReactionUpdated(messageId, userId, emoji, action, reactions, summaries);
        } catch (org.springframework.web.server.ResponseStatusException rse) {
            log.warn("Reaction denied via WebSocket for user {}: {}", userId, rse.getReason());
            sendToSession(session, Map.of(
                "type", "error",
                "payload", Map.of("message", rse.getReason() != null ? rse.getReason() : "Action not permitted")
            ));
        } catch (Exception e) {
            log.error("Failed to handle reaction socket action for user {}", userId, e);
            sendToSession(session, Map.of(
                "type", "error",
                "payload", Map.of("message", "Invalid reaction payload")
            ));
        }
    }

    public void broadcastReactionUpdated(
        UUID messageId,
        UUID userId,
        String emoji,
        String action,
        Object reactions,
        Object summaries
    ) {
        UUID conversationId = messageRepository.findById(messageId)
            .map(m -> m.getConversation().getId())
            .orElse(null);

        if (conversationId == null) return;

        Map<String, Object> payload = new HashMap<>();
        payload.put("messageId", messageId.toString());
        payload.put("conversationId", conversationId.toString());
        payload.put("userId", userId.toString());
        payload.put("emoji", emoji);
        payload.put("action", action);
        if (reactions != null) payload.put("reactions", reactions);
        if (summaries != null) payload.put("summaries", summaries);

        Map<String, Object> event = Map.of(
            "type", "message.reaction.updated",
            "payload", payload
        );

        List<ConversationMember> members = memberRepository.findByIdConversationId(conversationId);
        for (ConversationMember member : members) {
            sendToUser(member.getUser().getId(), event);
        }
    }

    private void handleTyping(UUID userId, JsonNode payload, boolean isTyping) {
        UUID conversationId = UUID.fromString(payload.path("conversationId").asText());
        List<ConversationMember> members = memberRepository.findByIdConversationId(conversationId);

        Map<String, Object> event = Map.of(
            "type", "typing.updated",
            "payload", Map.of(
                "conversationId", conversationId.toString(),
                "userId", userId.toString(),
                "isTyping", isTyping
            )
        );

        for (ConversationMember member : members) {
            if (!member.getUser().getId().equals(userId)) {
                sendToUser(member.getUser().getId(), event);
            }
        }
    }

    private void handlePresenceSubscribe(WebSocketSession session, JsonNode payload) {
        JsonNode userIdsNode = payload.path("userIds");
        if (userIdsNode.isArray()) {
            List<Map<String, Object>> list = new ArrayList<>();
            for (JsonNode idNode : userIdsNode) {
                UUID targetId = UUID.fromString(idNode.asText());
                boolean online = presenceService.isUserOnline(targetId);
                list.add(Map.of("userId", targetId.toString(), "isOnline", online));
            }
            sendToSession(session, Map.of("type", "presence.batch", "payload", list));
        }
    }

    private void handleCallSignal(UUID senderId, JsonNode payload) {
        String targetStr = payload.path("targetUserId").asText(null);
        if (targetStr == null || targetStr.isBlank()) {
            log.warn("Call signal ignored: targetUserId is missing or blank from sender {}", senderId);
            return;
        }

        UUID targetUserId;
        try {
            targetUserId = UUID.fromString(targetStr);
        } catch (IllegalArgumentException e) {
            log.warn("Call signal ignored: invalid targetUserId '{}' from sender {}", targetStr, senderId);
            return;
        }

        String signalType = payload.path("signalType").asText("offer");
        JsonNode data = payload.path("data");

        // Auto-resolve if client passed a conversationId instead of targetUserId
        if (!userRepository.existsById(targetUserId)) {
            List<ConversationMember> members = memberRepository.findByIdConversationId(targetUserId);
            if (!members.isEmpty()) {
                Optional<UUID> otherMemberId = members.stream()
                    .map(m -> m.getUser().getId())
                    .filter(id -> !id.equals(senderId))
                    .findFirst();
                if (otherMemberId.isPresent()) {
                    log.info("Resolved call targetUserId from conversation {} to participant {}", targetUserId, otherMemberId.get());
                    targetUserId = otherMemberId.get();
                }
            }
        }

        Map<String, Object> innerPayload = new HashMap<>();
        innerPayload.put("targetUserId", targetUserId.toString());
        innerPayload.put("senderUserId", senderId.toString());
        innerPayload.put("signalType", signalType);
        innerPayload.put("data", data);

        Map<String, Object> event = Map.of(
            "type", "call.signal",
            "payload", innerPayload
        );
        sendToUser(targetUserId, event);
        log.info("Relayed call.signal [{}] from {} to {}", signalType, senderId, targetUserId);

        if ("offer".equals(signalType)) {
            try {
                User sender = userRepository.findById(senderId).orElse(null);
                String callerName = sender != null ? sender.getDisplayName() : "Incoming Caller";
                boolean isVideo = data != null && data.path("isVideo").asBoolean(false);
                Map<String, Object> pushData = new HashMap<>();
                pushData.put("type", "call");
                pushData.put("callerId", senderId.toString());
                pushData.put("isVideo", String.valueOf(isVideo));
                pushNotificationService.sendPushToUser(
                    targetUserId,
                    callerName,
                    "Incoming " + (isVideo ? "Video" : "Voice") + " Call...",
                    pushData
                );
            } catch (Exception pe) {
                log.debug("Push notification skipped for call: {}", pe.getMessage());
            }
        }
    }

    private void broadcastPresence(UUID userId, boolean isOnline, Instant timestamp) {
        Map<String, Object> event = Map.of(
            "type", "presence.updated",
            "payload", Map.of(
                "userId", userId.toString(),
                "isOnline", isOnline,
                "lastSeenAt", timestamp.toString()
            )
        );

        // Broadcast to all active sessions across users
        userSessions.keySet().forEach(recipientId -> {
            if (!recipientId.equals(userId)) {
                sendToUser(recipientId, event);
            }
        });
    }

    public void sendToUser(UUID userId, Object payload) {
        Set<WebSocketSession> sessions = userSessions.get(userId);
        if (sessions != null && !sessions.isEmpty()) {
            for (WebSocketSession s : sessions) {
                sendToSession(s, payload);
            }
            log.info("Delivered WebSocket message to user {} (active sessions: {})", userId, sessions.size());
        } else {
            log.warn("Cannot deliver message: User {} has NO active WebSocket sessions! Connected users: {}", userId, userSessions.keySet());
        }
    }

    private void sendToSession(WebSocketSession session, Object payload) {
        if (session != null && session.isOpen()) {
            try {
                String text = objectMapper.writeValueAsString(payload);
                synchronized (session) {
                    session.sendMessage(new TextMessage(text));
                }
            } catch (IOException e) {
                log.warn("Failed to send WebSocket message: {}", e.getMessage());
            }
        }
    }

    private UUID extractUserId(WebSocketSession session) {
        URI uri = session.getUri();
        if (uri == null) return null;

        String query = uri.getQuery();
        if (query != null && query.contains("token=")) {
            for (String param : query.split("&")) {
                if (param.startsWith("token=")) {
                    String token = param.substring(6);
                    if (tokenProvider.validateToken(token)) {
                        return tokenProvider.getUserIdFromToken(token);
                    }
                }
            }
        }

        // Check Authorization header in handshake
        List<String> authHeaders = session.getHandshakeHeaders().get("Authorization");
        if (authHeaders != null && !authHeaders.isEmpty()) {
            String header = authHeaders.get(0);
            if (header.startsWith("Bearer ")) {
                String token = header.substring(7);
                if (tokenProvider.validateToken(token)) {
                    return tokenProvider.getUserIdFromToken(token);
                }
            }
        }

        return null;
    }

    private UUID extractDeviceId(WebSocketSession session) {
        URI uri = session.getUri();
        if (uri == null) return null;

        String query = uri.getQuery();
        if (query != null && query.contains("deviceId=")) {
            for (String param : query.split("&")) {
                if (param.startsWith("deviceId=")) {
                    try {
                        return UUID.fromString(param.substring(9).trim());
                    } catch (Exception ignored) {}
                }
            }
        }

        List<String> deviceHeaders = session.getHandshakeHeaders().get("X-Device-Id");
        if (deviceHeaders != null && !deviceHeaders.isEmpty()) {
            try {
                return UUID.fromString(deviceHeaders.get(0).trim());
            } catch (Exception ignored) {}
        }

        return null;
    }

    public void disconnectDevice(UUID userId, UUID deviceId, String reason) {
        if (userId == null || deviceId == null) return;
        Set<WebSocketSession> sessions = userSessions.get(userId);
        if (sessions == null) return;

        Map<String, Object> message = Map.of(
            "type", "DEVICE_REMOVED",
            "payload", Map.of(
                "deviceId", deviceId.toString(),
                "reason", reason != null ? reason : "This device session has been logged out."
            )
        );

        for (WebSocketSession s : sessions) {
            UUID dev = sessionToDevice.get(s.getId());
            if (dev != null && dev.equals(deviceId)) {
                sendToSession(s, message);
                try {
                    s.close(new CloseStatus(4001, "Device session revoked"));
                } catch (Exception ignored) {}
            }
        }
    }

    public void disconnectOtherDevices(UUID userId, UUID currentDeviceId, String reason) {
        if (userId == null) return;
        Set<WebSocketSession> sessions = userSessions.get(userId);
        if (sessions == null) return;

        Map<String, Object> message = Map.of(
            "type", "DEVICE_REMOVED",
            "payload", Map.of(
                "reason", reason != null ? reason : "Logged out from all other devices."
            )
        );

        for (WebSocketSession s : sessions) {
            UUID dev = sessionToDevice.get(s.getId());
            if (currentDeviceId == null || dev == null || !dev.equals(currentDeviceId)) {
                sendToSession(s, message);
                try {
                    s.close(new CloseStatus(4001, "Logged out from all other devices"));
                } catch (Exception ignored) {}
            }
        }
    }
}
