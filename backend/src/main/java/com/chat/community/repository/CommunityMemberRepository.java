package com.chat.community.repository;

import com.chat.community.entity.CommunityMember;
import com.chat.community.entity.CommunityMember.CommunityMemberId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CommunityMemberRepository extends JpaRepository<CommunityMember, CommunityMemberId> {
    List<CommunityMember> findByIdUserId(UUID userId);
    List<CommunityMember> findByIdCommunityId(UUID communityId);
    boolean existsByIdCommunityIdAndIdUserId(UUID communityId, UUID userId);
    java.util.Optional<CommunityMember> findByIdCommunityIdAndIdUserId(UUID communityId, UUID userId);
    int countByIdCommunityId(UUID communityId);
}

