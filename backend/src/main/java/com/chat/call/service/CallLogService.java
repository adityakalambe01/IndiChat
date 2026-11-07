package com.chat.call.service;

import com.chat.call.dto.CallLogDto;
import com.chat.call.dto.CreateCallLogRequest;
import com.chat.call.entity.CallLog;
import com.chat.call.repository.CallLogRepository;
import com.chat.conversation.entity.Conversation;
import com.chat.conversation.repository.ConversationMemberRepository;
import com.chat.conversation.repository.ConversationRepository;
import com.chat.user.entity.User;
import com.chat.user.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Service managing personal call-history journal entries.
 *
 * NOTE ON CLIENT-REPORTED SEMANTICS:
 * CallLog records represent personal, client-reported call journal entries recorded
 * by client applications upon call termination. They are not server-verified WebRTC
 * signaling transcripts or cryptographically verified proof that audio/video frames
 * were exchanged. Each participant independently submits a personal journal record.
 */
@Service
public class CallLogService {

    private static final Set<String> VALID_DIRECTIONS = Set.of("outgoing", "incoming", "missed");
    private static final Set<String> VALID_TYPES = Set.of("voice", "video");
    private static final Set<String> VALID_STATUSES = Set.of("completed", "missed", "rejected", "busy", "no_answer");

    private final CallLogRepository callLogRepository;
    private final UserRepository userRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository conversationMemberRepository;

    public CallLogService(
        CallLogRepository callLogRepository,
        UserRepository userRepository,
        ConversationRepository conversationRepository,
        ConversationMemberRepository conversationMemberRepository
    ) {
        this.callLogRepository = callLogRepository;
        this.userRepository = userRepository;
        this.conversationRepository = conversationRepository;
        this.conversationMemberRepository = conversationMemberRepository;
    }

    @Transactional
    public CallLogDto logCall(CreateCallLogRequest req, UUID authUserId) {
        if (authUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user ID is required");
        }

        // 1. Duration validation
        if (req.durationSeconds() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "durationSeconds is required");
        }
        if (req.durationSeconds() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "durationSeconds cannot be negative");
        }

        // 2. Call type validation & normalization
        String rawType = req.callType() != null ? req.callType().trim().toLowerCase() : "voice";
        if (!VALID_TYPES.contains(rawType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid callType: must be voice or video");
        }
        String callType = rawType;

        // 3. Status validation & normalization (supporting legacy 'connected' -> 'completed')
        String rawStatus = req.status() != null ? req.status().trim().toLowerCase() : "completed";
        if ("connected".equals(rawStatus)) {
            rawStatus = "completed";
        }
        if (!VALID_STATUSES.contains(rawStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid call status: " + req.status());
        }
        String status = rawStatus;

        // 4. Direction validation & legacy fallback
        String rawDir = req.direction() != null ? req.direction().trim().toLowerCase() : null;
        if (rawDir == null) {
            if (req.receiverId() != null && req.callerId() == null && req.peerUserId() == null) {
                // Legacy compatibility: requests with only receiverId default to outgoing
                rawDir = "outgoing";
            } else {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "direction is required: must be outgoing, incoming, or missed");
            }
        }
        if (!VALID_DIRECTIONS.contains(rawDir)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid direction: must be outgoing, incoming, or missed");
        }
        String direction = rawDir;

        // 5. Direction, status, and duration combination rules
        if ("missed".equals(direction)) {
            if (req.durationSeconds() != 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "durationSeconds must be 0 for missed calls");
            }
            if (req.status() != null && !"missed".equals(status)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be 'missed' for direction 'missed'");
            }
            status = "missed";
        }
        if ("missed".equals(status)) {
            if (req.durationSeconds() != 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "durationSeconds must be 0 for status missed");
            }
            if ("outgoing".equals(direction)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Outgoing call cannot have status missed (expected no_answer, rejected, or busy)");
            }
        }

        // 6. Unambiguous peer resolution & participant conflict detection
        UUID callerId;
        UUID receiverId;
        UUID targetPeer;

        if ("outgoing".equals(direction)) {
            // Authenticated user must be the caller
            if (req.callerId() != null && !req.callerId().equals(authUserId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Conflicting callerId: authenticated user must be the caller for outgoing calls");
            }

            // Peer receiver resolution
            if (req.peerUserId() != null && req.receiverId() != null) {
                if (!req.peerUserId().equals(req.receiverId())) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Conflicting participant fields: peerUserId and receiverId do not match");
                }
                targetPeer = req.peerUserId();
            } else if (req.peerUserId() != null) {
                targetPeer = req.peerUserId();
            } else if (req.receiverId() != null) {
                targetPeer = req.receiverId();
            } else {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unambiguous peer required: receiverId or peerUserId must be provided for outgoing calls");
            }

            if (targetPeer.equals(authUserId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Caller and receiver cannot be the same user (self-call disallowed)");
            }

            callerId = authUserId;
            receiverId = targetPeer;
        } else {
            // "incoming" or "missed": Authenticated user must be the receiver
            if (req.receiverId() != null && !req.receiverId().equals(authUserId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Conflicting receiverId: authenticated user must be the receiver for incoming/missed calls");
            }

            // Peer caller resolution
            if (req.peerUserId() != null && req.callerId() != null) {
                if (!req.peerUserId().equals(req.callerId())) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Conflicting participant fields: peerUserId and callerId do not match");
                }
                targetPeer = req.peerUserId();
            } else if (req.peerUserId() != null) {
                targetPeer = req.peerUserId();
            } else if (req.callerId() != null) {
                targetPeer = req.callerId();
            } else {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unambiguous peer required: callerId or peerUserId must be provided for incoming/missed calls");
            }

            if (targetPeer.equals(authUserId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Caller and receiver cannot be the same user (self-call disallowed)");
            }

            callerId = targetPeer;
            receiverId = authUserId;
        }

        // 7. Look up users
        User owner = userRepository.findById(authUserId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Authenticated user not found"));

        User caller = authUserId.equals(callerId) ? owner : userRepository.findById(callerId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Caller not found"));

        User receiver = authUserId.equals(receiverId) ? owner : userRepository.findById(receiverId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Receiver not found"));

        // 8. Conversation validation (if associated)
        Conversation conversation = null;
        if (req.conversationId() != null) {
            conversation = conversationRepository.findById(req.conversationId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));

            if (!conversationMemberRepository.existsByIdConversationIdAndIdUserId(req.conversationId(), authUserId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Authenticated user is not a member of the conversation");
            }

            if (!conversationMemberRepository.existsByIdConversationIdAndIdUserId(req.conversationId(), targetPeer)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Peer is not a member of the conversation");
            }
        }

        // 9. Create and persist personal call log entry
        CallLog callLog = new CallLog(
            owner,
            caller,
            receiver,
            conversation,
            direction,
            callType,
            status,
            req.durationSeconds()
        );

        callLog = callLogRepository.save(callLog);
        return CallLogDto.fromEntity(callLog);
    }

    @Transactional(readOnly = true)
    public List<CallLogDto> getUserCallHistory(UUID userId) {
        // Scoped strictly to the authenticated user's personal journal
        List<CallLog> logs = callLogRepository.findByUserIdOrderByCreatedAtDesc(userId);
        return logs.stream().map(CallLogDto::fromEntity).toList();
    }
}
