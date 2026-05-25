import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

type SessionPayload = {
  username: string;
  role?: 'Admin' | 'Analyst' | 'Viewer' | 'User';
  email?: string;
  fullName?: string;
  permissions?: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
  };
  exp: number;
};

export const SESSION_COOKIE_NAME = 'ducky_pwn_docs_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;

let envExampleCache: Record<string, string> | null = null;

const readEnvExample = (): Record<string, string> => {
  if (envExampleCache) return envExampleCache;

  const file = path.join(process.cwd(), '.env.example');
  if (!fs.existsSync(file)) {
    envExampleCache = {};
    return envExampleCache;
  }

  const lines = fs.readFileSync(file, 'utf-8').split('\n');
  const map: Record<string, string> = {};

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index <= 0) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key) map[key] = value;
  });

  envExampleCache = map;
  return envExampleCache;
};

const getEnv = (key: string, fallback: string) => {
  const value = process.env[key];
  if (value && value.trim()) return value.trim();
  const fromExample = readEnvExample()[key];
  if (fromExample && fromExample.trim()) return fromExample.trim();
  return fallback;
};

const getAuthSecret = () => getEnv('AUTH_SECRET', 'change-this-secret');

const safeCompare = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const sign = (value: string) =>
  crypto.createHmac('sha256', getAuthSecret()).update(value).digest('hex');

export const getSessionTTLSeconds = () => SESSION_TTL_SECONDS;

export const getAdminCredentials = () => ({
  username: getEnv('ADMIN_USERNAME', 'admin'),
  password: getEnv('ADMIN_PASSWORD', 'ChangeMe_UseLongRandomPassword'),
  email: getEnv('ADMIN_EMAIL', `${getEnv('ADMIN_USERNAME', 'admin')}@welford.local`),
  fullName: getEnv('ADMIN_FULL_NAME', 'Welford Admin'),
});

export const isValidAdminLogin = (identifier: string, password: string) => {
  const admin = getAdminCredentials();
  const normalized = identifier.trim();
  const adminEmail = (admin.email || '').trim().toLowerCase();
  const matchesUsername = safeCompare(normalized, admin.username);
  const matchesEmail = adminEmail ? safeCompare(normalized.toLowerCase(), adminEmail) : false;
  return (matchesUsername || matchesEmail) && safeCompare(password, admin.password);
};

export const createSessionToken = (
  username: string,
  options?: {
    role?: SessionPayload['role'];
    email?: string;
    fullName?: string;
    permissions?: SessionPayload['permissions'];
  }
) => {
  const payload: SessionPayload = {
    username,
    role: options?.role || 'User',
    email: options?.email,
    fullName: options?.fullName,
    permissions: options?.permissions,
    exp: Date.now() + SESSION_TTL_MS,
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
};

export const verifySessionToken = (token?: string | null): SessionPayload | null => {
  if (!token) return null;

  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expectedSignature = sign(encoded);
  if (!safeCompare(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as SessionPayload;
    if (!payload?.username || !payload?.exp) return null;
    if (payload.exp < Date.now()) return null;
    if (!payload.role) payload.role = 'User';
    return payload;
  } catch {
    return null;
  }
};

export const hashPasswordSecure = (password: string): string => {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derivedKey}`;
};

export const verifyPasswordSecure = (password: string, encodedHash: string): boolean => {
  if (!encodedHash?.trim()) return false;

  const [algorithm, salt, storedHash] = encodedHash.split(':');
  if (algorithm === 'scrypt' && salt && storedHash) {
    const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
    return safeCompare(candidate, storedHash);
  }

  // Backward compatibility for legacy password formats in existing stores.
  const normalized = password.trim();
  const direct = encodedHash.trim();
  if (safeCompare(normalized, direct)) return true;

  const sha256Hex = crypto.createHash('sha256').update(normalized).digest('hex');
  if (safeCompare(sha256Hex, direct.toLowerCase())) return true;

  const utf8Hex = Buffer.from(normalized, 'utf-8').toString('hex');
  return safeCompare(utf8Hex, direct.toLowerCase());
};
