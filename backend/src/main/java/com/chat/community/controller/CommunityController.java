package com.chat.community.controller;

import com.chat.community.dto.AddSubGroupRequest;
import com.chat.community.dto.CommunityChannelDto;
import com.chat.community.dto.CommunityDto;
import com.chat.community.dto.CreateCommunityRequest;
import com.chat.community.service.CommunityService;
import com.chat.security.CustomUserDetails;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/communities")
public class CommunityController {

    private final CommunityService communityService;

    public CommunityController(CommunityService communityService) {
        this.communityService = communityService;
    }

    @GetMapping
    public ResponseEntity<List<CommunityDto>> getUserCommunities(
        @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        List<CommunityDto> list = communityService.getUserCommunities(userDetails.getId());
        return ResponseEntity.ok(list);
    }

    @PostMapping
    public ResponseEntity<CommunityDto> createCommunity(
        @RequestBody CreateCommunityRequest req,
        @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        CommunityDto created = communityService.createCommunity(req, userDetails.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/{id}")
    public ResponseEntity<CommunityDto> getCommunity(
        @PathVariable("id") UUID id,
        @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        CommunityDto community = communityService.getCommunity(id, userDetails.getId());
        return ResponseEntity.ok(community);
    }

    @PostMapping("/{id}/channels")
    public ResponseEntity<CommunityChannelDto> addSubGroup(
        @PathVariable("id") UUID id,
        @RequestBody AddSubGroupRequest req,
        @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        CommunityChannelDto channel = communityService.addSubGroup(id, req, userDetails.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(channel);
    }
}

