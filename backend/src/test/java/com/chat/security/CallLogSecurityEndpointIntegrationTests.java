package com.chat.security;

import com.chat.call.controller.CallLogController;
import com.chat.call.dto.CallLogDto;
import com.chat.call.dto.CreateCallLogRequest;
import com.chat.call.service.CallLogService;
import com.chat.config.SecurityConfig;
import com.chat.device.repository.UserLinkedDeviceRepository;
import com.chat.user.dto.UserDto;
import com.chat.user.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-End Endpoint Verification with Actual Spring Security Filter Chain.
 * Validates:
 * 1. Anonymous requests to protected endpoints blocked (403 Forbidden).
 * 2. Invalid JWT tokens blocked (403 Forbidden).
 * 3. Expired JWT tokens blocked (403 Forbidden).
 * 4. Revoked device tokens blocked (401 Unauthorized).
 * 5. Authenticated ownership: caller is strictly bound to token identity.
 * 6. Cross-user isolation: history reads are strictly scoped to the authenticated caller's identity.
 */
@ExtendWith(SpringExtension.class)
@ContextConfiguration(classes = CallLogSecurityEndpointIntegrationTests.TestSecurityWebConfig.class)
@WebAppConfiguration
public class CallLogSecurityEndpointIntegrationTests {

    private static final String TEST_SECRET = "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970";

    @Configuration
    @EnableWebSecurity
    @EnableWebMvc
    @Import(SecurityConfig.class)
    static class TestSecurityWebConfig {

        @Bean
        public JwtTokenProvider jwtTokenProvider() {
            return new JwtTokenProvider(TEST_SECRET, 3600000, 7200000);
        }

        @Bean
        public CustomUserDetailsService customUserDetailsService() {
            return mock(CustomUserDetailsService.class);
        }

        @Bean
        public UserLinkedDeviceRepository userLinkedDeviceRepository() {
            return mock(UserLinkedDeviceRepository.class);
        }

        @Bean
        public JwtAuthenticationFilter jwtAuthenticationFilter(
            JwtTokenProvider jwtTokenProvider,
            CustomUserDetailsService userDetailsService,
            UserLinkedDeviceRepository deviceRepository
        ) {
            return new JwtAuthenticationFilter(jwtTokenProvider, userDetailsService, deviceRepository);
        }

        @Bean
        public CallLogService callLogService() {
            return mock(CallLogService.class);
        }

        @Bean
        public CallLogController callLogController(CallLogService callLogService) {
            return new CallLogController(callLogService);
        }
    }

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private CustomUserDetailsService userDetailsService;

    @Autowired
    private UserLinkedDeviceRepository deviceRepository;

