package com.chat.status.controller;

import com.chat.security.CustomUserDetails;
import com.chat.status.dto.CreateStatusStoryRequest;
import com.chat.status.dto.StatusStoryDto;
import com.chat.status.service.StatusStoryService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/status")
public class StatusStoryController {

    private final StatusStoryService statusStoryService;

    public StatusStoryController(StatusStoryService statusStoryService) {
        this.statusStoryService = statusStoryService;
    }

    @GetMapping
    public ResponseEntity<List<StatusStoryDto>> getActiveStories(
        @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        List<StatusStoryDto> stories = statusStoryService.getActiveStories(userDetails.getId());
        return ResponseEntity.ok(stories);
    }

    @PostMapping
    public ResponseEntity<StatusStoryDto> createStory(
        @RequestBody CreateStatusStoryRequest req,
        @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        StatusStoryDto story = statusStoryService.createStory(req, userDetails.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(story);
    }
}

