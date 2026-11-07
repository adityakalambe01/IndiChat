package com.chat.community.repository;

import com.chat.community.entity.CommunityChannel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CommunityChannelRepository extends JpaRepository<CommunityChannel, UUID> {
    List<CommunityChannel> findByCommunityIdOrderByCreatedAtAsc(UUID communityId);
}