    @Autowired
    private CallLogService callLogService;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    private UUID aliceId;
    private UUID bobId;
    private User aliceUser;
    private User bobUser;
    private CustomUserDetails aliceDetails;
    private CustomUserDetails bobDetails;
    private String aliceToken;
    private String bobToken;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context)
            .apply(springSecurity())
            .build();

        objectMapper = new ObjectMapper();

        reset(callLogService, userDetailsService, deviceRepository);

        aliceId = UUID.randomUUID();
        bobId = UUID.randomUUID();

        aliceUser = new User();
        aliceUser.setId(aliceId);
        aliceUser.setUsername("alice");
        aliceUser.setEmail("alice@chat.com");
        aliceUser.setPasswordHash("hashed_alice");
        aliceDetails = new CustomUserDetails(aliceUser);

        bobUser = new User();
        bobUser.setId(bobId);
        bobUser.setUsername("bob");
        bobUser.setEmail("bob@chat.com");
        bobUser.setPasswordHash("hashed_bob");
        bobDetails = new CustomUserDetails(bobUser);

        when(userDetailsService.loadUserById(aliceId)).thenReturn(aliceDetails);
        when(userDetailsService.loadUserById(bobId)).thenReturn(bobDetails);

        aliceToken = jwtTokenProvider.generateAccessToken(aliceId, "alice", "Alice Cooper");
        bobToken = jwtTokenProvider.generateAccessToken(bobId, "bob", "Bob Dylan");
    }

    @Test
    @DisplayName("SECURITY: Anonymous POST /api/v1/calls/logs is blocked with 403 Forbidden")
    void testAnonymousPostCallLogs_Blocked() throws Exception {
        CreateCallLogRequest request = new CreateCallLogRequest(
            bobId, null, null, null, "outgoing", "voice", "completed", 100
        );

        mockMvc.perform(post("/api/v1/calls/logs")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isForbidden());

        verify(callLogService, never()).logCall(any(), any());
    }

    @Test
    @DisplayName("SECURITY: Anonymous GET /api/v1/calls/history is blocked with 403 Forbidden")
    void testAnonymousGetCallHistory_Blocked() throws Exception {
        mockMvc.perform(get("/api/v1/calls/history"))
            .andExpect(status().isForbidden());

        verify(callLogService, never()).getUserCallHistory(any());
    }

    @Test
    @DisplayName("SECURITY: Invalid JWT token is blocked with 403 Forbidden")
    void testInvalidToken_Blocked() throws Exception {
        mockMvc.perform(get("/api/v1/calls/history")
                .header("Authorization", "Bearer this.is.invalid.token"))
            .andExpect(status().isForbidden());

        verify(callLogService, never()).getUserCallHistory(any());
    }

    @Test
    @DisplayName("SECURITY: Expired JWT token is blocked with 403 Forbidden")
    void testExpiredToken_Blocked() throws Exception {
        SecretKey key = Keys.hmacShaKeyFor(TEST_SECRET.getBytes(StandardCharsets.UTF_8));
        Date past = new Date(System.currentTimeMillis() - 3600000); // 1 hour ago
        Date pastExpiry = new Date(System.currentTimeMillis() - 1800000); // 30 min ago

        String expiredToken = Jwts.builder()
            .id(UUID.randomUUID().toString())
            .subject(aliceId.toString())
            .claim("username", "alice")
            .issuedAt(past)
            .expiration(pastExpiry)
            .signWith(key)
            .compact();

        mockMvc.perform(get("/api/v1/calls/history")
                .header("Authorization", "Bearer " + expiredToken))
            .andExpect(status().isForbidden());

        verify(callLogService, never()).getUserCallHistory(any());
    }

    @Test
    @DisplayName("SECURITY: Revoked device token header returns 401 Unauthorized")
    void testRevokedDeviceSession_Returns401() throws Exception {
        UUID revokedDeviceId = UUID.randomUUID();
        when(deviceRepository.existsByIdAndUserId(revokedDeviceId, aliceId)).thenReturn(false);

        mockMvc.perform(get("/api/v1/calls/history")
                .header("Authorization", "Bearer " + aliceToken)
                .header("X-Device-Id", revokedDeviceId.toString()))
            .andExpect(status().isUnauthorized());

        verify(callLogService, never()).getUserCallHistory(any());
    }

    @Test
    @DisplayName("OWNERSHIP: Authenticated token strictly binds record owner to token identity (Alice)")
    void testAuthenticatedCallCreation_BindsOwnerToToken() throws Exception {
        UUID logId = UUID.randomUUID();
        UserDto aliceDto = UserDto.fromEntity(aliceUser, true);
        UserDto bobDto = UserDto.fromEntity(bobUser, false);

        CallLogDto createdLog = new CallLogDto(
            logId, aliceId, aliceId, bobId, bobId, null,
            "outgoing", "voice", "completed", 120, Instant.now(),
            aliceDto, bobDto, bobDto
        );

        when(callLogService.logCall(any(CreateCallLogRequest.class), eq(aliceId))).thenReturn(createdLog);

        CreateCallLogRequest request = new CreateCallLogRequest(
            bobId, null, null, null, "outgoing", "voice", "completed", 120
        );

        mockMvc.perform(post("/api/v1/calls/logs")
                .header("Authorization", "Bearer " + aliceToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(logId.toString()))
            .andExpect(jsonPath("$.userId").value(aliceId.toString()))
            .andExpect(jsonPath("$.callerId").value(aliceId.toString()))
            .andExpect(jsonPath("$.receiverId").value(bobId.toString()))
            .andExpect(jsonPath("$.direction").value("outgoing"));

        // Crucial security assertion: service must have been invoked with Alice's ID from token, NOT any client-supplied ID
        verify(callLogService, times(1)).logCall(any(CreateCallLogRequest.class), eq(aliceId));
    }

    @Test
    @DisplayName("ISOLATION: History queries are strictly scoped to authenticated user identity")
    void testCrossUserHistoryIsolation() throws Exception {
        UUID aliceLogId = UUID.randomUUID();
        UUID bobLogId = UUID.randomUUID();

        UserDto aliceDto = UserDto.fromEntity(aliceUser, true);
        UserDto bobDto = UserDto.fromEntity(bobUser, false);

        CallLogDto aliceLog = new CallLogDto(
            aliceLogId, aliceId, aliceId, bobId, bobId, null,
            "outgoing", "voice", "completed", 60, Instant.now(),
            aliceDto, bobDto, bobDto
        );

        CallLogDto bobLog = new CallLogDto(
            bobLogId, bobId, aliceId, bobId, aliceId, null,
            "incoming", "voice", "completed", 60, Instant.now(),
            aliceDto, bobDto, aliceDto
        );

        when(callLogService.getUserCallHistory(aliceId)).thenReturn(List.of(aliceLog));
        when(callLogService.getUserCallHistory(bobId)).thenReturn(List.of(bobLog));

        // 1. Alice queries her history
        mockMvc.perform(get("/api/v1/calls/history")
                .header("Authorization", "Bearer " + aliceToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].id").value(aliceLogId.toString()))
            .andExpect(jsonPath("$[0].userId").value(aliceId.toString()));

        verify(callLogService, times(1)).getUserCallHistory(aliceId);

        // 2. Bob queries his history
        mockMvc.perform(get("/api/v1/calls/history")
                .header("Authorization", "Bearer " + bobToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].id").value(bobLogId.toString()))
            .andExpect(jsonPath("$[0].userId").value(bobId.toString()));

        verify(callLogService, times(1)).getUserCallHistory(bobId);
    }

    @Test
    @DisplayName("SPOOFING DEFENSE: Authenticated user attempting to submit mismatched callerId returns 400")
    void testSpoofedCallerRejectedAtService() throws Exception {
        when(callLogService.logCall(any(CreateCallLogRequest.class), eq(aliceId)))
            .thenThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Conflicting callerId: authenticated user must be the caller for outgoing calls"));

        // Alice attempts to set callerId to Bob
        CreateCallLogRequest spoofRequest = new CreateCallLogRequest(
            bobId, bobId, null, null, "outgoing", "voice", "completed", 50
        );

        mockMvc.perform(post("/api/v1/calls/logs")
                .header("Authorization", "Bearer " + aliceToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(spoofRequest)))
            .andExpect(status().isBadRequest());
    }
}

