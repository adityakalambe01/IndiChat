#!/usr/bin/env node

/**
 * IndiChat Database Seeding Utility
 * Seeds demo accounts, settings, contacts, and sample conversations.
 * Reads configuration from .env or command-line flags.
 * 
 * Usage:
 *   node scripts/seed-db.js            # Seeds active database configured in .env
 *   node scripts/seed-db.js --docker   # Force seeds local Docker PostgreSQL container
 *   node scripts/seed-db.js --remote   # Force seeds remote Render PostgreSQL database
 *   node scripts/seed-db.js --all      # Seeds both local Docker and remote Render databases
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const seedSqlPath = path.join(__dirname, 'seed_demo_users.sql');

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const k = trimmed.substring(0, eqIdx).trim();
      const v = trimmed.substring(eqIdx + 1).trim();
      env[k] = v;
    }
  }
  return env;
}

const env = parseEnv(envPath);
const args = process.argv.slice(2);
const forceDocker = args.includes('--docker');
const forceRemote = args.includes('--remote');
const seedAll = args.includes('--all');

function hasCommand(command) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isDockerComposeRunning() {
  try {
    const res = execSync('docker compose ps --services', { cwd: rootDir, stdio: 'pipe' }).toString();
    return res.includes('postgres');
  } catch {
    return false;
  }
}

function seedDocker() {
  console.log('🌱 Seeding local Docker PostgreSQL container (chat-postgres / chat_platform)...');
  if (!isDockerComposeRunning()) {
    console.error('❌ Docker postgres container is not running. Please run: docker compose up -d postgres\n');
    return false;
  }
  try {
    const cmd = `docker compose exec -T postgres psql -U ${env.DOCKER_POSTGRES_USER || 'postgres'} -d ${env.DOCKER_POSTGRES_DB || 'chat_platform'} < "${seedSqlPath}"`;
    execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
    console.log('✅ Local Docker database successfully seeded!\n');
    return true;
  } catch (err) {
    console.error('❌ Failed to seed local Docker database:', err.message);
    return false;
  }
}

function seedRemote() {
  const host = env.POSTGRES_HOST;
  const port = env.POSTGRES_PORT || '5432';
  const db = env.POSTGRES_DB;
  const user = env.POSTGRES_USER;
  const pass = env.POSTGRES_PASSWORD;
  const ssl = env.POSTGRES_SSL === 'true' || (host && host.includes('render.com')) ? '?sslmode=require' : '';

  if (!host || !db || !user) {
    console.log('⚠️ Remote database configuration incomplete in .env. Skipping remote seed.\n');
    return false;
  }

  const cleanUrl = `postgresql://${encodeURIComponent(user)}@${host}:${port}/${db}${ssl}`;
  console.log(`🌱 Seeding remote PostgreSQL database (${host}/${db})...`);

  // Try via Docker compose first if available (pass password via -e PGPASSWORD to avoid cmdline exposure)
  if (isDockerComposeRunning()) {
    try {
      const escapedPass = pass.replace(/["\\]/g, '\\$&');
      const cmd = `docker compose exec -T -e PGPASSWORD="${escapedPass}" postgres psql "${cleanUrl}" < "${seedSqlPath}"`;
      execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
      console.log('✅ Remote database successfully seeded (via Docker postgres client)!\n');
      return true;
    } catch (err) {
      console.warn('⚠️ Seeding via Docker client failed, attempting host psql fallback...');
    }
  }

  // Fallback to local host psql if available (pass password securely via process environment)
  if (hasCommand('psql')) {
    try {
      const cmd = `psql "${cleanUrl}" < "${seedSqlPath}"`;
      execSync(cmd, {
        cwd: rootDir,
        stdio: 'inherit',
        env: { ...process.env, PGPASSWORD: pass }
      });
      console.log('✅ Remote database successfully seeded (via host psql)!\n');
      return true;
    } catch (err) {
      console.error('❌ Failed to seed remote database via host psql:', err.message);
      return false;
    }
  }

  console.error('❌ Neither Docker postgres container nor host psql command is available to connect to remote database.\n');
  return false;
}

function main() {
  console.log('==================================================');
  console.log('🚀 IndiChat Demo Users & Seed Data Tool');
  console.log('==================================================\n');

  let success = true;

  if (seedAll) {
    const dOk = seedDocker();
    const rOk = seedRemote();
    success = dOk && rOk;
  } else if (forceDocker) {
    success = seedDocker();
  } else if (forceRemote) {
    success = seedRemote();
  } else {
    // Check .env flag
    const useDocker = env.USE_DOCKER_POSTGRES === 'true' || env.USE_DOCKER_POSTGRES === '1';
    success = useDocker ? seedDocker() : seedRemote();
  }

  if (!success) {
    console.error('💥 Database seeding failed. Please check the error logs above.\n');
    process.exit(1);
  }

  console.log('Demo Users Available:');
  console.log('--------------------------------------------------');
  console.log('1. Alice Cooper   (@alice)   - 2FA PIN: 112233  [Pass: Password123!]');
  console.log('2. Bob Dylan      (@bob)     - No 2FA           [Pass: Password123!]');
  console.log('3. Charlie Davis  (@charlie) - No 2FA           [Pass: Password123!]');
  console.log('4. David Miller   (@david)   - No 2FA           [Pass: Password123!]');
  console.log('5. Emma Watson    (@emma)    - No 2FA           [Pass: Password123!]');
  console.log('6. Frank Castle   (@frank)   - No 2FA           [Pass: Password123!]');
  console.log('7. Grace Hopper   (@grace)   - No 2FA           [Pass: Password123!]');
  console.log('==================================================\n');
}

main();
