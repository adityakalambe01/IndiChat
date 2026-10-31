-- IndiChat Demo Users & Seed Data Script
-- Populates demo users (Alice, Bob, Charlie, David, Emma, Frank, Grace) with standard credentials,
-- user settings, mutual contact records, and sample chat rooms.

DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
EXCEPTION WHEN OTHERS THEN
    -- In cloud/managed PostgreSQL, pgcrypto may already exist or gen_random_uuid() is native
    NULL;
END $$;

-- 1. Insert or update core demo users
-- All demo users share password: Password123!
-- BCrypt cost 12 hash: $2a$12$0skt2dCgSqRIoF7pd1wvP.qiHMAk2SidFmt4XKzuK2OR1TcFvFAga
INSERT INTO users (id, username, email, phone_number, password_hash, display_name, status)
VALUES
    (gen_random_uuid(), 'alice', 'alice@example.com', '+12345678901', '$2a$12$0skt2dCgSqRIoF7pd1wvP.qiHMAk2SidFmt4XKzuK2OR1TcFvFAga', 'Alice Cooper', 'ACTIVE'),
    (gen_random_uuid(), 'bob', 'bob@example.com', '+12345678902', '$2a$12$0skt2dCgSqRIoF7pd1wvP.qiHMAk2SidFmt4XKzuK2OR1TcFvFAga', 'Bob Dylan', 'ACTIVE'),
    (gen_random_uuid(), 'charlie', 'charlie@example.com', '+12345678903', '$2a$12$0skt2dCgSqRIoF7pd1wvP.qiHMAk2SidFmt4XKzuK2OR1TcFvFAga', 'Charlie Davis', 'ACTIVE'),
    (gen_random_uuid(), 'david', 'david@example.com', '+12345678904', '$2a$12$0skt2dCgSqRIoF7pd1wvP.qiHMAk2SidFmt4XKzuK2OR1TcFvFAga', 'David Miller', 'ACTIVE'),
    (gen_random_uuid(), 'emma', 'emma@example.com', '+12345678905', '$2a$12$0skt2dCgSqRIoF7pd1wvP.qiHMAk2SidFmt4XKzuK2OR1TcFvFAga', 'Emma Watson', 'ACTIVE'),
    (gen_random_uuid(), 'frank', 'frank@example.com', '+12345678906', '$2a$12$0skt2dCgSqRIoF7pd1wvP.qiHMAk2SidFmt4XKzuK2OR1TcFvFAga', 'Frank Castle', 'ACTIVE'),
    (gen_random_uuid(), 'grace', 'grace@example.com', '+12345678907', '$2a$12$0skt2dCgSqRIoF7pd1wvP.qiHMAk2SidFmt4XKzuK2OR1TcFvFAga', 'Grace Hopper', 'ACTIVE')
ON CONFLICT (username) DO UPDATE SET
    email = EXCLUDED.email,
    phone_number = EXCLUDED.phone_number,
    password_hash = EXCLUDED.password_hash,
    display_name = EXCLUDED.display_name,
    status = 'ACTIVE',
    updated_at = now();

-- 2. Insert or update user_settings
INSERT INTO user_settings (user_id, status_about, two_factor_enabled, two_factor_pin, passkey_enabled, read_receipts, enter_is_send, media_visibility)
SELECT 
    id,
    CASE username
        WHEN 'alice' THEN 'Building IndiChat 🚀'
        WHEN 'bob' THEN 'Hey there! I am using IndiChat.'
        WHEN 'charlie' THEN 'Coffee, code, repeat ☕💻'
        WHEN 'david' THEN 'Available for quick calls 📞'
        WHEN 'emma' THEN 'Designing sleek user interfaces ✨'
        WHEN 'frank' THEN 'Away on a business trip ✈️'
        WHEN 'grace' THEN 'First bug found here! 🐞'
        ELSE 'Hey there! I am using IndiChat.'
    END,
    CASE WHEN username = 'alice' THEN true ELSE false END,
    CASE WHEN username = 'alice' THEN '112233' ELSE NULL END,
    false,
    true,
    true,
    true
FROM users
WHERE username IN ('alice', 'bob', 'charlie', 'david', 'emma', 'frank', 'grace')
ON CONFLICT (user_id) DO UPDATE SET
    status_about = EXCLUDED.status_about,
    two_factor_enabled = EXCLUDED.two_factor_enabled,
    two_factor_pin = EXCLUDED.two_factor_pin,
    updated_at = now();

-- 3. Mutual contacts cross-linking between all demo users
INSERT INTO contacts (user_id, contact_user_id, nickname, created_at)
SELECT 
    u1.id, 
    u2.id, 
    u2.display_name, 
    now()
FROM users u1
CROSS JOIN users u2
WHERE u1.username IN ('alice', 'bob', 'charlie', 'david', 'emma', 'frank', 'grace')
  AND u2.username IN ('alice', 'bob', 'charlie', 'david', 'emma', 'frank', 'grace')
  AND u1.id <> u2.id
ON CONFLICT (user_id, contact_user_id) DO UPDATE SET
    nickname = EXCLUDED.nickname;

