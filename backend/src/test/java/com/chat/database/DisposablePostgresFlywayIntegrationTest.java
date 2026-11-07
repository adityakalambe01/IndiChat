package com.chat.database;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@EnabledIfSystemProperty(named = "test.disposable.postgres", matches = "true")
@TestPropertySource(properties = {
    "spring.flyway.enabled=true",
    "spring.jpa.hibernate.ddl-auto=validate",
    "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect",
    "spring.data.redis.repositories.enabled=false"
})
public class DisposablePostgresFlywayIntegrationTest {

    @Autowired(required = false)
    private Flyway flyway;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void testFlywayMigrationsAppliedSuccessfullyOnPostgres() {
        assertNotNull(flyway, "Flyway bean should be configured and initialized");
        MigrationInfo[] applied = flyway.info().applied();
        assertNotNull(applied, "Applied migrations list should not be null");
        assertTrue(applied.length >= 10, "Expected at least 10 migrations applied, got: " + applied.length);

        for (MigrationInfo info : applied) {
            assertEquals("SUCCESS", info.getState().name(),
                "Migration " + info.getVersion() + " (" + info.getDescription() + ") should have state SUCCESS");
        }

        MigrationInfo latest = applied[applied.length - 1];
        assertEquals("10", latest.getVersion().getVersion(), "Latest applied migration must be V10");

        // Verify flyway_schema_history table
        Integer count = jdbcTemplate.queryForObject(
            "SELECT count(*) FROM flyway_schema_history WHERE success = true", Integer.class);
        assertNotNull(count);
        assertTrue(count >= 10, "flyway_schema_history must record all migrations as successful");

        // Verify key tables created across V1-V10
        Integer tableCount = jdbcTemplate.queryForObject(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'messages', 'conversations', 'call_logs', 'communities', 'message_reactions', 'user_starred_messages', 'user_passkey_credentials')",
            Integer.class);
        assertEquals(8, tableCount, "All expected core tables from V1-V10 must exist in PostgreSQL public schema");
    }
}

