package com.chat.status.repository;

import com.chat.status.entity.UserStatusStory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface UserStatusStoryRepository extends JpaRepository<UserStatusStory, UUID> {
    List<UserStatusStory> findByExpiresAtAfterOrderByCreatedAtDesc(Instant now);
    List<UserStatusStory> findByUserIdAndExpiresAtAfterOrderByCreatedAtDesc(UUID userId, Instant now);
    List<UserStatusStory> findByUserIdInAndExpiresAtAfterOrderByCreatedAtDesc(List<UUID> userIds, Instant now);
}

