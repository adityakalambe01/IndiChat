package com.chat.security;

import com.chat.call.controller.CallLogController;
import com.chat.call.dto.CallLogDto;
import com.chat.call.dto.CreateCallLogRequest;
import com.chat.call.service.CallLogService;
import com.chat.security.CustomUserDetails;
import com.chat.user.dto.UserDto;
import com.chat.user.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Controller-Level HTTP Verification for /api/v1/calls endpoints.
 * Specifically validates:
 * - HTTP 201 Created status on POST /api/v1/calls/logs
 * - HTTP 200 OK on GET /api/v1/calls/history and /api/v1/calls/logs
 * - HTTP 400 Bad Request on invalid payloads
 * - HTTP 403 Forbidden on unauthorized access
 * - JSON serialization and deserialization
 */
@ExtendWith(MockitoExtension.class)
public class CallLogEndpointTests {

    @Mock
    private CallLogService callLogService;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    private UUID authUserId;
    private User authUser;
    private CustomUserDetails mockUserDetails;

    @BeforeEach
    void setUp() {
        authUserId = UUID.randomUUID();
        authUser = new User();
        authUser.setId(authUserId);
        authUser.setUsername("endpoint_user");
        authUser.setEmail("endpoint@chat.com");
        authUser.setPasswordHash("hashed_pw");
        mockUserDetails = new CustomUserDetails(authUser);

        CallLogController controller = new CallLogController(callLogService);

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
            .setCustomArgumentResolvers(new HandlerMethodArgumentResolver() {
                @Override
                public boolean supportsParameter(MethodParameter parameter) {
                    return parameter.hasParameterAnnotation(AuthenticationPrincipal.class) ||
                           CustomUserDetails.class.isAssignableFrom(parameter.getParameterType());
                }

                @Override
                public Object resolveArgument(MethodParameter parameter,
                                              ModelAndViewContainer mavContainer,
                                              NativeWebRequest webRequest,
                                              WebDataBinderFactory binderFactory) {
                    return mockUserDetails;
                }
            })
            .build();

        objectMapper = new ObjectMapper();
    }

    @Test
    @DisplayName("HTTP 201 CREATED: POST /api/v1/calls/logs returns 201 Created with CallLogDto body")
    void testPostCallLogs_Returns201Created() throws Exception {
        UUID peerId = UUID.randomUUID();
        UUID logId = UUID.randomUUID();

        User peerUser = new User();
        peerUser.setId(peerId);
        peerUser.setUsername("peer_user");
        peerUser.setEmail("peer@chat.com");

        UserDto callerDto = UserDto.fromEntity(authUser, true);
        UserDto receiverDto = UserDto.fromEntity(peerUser, false);

        CallLogDto returnedDto = new CallLogDto(
            logId, authUserId, authUserId, peerId, peerId, null,
            "outgoing", "voice", "completed", 120, Instant.now(),
            callerDto, receiverDto, receiverDto
        );

        when(callLogService.logCall(any(CreateCallLogRequest.class), eq(authUserId))).thenReturn(returnedDto);

        CreateCallLogRequest request = new CreateCallLogRequest(
            peerId, null, null, null, "outgoing", "voice", "completed", 120
        );

        mockMvc.perform(post("/api/v1/calls/logs")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(logId.toString()))
            .andExpect(jsonPath("$.userId").value(authUserId.toString()))
            .andExpect(jsonPath("$.direction").value("outgoing"))
            .andExpect(jsonPath("$.durationSeconds").value(120))
            .andExpect(jsonPath("$.status").value("completed"));
    }

    @Test
    @DisplayName("HTTP 200 OK: GET /api/v1/calls/history returns 200 OK with list")
    void testGetCallHistory_Returns200Ok() throws Exception {
        when(callLogService.getUserCallHistory(authUserId)).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/calls/history"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
    }

    @Test
    @DisplayName("HTTP 200 OK: GET /api/v1/calls/logs alias endpoint returns 200 OK")
    void testGetCallLogsAlias_Returns200Ok() throws Exception {
        when(callLogService.getUserCallHistory(authUserId)).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/calls/logs"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
    }

    @Test
    @DisplayName("HTTP 400 BAD REQUEST: POST /api/v1/calls/logs returns 400 on conflicting fields")
    void testPostCallLogs_Returns400BadRequest() throws Exception {
        when(callLogService.logCall(any(CreateCallLogRequest.class), eq(authUserId)))
            .thenThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Conflicting participant fields"));

        CreateCallLogRequest request = new CreateCallLogRequest(
            UUID.randomUUID(), null, UUID.randomUUID(), null, "outgoing", "voice", "completed", 10
        );

        mockMvc.perform(post("/api/v1/calls/logs")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("HTTP 403 FORBIDDEN: POST /api/v1/calls/logs returns 403 on unrelated conversation")
    void testPostCallLogs_Returns403Forbidden() throws Exception {
        when(callLogService.logCall(any(CreateCallLogRequest.class), eq(authUserId)))
            .thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Authenticated user is not a member"));

        CreateCallLogRequest request = new CreateCallLogRequest(
            UUID.randomUUID(), null, null, UUID.randomUUID(), "outgoing", "voice", "completed", 10
        );

        mockMvc.perform(post("/api/v1/calls/logs")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isForbidden());
    }
}
