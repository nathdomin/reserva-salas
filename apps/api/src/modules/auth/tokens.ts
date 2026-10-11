import { createHash, randomBytes } from 'node:crypto';

/** Token de sessão: 256 bits aleatórios em base64url (43 caracteres). */
export function generateSessionToken(): { token: string; id: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, id: hashSessionToken(token) };
}

/** O banco guarda só o SHA-256 do token: um vazamento da tabela não permite entrar no sistema. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isWellFormedSessionToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}
