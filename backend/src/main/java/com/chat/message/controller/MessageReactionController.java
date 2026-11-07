package com.chat.message.controller;

import com.chat.message.dto.MessageDto;
import com.chat.message.dto.MessageReactionDto;
import com.chat.message.dto.ReactionSummaryDto;
import com.chat.message.service.MessageReactionService;
import com.chat.message.service.StarredMessageService;
import com.chat.security.CustomUserDetails;
import com.chat.websocket.ChatWebSocketHandler;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/messages")
public class MessageReactionController {

    private final MessageReactionService reactionService;
    private final StarredMessageService starredMessageService;
    private final ChatWebSocketHandler chatWebSocketHandler;

    public MessageReactionController(
        MessageReactionService reactionService,
        StarredMessageService starredMessageService,
        ChatWebSocketHandler chatWebSocketHandler
    ) {
        this.reactionService = reactionService;
        this.starredMessageService = starredMessageService;
        this.chatWebSocketHandler = chatWebSocketHandler;
    }

    public record ReactionRequest(String emoji) {}

    @PostMapping("/{messageId}/reactions")
    public ResponseEntity<Map<String, Object>> addReaction(
        @PathVariable("messageId") UUID messageId,
        @RequestBody ReactionRequest req,
        @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        List<MessageReactionDto> reactions = reactionService.addReaction(messageId, userDetails.getId(), req.emoji());
        List<ReactionSummaryDto> summaries = reactionService.summarizeReactions(reactions);

        chatWebSocketHandler.broadcastReactionUpdated(messageId, userDetails.getId(), req.emoji(), "add", reactions, summaries);

        return ResponseEntity.ok(Map.of(
            "messageId", messageId,
            "reactions", reactions,
            "summaries", summaries
        ));
    }

    @DeleteMapping("/{messageId}/reactions")
    public ResponseEntity<Map<String, Object>> removeReaction(
        @PathVariable("messageId") UUID messageId,
        @RequestParam("emoji") String emoji,
        @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        List<MessageReactionDto> reactions = reactionService.removeReaction(messageId, userDetails.getId(), emoji);
        List<ReactionSummaryDto> summaries = reactionService.summarizeReactions(reactions);

        chatWebSocketHandler.broadcastReactionUpdated(messageId, userDetails.getId(), emoji, "remove", reactions, summaries);

        return ResponseEntity.ok(Map.of(
            "messageId", messageId,
            "reactions", reactions,
            "summaries", summaries
        ));
    }

    @PostMapping("/{messageId}/star")
    public ResponseEntity<Map<String, Object>> toggleStar(
        @PathVariable("messageId") UUID messageId,
        @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        boolean isStarred = starredMessageService.toggleStar(messageId, userDetails.getId());
        return ResponseEntity.ok(Map.of(
            "messageId", messageId,
            "isStarred", isStarred
        ));
    }

    @GetMapping("/starred")
    public ResponseEntity<List<MessageDto>> getStarredMessages(
        @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        List<MessageDto> starred = starredMessageService.getStarredMessages(userDetails.getId());
        return ResponseEntity.ok(starred);
    }
}

