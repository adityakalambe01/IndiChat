package com.chat.message.service;

import com.chat.conversation.entity.ConversationMember;
import com.chat.conversation.repository.ConversationMemberRepository;
import com.chat.message.dto.MessageReactionDto;
import com.chat.message.dto.ReactionSummaryDto;
import com.chat.message.entity.Message;
import com.chat.message.entity.MessageReaction;
import com.chat.message.repository.MessageReactionRepository;
import com.chat.message.repository.MessageRepository;
import com.chat.user.entity.User;
import com.chat.user.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class MessageReactionService {

    private final MessageReactionRepository reactionRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ConversationMemberRepository memberRepository;

    public MessageReactionService(
        MessageReactionRepository reactionRepository,
        MessageRepository messageRepository,
        UserRepository userRepository,
        ConversationMemberRepository memberRepository
    ) {
        this.reactionRepository = reactionRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.memberRepository = memberRepository;
    }

    @Transactional
    public List<MessageReactionDto> addReaction(UUID messageId, UUID userId, String emoji) {
        Message message = messageRepository.findById(messageId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found"));

        if (!memberRepository.existsByIdConversationIdAndIdUserId(message.getConversation().getId(), userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member of this conversation");
        }

        Optional<MessageReaction> existing = reactionRepository.findByMessageIdAndUserIdAndEmoji(messageId, userId, emoji);
        if (existing.isEmpty()) {
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
            MessageReaction reaction = new MessageReaction(message, user, emoji);
            reactionRepository.save(reaction);
        }

        return getReactionsForMessage(messageId);
    }

    @Transactional
    public List<MessageReactionDto> removeReaction(UUID messageId, UUID userId, String emoji) {
        Message message = messageRepository.findById(messageId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found"));

        if (!memberRepository.existsByIdConversationIdAndIdUserId(message.getConversation().getId(), userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member of this conversation");
        }

        reactionRepository.deleteByMessageIdAndUserIdAndEmoji(messageId, userId, emoji);
        return getReactionsForMessage(messageId);
    }

    @Transactional(readOnly = true)
    public List<MessageReactionDto> getReactionsForMessage(UUID messageId) {
        return reactionRepository.findByMessageId(messageId).stream()
            .map(MessageReactionDto::fromEntity)
            .toList();
    }

    public List<ReactionSummaryDto> summarizeReactions(List<MessageReactionDto> reactions) {
        if (reactions == null || reactions.isEmpty()) {
            return List.of();
        }
        Map<String, List<UUID>> grouped = reactions.stream()
            .collect(Collectors.groupingBy(
                MessageReactionDto::emoji,
                Collectors.mapping(MessageReactionDto::userId, Collectors.toList())
            ));

        return grouped.entrySet().stream()
            .map(e -> new ReactionSummaryDto(e.getKey(), e.getValue().size(), e.getValue()))
            .toList();
    }
}

