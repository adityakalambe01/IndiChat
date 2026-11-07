package com.chat.call.controller;

import com.chat.call.dto.CallLogDto;
import com.chat.call.dto.CreateCallLogRequest;
import com.chat.call.service.CallLogService;
import com.chat.security.CustomUserDetails;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/calls")
public class CallLogController {

    private final CallLogService callLogService;

    public CallLogController(CallLogService callLogService) {
        this.callLogService = callLogService;
    }

    @GetMapping(value = {"/history", "/logs"})
    public ResponseEntity<List<CallLogDto>> getCallHistory(
        @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        List<CallLogDto> history = callLogService.getUserCallHistory(userDetails.getId());
        return ResponseEntity.ok(history);
    }

    @PostMapping("/logs")
    public ResponseEntity<CallLogDto> logCall(
        @RequestBody CreateCallLogRequest req,
        @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        CallLogDto created = callLogService.logCall(req, userDetails.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
