package com.chat.contact.repository;

import com.chat.contact.entity.Contact;
import com.chat.contact.entity.ContactId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ContactRepository extends JpaRepository<Contact, ContactId> {
    List<Contact> findByIdUserId(UUID userId);
    boolean existsByIdUserIdAndIdContactUserId(UUID userId, UUID contactUserId);
}
