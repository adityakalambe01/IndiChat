package com.chat.security;

import com.chat.call.dto.CallLogDto;
import com.chat.call.dto.CreateCallLogRequest;
import com.chat.call.entity.CallLog;
import com.chat.call.repository.CallLogRepository;
import com.chat.call.service.CallLogService;
import com.chat.community.dto.AddSubGroupRequest;
import com.chat.community.dto.CommunityChannelDto;
import com.chat.community.entity.Community;
import com.chat.community.entity.CommunityChannel;
import com.chat.community.entity.CommunityMember;
import com.chat.community.repository.CommunityChannelRepository;
import com.chat.community.repository.CommunityMemberRepository;
import com.chat.community.repository.CommunityRepository;
import com.chat.contact.repository.ContactRepository;
import com.chat.conversation.entity.Conversation;
import com.chat.conversation.entity.ConversationMember;
import com.chat.conversation.repository.ConversationMemberRepository;
import com.chat.conversation.repository.ConversationRepository;
import com.chat.community.service.CommunityService;
import com.chat.settings.entity.UserSettings;
import com.chat.settings.repository.UserSettingsRepository;
import com.chat.status.dto.StatusStoryDto;
import com.chat.status.entity.UserStatusStory;
import com.chat.status.repository.UserStatusStoryRepository;
import com.chat.status.service.StatusStoryService;
import com.chat.user.entity.User;
import com.chat.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Phase 1 Security Remediation Regression Test Suite.
 * Covers:
 * 1. Community Channel Creation Authorization (ADMIN vs MEMBER vs Non-member)
 * 2. Status Story Viewer Scoping & Privacy Enforcement
 * 3. Personal Call History Ownership, Integrity, Validation & Backward Compatibility
 */
@ExtendWith(MockitoExtension.class)
public class Phase1SecurityRemediationTests {

    // =========================================================================
    // 1. COMMUNITY CHANNEL CREATION TESTS
    // =========================================================================
    @Nested
    @DisplayName("Community Channel Creation Authorization")
    class CommunityChannelAuthorizationTests {

        @Mock private CommunityRepository communityRepository;
        @Mock private CommunityChannelRepository communityChannelRepository;
        @Mock private CommunityMemberRepository communityMemberRepository;
        @Mock private ConversationRepository conversationRepository;
        @Mock private ConversationMemberRepository conversationMemberRepository;
        @Mock private UserRepository userRepository;

        private CommunityService communityService;

        private UUID communityId;
        private UUID adminUserId;
        private UUID regularMemberUserId;
        private UUID nonMemberUserId;
        private Community community;
        private User adminUser;
        private Conversation conversation;

        @BeforeEach
        void setUp() {
            communityService = new CommunityService(
                communityRepository,
                communityChannelRepository,
                communityMemberRepository,
                conversationRepository,
                conversationMemberRepository,
                userRepository
            );

            communityId = UUID.randomUUID();
            adminUserId = UUID.randomUUID();
            regularMemberUserId = UUID.randomUUID();
            nonMemberUserId = UUID.randomUUID();

            adminUser = new User();
            adminUser.setId(adminUserId);
            adminUser.setUsername("admin_user");

            community = new Community("Test Community", "Desc", "icon.png", adminUser);
            community.setId(communityId);

            conversation = new Conversation("CHANNEL", "Announcements", adminUserId);
            conversation.setId(UUID.randomUUID());
        }

        @Test
        @DisplayName("ALLOWED: Community Admin creates channel successfully")
        void testAdminCanCreateChannel_Success() {
            when(communityRepository.findById(communityId)).thenReturn(Optional.of(community));
            when(userRepository.findById(adminUserId)).thenReturn(Optional.of(adminUser));

            CommunityMember adminMember = new CommunityMember(community, adminUser, "ADMIN");
            when(communityMemberRepository.findByIdCommunityIdAndIdUserId(communityId, adminUserId))
                .thenReturn(Optional.of(adminMember));

            when(conversationRepository.save(any(Conversation.class))).thenReturn(conversation);

            CommunityChannel savedChannel = new CommunityChannel(community, conversation, "Announcements", true);
            savedChannel.setId(UUID.randomUUID());
            when(communityChannelRepository.save(any(CommunityChannel.class))).thenReturn(savedChannel);

            AddSubGroupRequest request = new AddSubGroupRequest("Announcements", true);
            CommunityChannelDto result = communityService.addSubGroup(communityId, request, adminUserId);

            assertNotNull(result);
            assertEquals("Announcements", result.name());
            verify(communityChannelRepository, times(1)).save(any(CommunityChannel.class));
            verify(conversationRepository, times(1)).save(any(Conversation.class));
        }

