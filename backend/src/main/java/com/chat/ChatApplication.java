package com.chat;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

@SpringBootApplication
@EnableScheduling
@EnableAsync
public class ChatApplication {

    private static final Logger log = LoggerFactory.getLogger(ChatApplication.class);

    public static void main(String[] args) {
        configureEnvironment();
        SpringApplication.run(ChatApplication.class, args);
    }

    public static void configureEnvironment() {
        Map<String, String> envMap = loadDotEnv();

        // Check USE_DOCKER_POSTGRES flag
        String dockerFlag = getPropertyOrEnv("USE_DOCKER_POSTGRES", envMap);

        boolean useDockerPostgres = "true".equalsIgnoreCase(dockerFlag)
                || "1".equals(dockerFlag)
                || "yes".equalsIgnoreCase(dockerFlag);

        // Check if explicit SPRING_DATASOURCE_URL is already provided via OS env or system property
        String explicitUrl = System.getenv("SPRING_DATASOURCE_URL");
        if (explicitUrl == null || explicitUrl.isBlank()) {
            explicitUrl = System.getProperty("spring.datasource.url");
        }

        if (explicitUrl == null || explicitUrl.isBlank()) {
            if (useDockerPostgres) {
                // Docker PostgreSQL
                String host = getPropertyOrEnv("DOCKER_POSTGRES_HOST", envMap, "localhost");
                String port = getPropertyOrEnv("DOCKER_POSTGRES_PORT", envMap, "5554");
                String db = getPropertyOrEnv("DOCKER_POSTGRES_DB", envMap, "chat_platform");
                String user = getPropertyOrEnv("DOCKER_POSTGRES_USER", envMap, "postgres");
                String pass = getPropertyOrEnv("DOCKER_POSTGRES_PASSWORD", envMap, "postgres");

                String jdbcUrl = "jdbc:postgresql://" + host + ":" + port + "/" + db;
                System.setProperty("spring.datasource.url", jdbcUrl);
                System.setProperty("spring.datasource.username", user);
                System.setProperty("spring.datasource.password", pass);

                log.info("[Database Configuration] USE_DOCKER_POSTGRES=true -> Using Docker PostgreSQL at {}:{}/{}", host, port, db);
                System.out.println("[Database Configuration] USE_DOCKER_POSTGRES=true -> Using Docker PostgreSQL at " + host + ":" + port + "/" + db);
            } else {
                // Hosted / Remote PostgreSQL (loaded from .env or environment variables)
                String host = getPropertyOrEnv("POSTGRES_HOST", envMap, "localhost");
                String port = getPropertyOrEnv("POSTGRES_PORT", envMap, "5432");
                String db = getPropertyOrEnv("POSTGRES_DB", envMap, "chat_platform");
                String user = getPropertyOrEnv("POSTGRES_USER", envMap, "postgres");
                String pass = getPropertyOrEnv("POSTGRES_PASSWORD", envMap, "");

                // Render and cloud PostgreSQL require SSL/TLS
                String sslMode = getPropertyOrEnv("POSTGRES_SSL_MODE", envMap, null);
                boolean requiresSsl = "true".equalsIgnoreCase(getPropertyOrEnv("POSTGRES_SSL", envMap, "true"))
                        || host.contains("render.com")
                        || (!"localhost".equalsIgnoreCase(host) && !"127.0.0.1".equalsIgnoreCase(host) && !"postgres".equalsIgnoreCase(host));

                String sslParam = "";
                if (sslMode != null && !sslMode.isBlank()) {
                    sslParam = "?sslmode=" + sslMode;
                } else if (requiresSsl) {
                    sslParam = "?sslmode=require";
                }

                String jdbcUrl = "jdbc:postgresql://" + host + ":" + port + "/" + db + sslParam;
                System.setProperty("spring.datasource.url", jdbcUrl);
                System.setProperty("spring.datasource.username", user);
                System.setProperty("spring.datasource.password", pass);

                log.info("[Database Configuration] USE_DOCKER_POSTGRES=false -> Using Hosted/External PostgreSQL at {}:{}/{} (SSL: {})",
                        host, port, db, (requiresSsl || sslMode != null));
                System.out.println("[Database Configuration] USE_DOCKER_POSTGRES=false -> Using Hosted/External PostgreSQL at " + host + ":" + port + "/" + db);
            }
        } else {
            log.info("[Database Configuration] Using explicitly provided SPRING_DATASOURCE_URL: {}", explicitUrl);
        }

        // Set other .env variables in System properties if not already defined
        for (Map.Entry<String, String> entry : envMap.entrySet()) {
            if (System.getProperty(entry.getKey()) == null && System.getenv(entry.getKey()) == null) {
                System.setProperty(entry.getKey(), entry.getValue());
            }
        }
    }

    private static String getPropertyOrEnv(String key, Map<String, String> envMap) {
        return getPropertyOrEnv(key, envMap, null);
    }

    private static String getPropertyOrEnv(String key, Map<String, String> envMap, String defaultValue) {
        String val = System.getProperty(key);
        if (val != null && !val.isBlank()) return val;

        val = System.getenv(key);
        if (val != null && !val.isBlank()) return val;

        val = envMap.get(key);
        if (val != null && !val.isBlank()) return val;

        return defaultValue;
    }

    private static Map<String, String> loadDotEnv() {
        Map<String, String> envMap = new HashMap<>();

        File[] candidates = new File[] {
            new File(".env"),
            new File("../.env"),
            new File(System.getProperty("user.dir", "."), ".env"),
            new File(System.getProperty("user.dir", "."), "../.env")
        };

        File envFile = null;
        for (File candidate : candidates) {
            if (candidate.exists() && candidate.isFile()) {
                envFile = candidate;
                break;
            }
        }

        if (envFile == null) {
            return envMap;
        }

        try (BufferedReader reader = new BufferedReader(new FileReader(envFile, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                int idx = line.indexOf('=');
                if (idx > 0) {
                    String key = line.substring(0, idx).trim();
                    String value = line.substring(idx + 1).trim();
                    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
                        if (value.length() >= 2) {
                            value = value.substring(1, value.length() - 1);
                        }
                    }
                    envMap.put(key, value);
                }
            }
        } catch (IOException e) {
            log.warn("[Environment] Could not read .env file: {}", e.getMessage());
        }

        return envMap;
    }
}