-- 4. Shared Group Conversation: "IndiChat Community"
DO $$
DECLARE
    v_group_id UUID;
    v_alice_id UUID;
    v_bob_id UUID;
    v_charlie_id UUID;
    v_david_id UUID;
    v_emma_id UUID;
    v_frank_id UUID;
    v_grace_id UUID;
BEGIN
    SELECT id INTO v_alice_id FROM users WHERE username = 'alice';
    SELECT id INTO v_bob_id FROM users WHERE username = 'bob';
    SELECT id INTO v_charlie_id FROM users WHERE username = 'charlie';
    SELECT id INTO v_david_id FROM users WHERE username = 'david';
    SELECT id INTO v_emma_id FROM users WHERE username = 'emma';
    SELECT id INTO v_frank_id FROM users WHERE username = 'frank';
    SELECT id INTO v_grace_id FROM users WHERE username = 'grace';

    -- Check if group conversation already exists
    SELECT id INTO v_group_id FROM conversations WHERE title = 'IndiChat Community' AND type = 'GROUP' LIMIT 1;

    IF v_group_id IS NULL THEN
        INSERT INTO conversations (id, type, title, created_by, created_at, updated_at)
        VALUES (gen_random_uuid(), 'GROUP', 'IndiChat Community', v_alice_id, now(), now())
        RETURNING id INTO v_group_id;

        -- Add members
        INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
        VALUES 
            (v_group_id, v_alice_id, 'ADMIN', now()),
            (v_group_id, v_bob_id, 'MEMBER', now()),
            (v_group_id, v_charlie_id, 'MEMBER', now()),
            (v_group_id, v_david_id, 'MEMBER', now()),
            (v_group_id, v_emma_id, 'MEMBER', now()),
            (v_group_id, v_frank_id, 'MEMBER', now()),
            (v_group_id, v_grace_id, 'MEMBER', now())
        ON CONFLICT (conversation_id, user_id) DO NOTHING;

        -- Insert initial conversation messages
        INSERT INTO messages (id, conversation_id, sender_id, client_message_id, type, content, created_at)
        VALUES 
            (gen_random_uuid(), v_group_id, v_alice_id, gen_random_uuid(), 'TEXT', 'Welcome everyone to the IndiChat Community! 👋', now() - interval '2 hours'),
            (gen_random_uuid(), v_group_id, v_bob_id, gen_random_uuid(), 'TEXT', 'Great to be here! The real-time messaging is super fast. ⚡', now() - interval '1 hour 45 minutes'),
            (gen_random_uuid(), v_group_id, v_charlie_id, gen_random_uuid(), 'TEXT', 'Loving the delivery ticks and audio/video calling features! 📞', now() - interval '1 hour 20 minutes'),
            (gen_random_uuid(), v_group_id, v_emma_id, gen_random_uuid(), 'TEXT', 'UI looks clean and responsive across web and mobile! ✨', now() - interval '50 minutes'),
            (gen_random_uuid(), v_group_id, v_david_id, gen_random_uuid(), 'TEXT', 'All demo users are online and ready to chat. 🚀', now() - interval '10 minutes');
    ELSE
        -- Ensure all demo users are members
        INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
        VALUES 
            (v_group_id, v_alice_id, 'ADMIN', now()),
            (v_group_id, v_bob_id, 'MEMBER', now()),
            (v_group_id, v_charlie_id, 'MEMBER', now()),
            (v_group_id, v_david_id, 'MEMBER', now()),
            (v_group_id, v_emma_id, 'MEMBER', now()),
            (v_group_id, v_frank_id, 'MEMBER', now()),
            (v_group_id, v_grace_id, 'MEMBER', now())
        ON CONFLICT (conversation_id, user_id) DO NOTHING;

        -- If group exists but has no messages, populate initial conversation messages
        IF (SELECT count(*) FROM messages WHERE conversation_id = v_group_id) = 0 THEN
            INSERT INTO messages (id, conversation_id, sender_id, client_message_id, type, content, created_at)
            VALUES 
                (gen_random_uuid(), v_group_id, v_alice_id, gen_random_uuid(), 'TEXT', 'Welcome everyone to the IndiChat Community! 👋', now() - interval '2 hours'),
                (gen_random_uuid(), v_group_id, v_bob_id, gen_random_uuid(), 'TEXT', 'Great to be here! The real-time messaging is super fast. ⚡', now() - interval '1 hour 45 minutes'),
                (gen_random_uuid(), v_group_id, v_charlie_id, gen_random_uuid(), 'TEXT', 'Loving the delivery ticks and audio/video calling features! 📞', now() - interval '1 hour 20 minutes'),
                (gen_random_uuid(), v_group_id, v_emma_id, gen_random_uuid(), 'TEXT', 'UI looks clean and responsive across web and mobile! ✨', now() - interval '50 minutes'),
                (gen_random_uuid(), v_group_id, v_david_id, gen_random_uuid(), 'TEXT', 'All demo users are online and ready to chat. 🚀', now() - interval '10 minutes');
        END IF;
    END IF;
END $$;