        @Test
        @DisplayName("DENIED: Regular member cannot create channel (403 Forbidden, no records created)")
        void testRegularMemberCannotCreateChannel_Forbidden() {
            when(communityRepository.findById(communityId)).thenReturn(Optional.of(community));

            User regularUser = new User();
            regularUser.setId(regularMemberUserId);
            regularUser.setUsername("member_user");

            CommunityMember regularMember = new CommunityMember(community, regularUser, "MEMBER");
            when(communityMemberRepository.findByIdCommunityIdAndIdUserId(communityId, regularMemberUserId))
                .thenReturn(Optional.of(regularMember));

            AddSubGroupRequest request = new AddSubGroupRequest("Member Discussion", false);

            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                communityService.addSubGroup(communityId, request, regularMemberUserId)
            );

            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
            assertTrue(ex.getReason().contains("Only community admins can create channels"));
            verify(communityChannelRepository, never()).save(any());
            verify(conversationRepository, never()).save(any());
        }

        @Test
        @DisplayName("DENIED: Non-member cannot create channel (403 Forbidden, no records created)")
        void testNonMemberCannotCreateChannel_Forbidden() {
            when(communityRepository.findById(communityId)).thenReturn(Optional.of(community));
            when(communityMemberRepository.findByIdCommunityIdAndIdUserId(communityId, nonMemberUserId))
                .thenReturn(Optional.empty());

            AddSubGroupRequest request = new AddSubGroupRequest("Rogue Channel", false);

            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                communityService.addSubGroup(communityId, request, nonMemberUserId)
            );

            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
            assertTrue(ex.getReason().contains("Not a member of this community"));
            verify(communityChannelRepository, never()).save(any());
            verify(conversationRepository, never()).save(any());
        }
    }

    // =========================================================================
    // 2. STATUS STORY PRIVACY & VISIBILITY TESTS
    // =========================================================================
    @Nested
    @DisplayName("Status Story Visibility & Privacy Scoping")
    class StatusStoryVisibilityTests {

        @Mock private UserStatusStoryRepository storyRepository;
        @Mock private UserRepository userRepository;
        @Mock private UserSettingsRepository settingsRepository;
        @Mock private ContactRepository contactRepository;

        private StatusStoryService statusStoryService;

        private UUID authorId;
        private UUID viewerInContactsId;
        private UUID viewerNotInContactsId;
        private UUID excludedViewerId;
        private User author;
        private UserStatusStory activeStory;

        @BeforeEach
        void setUp() {
            statusStoryService = new StatusStoryService(
                storyRepository,
                userRepository,
                settingsRepository,
                contactRepository
            );

            authorId = UUID.randomUUID();
            viewerInContactsId = UUID.randomUUID();
            viewerNotInContactsId = UUID.randomUUID();
            excludedViewerId = UUID.randomUUID();

            author = new User();
            author.setId(authorId);
            author.setUsername("story_author");

            activeStory = new UserStatusStory(author, "https://media.chat/story.jpg", "image", "My Day");
            activeStory.setId(UUID.randomUUID());
            activeStory.setCreatedAt(Instant.now().minusSeconds(3600));
            activeStory.setExpiresAt(Instant.now().plusSeconds(3600 * 23));

            lenient().when(storyRepository.findByExpiresAtAfterOrderByCreatedAtDesc(any(Instant.class)))
                .thenReturn(List.of(activeStory));

            lenient().when(settingsRepository.findById(any(UUID.class)))
                .thenReturn(Optional.empty());
        }

        @Test
        @DisplayName("ALLOWED: Author always sees their own status story")
        void testAuthorSeesOwnStory_Success() {
            List<StatusStoryDto> result = statusStoryService.getActiveStories(authorId);
            assertEquals(1, result.size());
            assertEquals("My Day", result.get(0).caption());
        }

        @Test
        @DisplayName("ALLOWED: Viewer in author's contacts sees story under default 'contacts' privacy")
        void testViewerInContactsCanSeeStory_Success() {
            UserSettings authorSettings = new UserSettings(authorId);
            authorSettings.setPrivacyStatus("contacts");
            when(settingsRepository.findById(authorId)).thenReturn(Optional.of(authorSettings));
            when(contactRepository.existsByIdUserIdAndIdContactUserId(authorId, viewerInContactsId)).thenReturn(true);

            List<StatusStoryDto> result = statusStoryService.getActiveStories(viewerInContactsId);
            assertEquals(1, result.size());
        }

        @Test
        @DisplayName("DENIED: Viewer NOT in author's contacts cannot see story under 'contacts' privacy")
        void testViewerNotInContactsCannotSeeStory_Denied() {
            UserSettings authorSettings = new UserSettings(authorId);
            authorSettings.setPrivacyStatus("contacts");
            when(settingsRepository.findById(authorId)).thenReturn(Optional.of(authorSettings));
            when(contactRepository.existsByIdUserIdAndIdContactUserId(authorId, viewerNotInContactsId)).thenReturn(false);

            List<StatusStoryDto> result = statusStoryService.getActiveStories(viewerNotInContactsId);
            assertTrue(result.isEmpty());
        }

        @Test
        @DisplayName("DENIED: Author with privacy 'nobody' hides story from all other users")
        void testAuthorPrivacyNobody_HidesFromAll() {
            UserSettings authorSettings = new UserSettings(authorId);
            authorSettings.setPrivacyStatus("nobody");
            when(settingsRepository.findById(authorId)).thenReturn(Optional.of(authorSettings));

            List<StatusStoryDto> result = statusStoryService.getActiveStories(viewerInContactsId);
            assertTrue(result.isEmpty());
        }

        @Test
        @DisplayName("ALLOWED: Author with privacy 'everyone' shows story to non-contact")
        void testAuthorPrivacyEveryone_ShowsToNonContact() {
            UserSettings authorSettings = new UserSettings(authorId);
            authorSettings.setPrivacyStatus("everyone");
            when(settingsRepository.findById(authorId)).thenReturn(Optional.of(authorSettings));

            List<StatusStoryDto> result = statusStoryService.getActiveStories(viewerNotInContactsId);
            assertEquals(1, result.size());
        }

        @Test
        @DisplayName("DENIED: Author explicitly excluded contact in privacyExcludedContacts")
        void testAuthorExplicitlyExcludedContact_Denied() {
            UserSettings authorSettings = new UserSettings(authorId);
            authorSettings.setPrivacyStatus("contacts");
            authorSettings.setPrivacyExcludedContacts(excludedViewerId.toString());
            when(settingsRepository.findById(authorId)).thenReturn(Optional.of(authorSettings));

            List<StatusStoryDto> result = statusStoryService.getActiveStories(excludedViewerId);
            assertTrue(result.isEmpty());
        }

        @Test
        @DisplayName("DENIED: Viewer who excluded/blocked author does not receive author's story")
        void testViewerExcludedAuthor_Denied() {
            UserSettings viewerSettings = new UserSettings(viewerInContactsId);
            viewerSettings.setPrivacyExcludedContacts(authorId.toString());
            when(settingsRepository.findById(viewerInContactsId)).thenReturn(Optional.of(viewerSettings));

            List<StatusStoryDto> result = statusStoryService.getActiveStories(viewerInContactsId);
            assertTrue(result.isEmpty());
        }
    }

    // =========================================================================
    // 3. CALL LOG VALIDATION, INTEGRITY & BACKWARD COMPATIBILITY TESTS
    // =========================================================================
    @Nested
    @DisplayName("Call Log Ownership, Integrity & Backward Compatibility")
    class CallLogValidationTests {

        @Mock private CallLogRepository callLogRepository;
        @Mock private UserRepository userRepository;
        @Mock private ConversationRepository conversationRepository;
        @Mock private ConversationMemberRepository conversationMemberRepository;

        private CallLogService callLogService;

        private UUID callerId;
        private UUID receiverId;
        private UUID peerId;
        private UUID conversationId;
        private User caller;
        private User receiver;
        private Conversation conversation;

        @BeforeEach
        void setUp() {
            callLogService = new CallLogService(
                callLogRepository,
                userRepository,
                conversationRepository,
                conversationMemberRepository
            );

            callerId = UUID.randomUUID();
            receiverId = UUID.randomUUID();
            peerId = receiverId;
            conversationId = UUID.randomUUID();

            caller = new User();
            caller.setId(callerId);
            caller.setUsername("caller_alice");

            receiver = new User();
            receiver.setId(receiverId);
            receiver.setUsername("receiver_bob");

            conversation = new Conversation("DIRECT", null, callerId);
            conversation.setId(conversationId);
        }

        @Test
        @DisplayName("ALLOWED: Outgoing valid call log preserves caller as initiator and owner")
        void testLogCall_Outgoing_ValidMutualConversation() {
            when(userRepository.findById(callerId)).thenReturn(Optional.of(caller));
            when(userRepository.findById(receiverId)).thenReturn(Optional.of(receiver));
            when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));
            when(conversationMemberRepository.existsByIdConversationIdAndIdUserId(conversationId, callerId)).thenReturn(true);
            when(conversationMemberRepository.existsByIdConversationIdAndIdUserId(conversationId, receiverId)).thenReturn(true);

            when(callLogRepository.save(any(CallLog.class))).thenAnswer(inv -> {
                CallLog log = inv.getArgument(0);
                log.setId(UUID.randomUUID());
                return log;
            });

            CreateCallLogRequest request = new CreateCallLogRequest(
                peerId, null, null, conversationId, "outgoing", "voice", "completed", 120
            );

            CallLogDto result = callLogService.logCall(request, callerId);

            assertNotNull(result);
            assertEquals(callerId, result.userId(), "Record owner must be Alice");
            assertEquals(callerId, result.callerId(), "Initiator must be Alice");
            assertEquals(receiverId, result.receiverId(), "Recipient must be Bob");
            assertEquals(receiverId, result.peerId(), "Peer must be Bob");
            assertEquals("outgoing", result.direction());
            assertEquals("completed", result.status());
            assertEquals(120, result.durationSeconds());

            ArgumentCaptor<CallLog> captor = ArgumentCaptor.forClass(CallLog.class);
            verify(callLogRepository).save(captor.capture());
            CallLog saved = captor.getValue();
            assertEquals(caller, saved.getUser());
            assertEquals(caller, saved.getCaller());
            assertEquals(receiver, saved.getReceiver());
            assertEquals("outgoing", saved.getDirection());
        }

        @Test
        @DisplayName("ALLOWED: Incoming valid call log preserves true caller and receiver identities")
        void testLogCall_Incoming_ValidMutualConversation() {
            // Bob (receiverId) is submitting an incoming call from Alice (callerId)
            when(userRepository.findById(receiverId)).thenReturn(Optional.of(receiver));
            when(userRepository.findById(callerId)).thenReturn(Optional.of(caller));
            when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));
            when(conversationMemberRepository.existsByIdConversationIdAndIdUserId(conversationId, receiverId)).thenReturn(true);
            when(conversationMemberRepository.existsByIdConversationIdAndIdUserId(conversationId, callerId)).thenReturn(true);

            when(callLogRepository.save(any(CallLog.class))).thenAnswer(inv -> {
                CallLog log = inv.getArgument(0);
                log.setId(UUID.randomUUID());
                return log;
            });

            CreateCallLogRequest request = new CreateCallLogRequest(
                callerId, null, null, conversationId, "incoming", "voice", "completed", 120
            );

            CallLogDto result = callLogService.logCall(request, receiverId);

            assertNotNull(result);
            assertEquals(receiverId, result.userId(), "Record owner must be Bob");
            assertEquals(callerId, result.callerId(), "Alice must remain the caller");
            assertEquals(receiverId, result.receiverId(), "Bob must remain the receiver");
            assertEquals(callerId, result.peerId(), "Peer must be Alice");
            assertEquals("incoming", result.direction());
            assertEquals("completed", result.status());
            assertEquals(120, result.durationSeconds());

            ArgumentCaptor<CallLog> captor = ArgumentCaptor.forClass(CallLog.class);
            verify(callLogRepository).save(captor.capture());
            CallLog saved = captor.getValue();
            assertEquals(receiver, saved.getUser(), "Owner is Bob");
            assertEquals(caller, saved.getCaller(), "True caller is Alice");
            assertEquals(receiver, saved.getReceiver(), "True receiver is Bob");
            assertEquals("incoming", saved.getDirection());
        }

        @Test
        @DisplayName("ALLOWED: Missed valid call log recorded for recipient with duration 0")
        void testLogCall_Missed_ValidMutualConversation() {
            when(userRepository.findById(receiverId)).thenReturn(Optional.of(receiver));
            when(userRepository.findById(callerId)).thenReturn(Optional.of(caller));

            when(callLogRepository.save(any(CallLog.class))).thenAnswer(inv -> {
                CallLog log = inv.getArgument(0);
                log.setId(UUID.randomUUID());
                return log;
            });

            CreateCallLogRequest request = new CreateCallLogRequest(
                callerId, null, null, null, "missed", "voice", "missed", 0
            );

            CallLogDto result = callLogService.logCall(request, receiverId);

            assertNotNull(result);
            assertEquals(receiverId, result.userId());
            assertEquals(callerId, result.callerId());
            assertEquals(receiverId, result.receiverId());
            assertEquals("missed", result.direction());
            assertEquals("missed", result.status());
            assertEquals(0, result.durationSeconds());
        }

        @Test
        @DisplayName("ALLOWED: Call log without conversation succeeds without contact restriction")
        void testLogCall_WithoutConversation_AllowedForExistingUsers() {
            when(userRepository.findById(callerId)).thenReturn(Optional.of(caller));
            when(userRepository.findById(receiverId)).thenReturn(Optional.of(receiver));

            when(callLogRepository.save(any(CallLog.class))).thenAnswer(inv -> {
                CallLog log = inv.getArgument(0);
                log.setId(UUID.randomUUID());
                return log;
            });

            CreateCallLogRequest request = new CreateCallLogRequest(
                peerId, null, null, null, "outgoing", "voice", "completed", 55
            );

            CallLogDto result = callLogService.logCall(request, callerId);

            assertNotNull(result);
            assertEquals(55, result.durationSeconds());
            assertNull(result.conversationId());
            verify(callLogRepository, times(1)).save(any(CallLog.class));
        }

        @Test
        @DisplayName("DENIED: Caller cannot log call to themselves (400 Bad Request)")
        void testLogCall_SelfCall_Rejected() {
            CreateCallLogRequest request = new CreateCallLogRequest(
                callerId, null, null, null, "outgoing", "voice", "completed", 10
            );

            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                callLogService.logCall(request, callerId)
            );

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
            assertTrue(ex.getReason().contains("Caller and receiver cannot be the same user"));
            verify(callLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("DENIED: Conflicting participant fields (peerUserId != receiverId) rejected with 400")
        void testLogCall_ConflictingPeerUserIdAndReceiverId_Rejected() {
            UUID differentReceiverId = UUID.randomUUID();
            CreateCallLogRequest request = new CreateCallLogRequest(
                peerId, null, differentReceiverId, null, "outgoing", "voice", "completed", 10
            );

            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                callLogService.logCall(request, callerId)
            );

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
            assertTrue(ex.getReason().contains("Conflicting participant fields"));
            verify(callLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("DENIED: Conflicting participant fields (peerUserId != callerId for incoming) rejected with 400")
        void testLogCall_ConflictingPeerUserIdAndCallerId_Rejected() {
            UUID differentCallerId = UUID.randomUUID();
            CreateCallLogRequest request = new CreateCallLogRequest(
                peerId, differentCallerId, null, null, "incoming", "voice", "completed", 10
            );

            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                callLogService.logCall(request, receiverId)
            );

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
            assertTrue(ex.getReason().contains("Conflicting participant fields"));
            verify(callLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("DENIED: Attempt to submit outgoing call with conflicting callerId rejected with 400")
        void testLogCall_Outgoing_SpoofCaller_Rejected() {
            UUID impostorCallerId = UUID.randomUUID();
            CreateCallLogRequest request = new CreateCallLogRequest(
                peerId, impostorCallerId, null, null, "outgoing", "voice", "completed", 10
            );

            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                callLogService.logCall(request, callerId)
            );

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
            assertTrue(ex.getReason().contains("Conflicting callerId"));
            verify(callLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("DENIED: Attempt to submit incoming call with conflicting receiverId rejected with 400")
        void testLogCall_Incoming_SpoofReceiver_Rejected() {
            UUID impostorReceiverId = UUID.randomUUID();
            CreateCallLogRequest request = new CreateCallLogRequest(
                peerId, null, impostorReceiverId, null, "incoming", "voice", "completed", 10
            );

            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                callLogService.logCall(request, receiverId)
            );

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
            assertTrue(ex.getReason().contains("Conflicting receiverId"));
            verify(callLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("DENIED: Missing peer in request rejected with 400")
        void testLogCall_MissingPeer_Rejected() {
            CreateCallLogRequest request = new CreateCallLogRequest(
                null, null, null, null, "outgoing", "voice", "completed", 10
            );

            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                callLogService.logCall(request, callerId)
            );

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
            assertTrue(ex.getReason().contains("Unambiguous peer required"));
            verify(callLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("DENIED: Invalid direction enum value rejected with 400")
        void testLogCall_InvalidDirection_Rejected() {
            CreateCallLogRequest request = new CreateCallLogRequest(
                peerId, null, null, null, "sideways", "voice", "completed", 10
            );

            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                callLogService.logCall(request, callerId)
            );

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
            assertTrue(ex.getReason().contains("Invalid direction"));
            verify(callLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("DENIED: Invalid callType enum value rejected with 400")
        void testLogCall_InvalidCallType_Rejected() {
            CreateCallLogRequest request = new CreateCallLogRequest(
                peerId, null, null, null, "outgoing", "telepathy", "completed", 10
            );

            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                callLogService.logCall(request, callerId)
            );

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
            assertTrue(ex.getReason().contains("Invalid callType"));
            verify(callLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("DENIED: Invalid status enum value rejected with 400")
        void testLogCall_InvalidStatus_Rejected() {
            CreateCallLogRequest request = new CreateCallLogRequest(
                peerId, null, null, null, "outgoing", "voice", "in_limbo", 10
            );

            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                callLogService.logCall(request, callerId)
            );

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
            assertTrue(ex.getReason().contains("Invalid call status"));
            verify(callLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("DENIED: Negative duration rejected with 400")
        void testLogCall_NegativeDuration_Rejected() {
            CreateCallLogRequest request = new CreateCallLogRequest(
                peerId, null, null, null, "outgoing", "voice", "completed", -15
            );

            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                callLogService.logCall(request, callerId)
            );

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
            assertTrue(ex.getReason().contains("durationSeconds cannot be negative"));
            verify(callLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("DENIED: Missed call with nonzero duration rejected with 400")
        void testLogCall_MissedCallWithNonzeroDuration_Rejected() {
            CreateCallLogRequest request = new CreateCallLogRequest(
                peerId, null, null, null, "missed", "voice", "missed", 120
            );

            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                callLogService.logCall(request, receiverId)
            );

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
            assertTrue(ex.getReason().contains("durationSeconds must be 0 for missed calls"));
            verify(callLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("DENIED: Outgoing call with status missed rejected with 400")
        void testLogCall_OutgoingWithMissedStatus_Rejected() {
            CreateCallLogRequest request = new CreateCallLogRequest(
                peerId, null, null, null, "outgoing", "voice", "missed", 0
            );

            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                callLogService.logCall(request, callerId)
            );

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
            assertTrue(ex.getReason().contains("Outgoing call cannot have status missed"));
            verify(callLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("DENIED: Missed direction with status completed rejected with 400")
        void testLogCall_MissedDirectionWithCompletedStatus_Rejected() {
            CreateCallLogRequest request = new CreateCallLogRequest(
                peerId, null, null, null, "missed", "voice", "completed", 0
            );

            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                callLogService.logCall(request, receiverId)
            );

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
            assertTrue(ex.getReason().contains("Status must be 'missed' for direction 'missed'"));
            verify(callLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("ALLOWED: Outgoing call with status no_answer succeeds")
        void testLogCall_Outgoing_ValidNoAnswer() {
            when(userRepository.findById(callerId)).thenReturn(Optional.of(caller));
            when(userRepository.findById(receiverId)).thenReturn(Optional.of(receiver));

            when(callLogRepository.save(any(CallLog.class))).thenAnswer(inv -> {
                CallLog log = inv.getArgument(0);
                log.setId(UUID.randomUUID());
                return log;
            });

            CreateCallLogRequest request = new CreateCallLogRequest(
                peerId, null, null, null, "outgoing", "voice", "no_answer", 0
            );

            CallLogDto result = callLogService.logCall(request, callerId);

            assertNotNull(result);
            assertEquals("no_answer", result.status());
            assertEquals("outgoing", result.direction());
            assertEquals(0, result.durationSeconds());
            verify(callLogRepository, times(1)).save(any(CallLog.class));
        }

        @Test
        @DisplayName("ALLOWED: Outgoing call with status busy succeeds")
        void testLogCall_Outgoing_ValidBusy() {
            when(userRepository.findById(callerId)).thenReturn(Optional.of(caller));
            when(userRepository.findById(receiverId)).thenReturn(Optional.of(receiver));

            when(callLogRepository.save(any(CallLog.class))).thenAnswer(inv -> {
                CallLog log = inv.getArgument(0);
                log.setId(UUID.randomUUID());
                return log;
            });

            CreateCallLogRequest request = new CreateCallLogRequest(
                peerId, null, null, null, "outgoing", "voice", "busy", 0
            );

            CallLogDto result = callLogService.logCall(request, callerId);

            assertNotNull(result);
            assertEquals("busy", result.status());
            assertEquals("outgoing", result.direction());
            assertEquals(0, result.durationSeconds());
            verify(callLogRepository, times(1)).save(any(CallLog.class));
        }

        @Test
        @DisplayName("ALLOWED: Outgoing call with status rejected succeeds")
        void testLogCall_Outgoing_ValidRejected() {
            when(userRepository.findById(callerId)).thenReturn(Optional.of(caller));
            when(userRepository.findById(receiverId)).thenReturn(Optional.of(receiver));

            when(callLogRepository.save(any(CallLog.class))).thenAnswer(inv -> {
                CallLog log = inv.getArgument(0);
                log.setId(UUID.randomUUID());
                return log;
            });

            CreateCallLogRequest request = new CreateCallLogRequest(
                peerId, null, null, null, "outgoing", "voice", "rejected", 0
            );

            CallLogDto result = callLogService.logCall(request, callerId);

            assertNotNull(result);
            assertEquals("rejected", result.status());
            assertEquals("outgoing", result.direction());
            assertEquals(0, result.durationSeconds());
            verify(callLogRepository, times(1)).save(any(CallLog.class));
        }

        @Test
        @DisplayName("ALLOWED: Incoming call with status rejected succeeds")
        void testLogCall_Incoming_ValidRejected() {
            when(userRepository.findById(callerId)).thenReturn(Optional.of(caller));
            when(userRepository.findById(receiverId)).thenReturn(Optional.of(receiver));

            when(callLogRepository.save(any(CallLog.class))).thenAnswer(inv -> {
                CallLog log = inv.getArgument(0);
                log.setId(UUID.randomUUID());
                return log;
            });

            CreateCallLogRequest request = new CreateCallLogRequest(
                callerId, null, null, null, "incoming", "voice", "rejected", 0
            );

            CallLogDto result = callLogService.logCall(request, receiverId);

            assertNotNull(result);
            assertEquals("rejected", result.status());
            assertEquals("incoming", result.direction());
            assertEquals(receiverId, result.userId());
            assertEquals(callerId, result.callerId());
            assertEquals(receiverId, result.receiverId());
            assertEquals(0, result.durationSeconds());
            verify(callLogRepository, times(1)).save(any(CallLog.class));
        }

        @Test
        @DisplayName("COMPATIBILITY: Status 'CONNECTED' mapped to canonical 'completed'")
        void testLogCall_Compatibility_ConnectedMappedToCompleted() {
            when(userRepository.findById(callerId)).thenReturn(Optional.of(caller));
            when(userRepository.findById(receiverId)).thenReturn(Optional.of(receiver));

            when(callLogRepository.save(any(CallLog.class))).thenAnswer(inv -> {
                CallLog log = inv.getArgument(0);
                log.setId(UUID.randomUUID());
                return log;
            });

            CreateCallLogRequest request = new CreateCallLogRequest(
                peerId, null, null, null, "outgoing", "voice", "CONNECTED", 42
            );

            CallLogDto result = callLogService.logCall(request, callerId);

            assertNotNull(result);
            assertEquals("completed", result.status(), "Status CONNECTED must be mapped to completed");
        }

        @Test
        @DisplayName("COMPATIBILITY: Legacy payload with receiverId and no direction defaults to outgoing")
        void testLogCall_Compatibility_LegacyPayloadDefaultsToOutgoing() {
            when(userRepository.findById(callerId)).thenReturn(Optional.of(caller));
            when(userRepository.findById(receiverId)).thenReturn(Optional.of(receiver));

            when(callLogRepository.save(any(CallLog.class))).thenAnswer(inv -> {
                CallLog log = inv.getArgument(0);
                log.setId(UUID.randomUUID());
                return log;
            });

            // Legacy constructor: (receiverId, conversationId, callType, status, durationSeconds)
            CreateCallLogRequest legacyReq = new CreateCallLogRequest(receiverId, null, "voice", "completed", 60);

            CallLogDto result = callLogService.logCall(legacyReq, callerId);

            assertNotNull(result);
            assertEquals("outgoing", result.direction());
            assertEquals(callerId, result.userId());
            assertEquals(receiverId, result.receiverId());
        }

        @Test
        @DisplayName("COMPATIBILITY: Case-insensitive enums (VOICE, OUTGOING) normalized")
        void testLogCall_Compatibility_CaseInsensitive() {
            when(userRepository.findById(callerId)).thenReturn(Optional.of(caller));
            when(userRepository.findById(receiverId)).thenReturn(Optional.of(receiver));

            when(callLogRepository.save(any(CallLog.class))).thenAnswer(inv -> {
                CallLog log = inv.getArgument(0);
                log.setId(UUID.randomUUID());
                return log;
            });

            CreateCallLogRequest request = new CreateCallLogRequest(
                peerId, null, null, null, "OUTGOING", "VOICE", "COMPLETED", 15
            );

            CallLogDto result = callLogService.logCall(request, callerId);

            assertNotNull(result);
            assertEquals("outgoing", result.direction());
            assertEquals("voice", result.callType());
            assertEquals("completed", result.status());
        }

        @Test
        @DisplayName("DENIED: Caller cannot associate call with an unrelated conversation (403 Forbidden)")
        void testLogCall_UnrelatedConversation_Forbidden() {
            when(userRepository.findById(callerId)).thenReturn(Optional.of(caller));
            when(userRepository.findById(receiverId)).thenReturn(Optional.of(receiver));
            when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));
            // Caller is NOT a member of conversationId
            when(conversationMemberRepository.existsByIdConversationIdAndIdUserId(conversationId, callerId)).thenReturn(false);

            CreateCallLogRequest request = new CreateCallLogRequest(
                peerId, null, null, conversationId, "outgoing", "voice", "completed", 60
            );

            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                callLogService.logCall(request, callerId)
            );

            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
            assertTrue(ex.getReason().contains("Authenticated user is not a member"));
            verify(callLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("DENIED: Conversation missing peer rejected (400 Bad Request)")
        void testLogCall_PeerNotMemberOfConversation_BadRequest() {
            when(userRepository.findById(callerId)).thenReturn(Optional.of(caller));
            when(userRepository.findById(receiverId)).thenReturn(Optional.of(receiver));
            when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));
            when(conversationMemberRepository.existsByIdConversationIdAndIdUserId(conversationId, callerId)).thenReturn(true);
            // Peer is NOT a member of conversationId
            when(conversationMemberRepository.existsByIdConversationIdAndIdUserId(conversationId, receiverId)).thenReturn(false);

            CreateCallLogRequest request = new CreateCallLogRequest(
                peerId, null, null, conversationId, "outgoing", "voice", "completed", 60
            );

            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                callLogService.logCall(request, callerId)
            );

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
            assertTrue(ex.getReason().contains("Peer is not a member"));
            verify(callLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("INTEGRITY: getUserCallHistory is strictly scoped to authenticated owner")
        void testGetUserCallHistory_StrictlyScopedToOwner() {
            CallLog aliceLog = new CallLog(caller, caller, receiver, null, "outgoing", "voice", "completed", 100);
            aliceLog.setId(UUID.randomUUID());

            when(callLogRepository.findByUserIdOrderByCreatedAtDesc(callerId)).thenReturn(List.of(aliceLog));
            when(callLogRepository.findByUserIdOrderByCreatedAtDesc(receiverId)).thenReturn(List.of());

            List<CallLogDto> aliceHistory = callLogService.getUserCallHistory(callerId);
            assertEquals(1, aliceHistory.size());
            assertEquals(callerId, aliceHistory.get(0).userId());

            List<CallLogDto> bobHistory = callLogService.getUserCallHistory(receiverId);
            assertTrue(bobHistory.isEmpty(), "Bob's history must not contain Alice's logs");

            verify(callLogRepository, times(1)).findByUserIdOrderByCreatedAtDesc(callerId);
            verify(callLogRepository, times(1)).findByUserIdOrderByCreatedAtDesc(receiverId);
        }
    }
}
