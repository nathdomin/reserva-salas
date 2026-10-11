import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

/**
 * Hash de senhas com scrypt (nativo do Node, recomendado pela OWASP).
 * Parâmetros: N=2^15, r=8, p=3 → ~32 MiB de memória por cálculo.
 *
 * Formato salvo no banco (inclui os parâmetros, para poder aumentá-los no futuro):
 *   scrypt$ln=15,r=8,p=3$<sal base64>$<hash base64>
 */
export const SCRYPT_PARAMS = { ln: 15, r: 8, p: 3 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

interface ScryptParams {
  ln: number;
  r: number;
  p: number;
}

function deriveKey(senha: string, salt: Buffer, params: ScryptParams, keyLength: number) {
  const N = 2 ** params.ln;
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      // NFC: a mesma senha digitada em teclados/sistemas diferentes gera o mesmo hash.
      senha.normalize('NFC'),
      salt,
      keyLength,
      { N, r: params.r, p: params.p, maxmem: 256 * N * params.r },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

interface ParsedHash {
  params: ScryptParams;
  salt: Buffer;
  hash: Buffer;
}

function parseHash(stored: string): ParsedHash | null {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return null;
  const match = /^ln=(\d{1,2}),r=(\d{1,2}),p=(\d{1,2})$/.exec(parts[1] ?? '');
  if (!match) return null;
  const params = { ln: Number(match[1]), r: Number(match[2]), p: Number(match[3]) };
  if (params.ln < 10 || params.ln > 20 || params.r < 1 || params.p < 1) return null;
  const salt = Buffer.from(parts[2] ?? '', 'base64');
  const hash = Buffer.from(parts[3] ?? '', 'base64');
  if (salt.length < 16 || hash.length < 32) return null;
  return { params, salt, hash };
}

export async function hashPassword(senha: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(senha, salt, SCRYPT_PARAMS, KEY_LENGTH);
  const { ln, r, p } = SCRYPT_PARAMS;
  return `scrypt$ln=${ln},r=${r},p=${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

/** Compara em tempo constante. Hash malformado nunca é aceito. */
export async function verifyPassword(senha: string, stored: string): Promise<boolean> {
  const parsed = parseHash(stored);
  if (!parsed) return false;
  const key = await deriveKey(senha, parsed.salt, parsed.params, parsed.hash.length);
  return timingSafeEqual(key, parsed.hash);
}

/** Indica se o hash foi gerado com parâmetros diferentes dos atuais (refazer no próximo login). */
export function needsRehash(stored: string): boolean {
  const parsed = parseHash(stored);
  if (!parsed) return true;
  const { ln, r, p } = SCRYPT_PARAMS;
  return parsed.params.ln !== ln || parsed.params.r !== r || parsed.params.p !== p;
}

let dummyHash: Promise<string> | null = null;

/**
 * Faz o mesmo trabalho de uma verificação real quando o e-mail não existe.
 * Assim o tempo de resposta não revela quais e-mails estão cadastrados.
 */
export async function verifyAgainstDummy(senha: string): Promise<void> {
  dummyHash ??= hashPassword(randomBytes(24).toString('base64'));
  await verifyPassword(senha, await dummyHash);
}
