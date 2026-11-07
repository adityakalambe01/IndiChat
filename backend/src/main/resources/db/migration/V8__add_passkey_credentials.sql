CREATE TABLE IF NOT EXISTS user_passkey_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    public_key_cose BYTEA,
    public_key_pem TEXT,
    sign_count BIGINT NOT NULL DEFAULT 0,
    transports TEXT,
    nickname VARCHAR(100) NOT NULL DEFAULT 'Passkey',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON user_passkey_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_passkeys_credential_id ON user_passkey_credentials(credential_id);

