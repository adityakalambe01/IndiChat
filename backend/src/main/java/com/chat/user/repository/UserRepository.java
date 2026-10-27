package com.chat.user.repository;

import com.chat.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    Optional<User> findByPhoneNumber(String phoneNumber);

    @Query("SELECT u FROM User u WHERE u.phoneNumber IN :phoneNumbers AND u.status = 'ACTIVE'")
    List<User> findActiveUsersByPhoneNumbers(@Param("phoneNumbers") Collection<String> phoneNumbers);

    @Query("SELECT u FROM User u WHERE LOWER(u.username) = LOWER(:term) OR LOWER(u.email) = LOWER(:term)")
    Optional<User> findByUsernameOrEmail(@Param("term") String term);

    @Query("SELECT u FROM User u WHERE " +
           "(LOWER(u.username) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
           "LOWER(u.displayName) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
           "LOWER(u.email) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
           "LOWER(u.phoneNumber) LIKE LOWER(CONCAT('%', :q, '%'))) " +
           "AND u.status = 'ACTIVE' ORDER BY u.displayName ASC")
    List<User> searchUsers(@Param("q") String q);
}
