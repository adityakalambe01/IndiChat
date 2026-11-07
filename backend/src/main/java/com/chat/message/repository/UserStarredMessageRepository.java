package com.chat.message.repository;

import com.chat.message.entity.UserStarredMessage;
import com.chat.message.entity.UserStarredMessage.StarredMessageId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface UserStarredMessageRepository extends JpaRepository<UserStarredMessage, StarredMessageId> {
    List<UserStarredMessage> findByIdUserIdOrderByCreatedAtDesc(UUID userId);
    boolean existsByIdUserIdAndIdMessageId(UUID userId, UUID messageId);
    void deleteByIdUserIdAndIdMessageId(UUID userId, UUID messageId);
}

