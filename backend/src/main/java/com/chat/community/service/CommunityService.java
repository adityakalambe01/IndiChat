package com.chat.community.service;

import com.chat.community.dto.AddSubGroupRequest;
import com.chat.community.dto.CommunityChannelDto;
import com.chat.community.dto.CommunityDto;
import com.chat.community.dto.CreateCommunityRequest;
import com.chat.community.entity.Community;
import com.chat.community.entity.CommunityChannel;
import com.chat.community.entity.CommunityMember;
import com.chat.community.repository.CommunityChannelRepository;
import com.chat.community.repository.CommunityMemberRepository;
import com.chat.community.repository.CommunityRepository;
import com.chat.conversation.entity.Conversation;
import com.chat.conversation.entity.ConversationMember;
import com.chat.conversation.repository.ConversationMemberRepository;
import com.chat.conversation.repository.ConversationRepository;
import com.chat.user.entity.User;
import com.chat.user.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class CommunityService {

    private final CommunityRepository communityRepository;
    private final CommunityChannelRepository channelRepository;
    private final CommunityMemberRepository memberRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final UserRepository userRepository;

    public CommunityService(
        CommunityRepository communityRepository,
        CommunityChannelRepository channelRepository,
        CommunityMemberRepository memberRepository,
        ConversationRepository conversationRepository,
        ConversationMemberRepository conversationMemberRepository,
        UserRepository userRepository
    ) {
        this.communityRepository = communityRepository;
        this.channelRepository = channelRepository;
        this.memberRepository = memberRepository;
        this.conversationRepository = conversationRepository;
        this.conversationMemberRepository = conversationMemberRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public CommunityDto createCommunity(CreateCommunityRequest req, UUID creatorId) {
        User creator = userRepository.findById(creatorId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Community community = new Community(req.name(), req.description(), null, creator);
        community = communityRepository.save(community);

        // Add creator as ADMIN member
        CommunityMember member = new CommunityMember(community, creator, "ADMIN");
        memberRepository.save(member);

        List<CommunityChannelDto> channelDtos = new ArrayList<>();

        // Create General announcement channel
        Conversation generalConv = new Conversation("GROUP", req.name() + " · Announcements", creator.getId());
        generalConv = conversationRepository.save(generalConv);
        ConversationMember convMember = new ConversationMember(generalConv, creator, "ADMIN");
        conversationMemberRepository.save(convMember);

        CommunityChannel generalChannel = new CommunityChannel(community, generalConv, "Announcements", true);
        generalChannel = channelRepository.save(generalChannel);
        channelDtos.add(CommunityChannelDto.fromEntity(generalChannel));

        // Create additional channels if requested
        if (req.channelNames() != null) {
            for (String chName : req.channelNames()) {
                if (chName == null || chName.isBlank()) continue;
                Conversation chConv = new Conversation("GROUP", chName, creator.getId());
                chConv = conversationRepository.save(chConv);
                ConversationMember m = new ConversationMember(chConv, creator, "ADMIN");
                conversationMemberRepository.save(m);

                CommunityChannel ch = new CommunityChannel(community, chConv, chName, false);
                ch = channelRepository.save(ch);
                channelDtos.add(CommunityChannelDto.fromEntity(ch));
            }
        }

        return CommunityDto.fromEntity(community, channelDtos, 1);
    }

    @Transactional
    public CommunityChannelDto addSubGroup(UUID communityId, AddSubGroupRequest req, UUID userId) {
        Community community = communityRepository.findById(communityId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Community not found"));

        CommunityMember member = memberRepository.findByIdCommunityIdAndIdUserId(communityId, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member of this community"));

        if (!"ADMIN".equalsIgnoreCase(member.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only community admins can create channels or sub-groups");
        }

        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Conversation conv = new Conversation("GROUP", req.name(), user.getId());
        conv = conversationRepository.save(conv);
        ConversationMember convMember = new ConversationMember(conv, user, "ADMIN");
        conversationMemberRepository.save(convMember);

        CommunityChannel channel = new CommunityChannel(community, conv, req.name(), req.isAnnouncement());
        channel = channelRepository.save(channel);

        community.setUpdatedAt(Instant.now());
        communityRepository.save(community);

        return CommunityChannelDto.fromEntity(channel);
    }

    @Transactional(readOnly = true)
    public List<CommunityDto> getUserCommunities(UUID userId) {
        List<CommunityMember> memberships = memberRepository.findByIdUserId(userId);
        List<CommunityDto> result = new ArrayList<>();
        for (CommunityMember m : memberships) {
            Community comm = m.getCommunity();
            List<CommunityChannelDto> channels = channelRepository.findByCommunityIdOrderByCreatedAtAsc(comm.getId())
                .stream()
                .map(CommunityChannelDto::fromEntity)
                .toList();
            int memberCount = memberRepository.countByIdCommunityId(comm.getId());
            result.add(CommunityDto.fromEntity(comm, channels, memberCount));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public CommunityDto getCommunity(UUID communityId, UUID userId) {
        Community comm = communityRepository.findById(communityId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Community not found"));

        if (!memberRepository.existsByIdCommunityIdAndIdUserId(communityId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member of this community");
        }

        List<CommunityChannelDto> channels = channelRepository.findByCommunityIdOrderByCreatedAtAsc(comm.getId())
            .stream()
            .map(CommunityChannelDto::fromEntity)
            .toList();
        int memberCount = memberRepository.countByIdCommunityId(comm.getId());
        return CommunityDto.fromEntity(comm, channels, memberCount);
    }
}

