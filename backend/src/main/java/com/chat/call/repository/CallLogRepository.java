package com.chat.call.repository;

import com.chat.call.entity.CallLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CallLogRepository extends JpaRepository<CallLog, UUID> {
    List<CallLog> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<CallLog> findByCallerIdOrReceiverIdOrderByCreatedAtDesc(UUID callerId, UUID receiverId);
    List<CallLog> findByCallerIdOrderByCreatedAtDesc(UUID callerId);
}
