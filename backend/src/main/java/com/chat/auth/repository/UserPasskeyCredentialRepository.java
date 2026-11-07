package com.chat.auth.repository;

import com.chat.auth.entity.UserPasskeyCredential;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserPasskeyCredentialRepository extends JpaRepository<UserPasskeyCredential, UUID> {
    List<UserPasskeyCredential> findByUserIdOrderByCreatedAtDesc(UUID userId);
    Optional<UserPasskeyCredential> findByCredentialId(String credentialId);
    void deleteByUserIdAndCredentialId(UUID userId, String credentialId);
    int countByUserId(UUID userId);
}

