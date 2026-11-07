package com.chat.message.service;

import com.chat.conversation.repository.ConversationMemberRepository;
import com.chat.message.dto.MessageDto;
import com.chat.message.entity.Message;
import com.chat.message.entity.UserStarredMessage;
import com.chat.message.repository.MessageRepository;
import com.chat.message.repository.UserStarredMessageRepository;
import com.chat.user.entity.User;
import com.chat.user.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
public class StarredMessageService {

    private final UserStarredMessageRepository starredRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ConversationMemberRepository memberRepository;
    private final MessageService messageService;

    public StarredMessageService(
        UserStarredMessageRepository starredRepository,
        MessageRepository messageRepository,
        UserRepository userRepository,
        ConversationMemberRepository memberRepository,
        MessageService messageService
    ) {
        this.starredRepository = starredRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.memberRepository = memberRepository;
        this.messageService = messageService;
    }

    @Transactional
    public boolean toggleStar(UUID messageId, UUID userId) {
        Message message = messageRepository.findById(messageId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found"));

        if (!memberRepository.existsByIdConversationIdAndIdUserId(message.getConversation().getId(), userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member of this conversation");
        }

        if (starredRepository.existsByIdUserIdAndIdMessageId(userId, messageId)) {
            starredRepository.deleteByIdUserIdAndIdMessageId(userId, messageId);
            return false;
        } else {
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
            UserStarredMessage starred = new UserStarredMessage(user, message, message.getConversation());
            starredRepository.save(starred);
            return true;
        }
    }

    @Transactional(readOnly = true)
    public List<MessageDto> getStarredMessages(UUID userId) {
        List<UserStarredMessage> starredList = starredRepository.findByIdUserIdOrderByCreatedAtDesc(userId);
        return starredList.stream()
            .map(sm -> {
                MessageDto dto = messageService.toDto(sm.getMessage());
                return new MessageDto(
                    dto.id(),
                    dto.conversationId(),
                    dto.senderId(),
                    dto.clientMessageId(),
                    dto.type(),
                    dto.content(),
                    dto.replyToId(),
                    dto.createdAt(),
                    dto.editedAt(),
                    dto.deletedAt(),
                    dto.sender(),
                    dto.receipts(),
                    dto.reactions(),
                    dto.reactionSummaries(),
                    true
                );
            })
            .toList();
    }

    @Transactional(readOnly = true)
    public boolean isStarred(UUID messageId, UUID userId) {
        return starredRepository.existsByIdUserIdAndIdMessageId(userId, messageId);
    }
}

