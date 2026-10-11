import { describe, expect, it } from 'vitest';
import { hashPassword, needsRehash, verifyAgainstDummy, verifyPassword } from './password';
import { generateSessionToken, hashSessionToken, isWellFormedSessionToken } from './tokens';

describe('hash de senha (scrypt)', () => {
  it('gera hash no formato com parâmetros e confere a senha certa', async () => {
    const hash = await hashPassword('minha senha secreta');
    expect(hash).toMatch(/^scrypt\$ln=15,r=8,p=3\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(hash).not.toContain('minha senha secreta');
    expect(await verifyPassword('minha senha secreta', hash)).toBe(true);
  });

  it('recusa senha errada', async () => {
    const hash = await hashPassword('senha-correta-1');
    expect(await verifyPassword('senha-correta-2', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('a mesma senha gera hashes diferentes (sal aleatório)', async () => {
    const [a, b] = await Promise.all([hashPassword('repetida-123'), hashPassword('repetida-123')]);
    expect(a).not.toBe(b);
  });

  it('trata acentos de forma consistente (normalização Unicode)', async () => {
    // Mesma senha em duas codificações Unicode: "ç" como 1 caractere (NFC)
    // ou como "c" + acento combinante (NFD), como alguns teclados/sistemas enviam.
    const composta = 'coração-123'.normalize('NFC');
    const decomposta = composta.normalize('NFD');
    expect(decomposta).not.toBe(composta);
    const hash = await hashPassword(composta);
    expect(await verifyPassword(decomposta, hash)).toBe(true);
  });

  it('nunca aceita hash malformado', async () => {
    for (const hash of [
      '',
      'texto',
      'scrypt$ln=15,r=8,p=3$$',
      'bcrypt$x$y$z',
      'scrypt$ln=99,r=8,p=3$a$b',
    ]) {
      expect(await verifyPassword('qualquer', hash)).toBe(false);
    }
  });

  it('indica quando o hash precisa ser refeito', async () => {
    expect(needsRehash(await hashPassword('x-123456789'))).toBe(false);
    expect(needsRehash('scrypt$ln=14,r=8,p=1$AAAAAAAAAAAAAAAAAAAAAA==$' + 'A'.repeat(88))).toBe(
      true,
    );
    expect(needsRehash('lixo')).toBe(true);
  });

  it('verificação "falsa" para e-mail inexistente roda sem erro', async () => {
    await verifyAgainstDummy('qualquer-coisa');
  });
});

describe('token de sessão', () => {
  it('tem 256 bits em base64url e o id é o SHA-256 do token', () => {
    const { token, id } = generateSessionToken();
    expect(isWellFormedSessionToken(token)).toBe(true);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(id).toBe(hashSessionToken(token));
  });

  it('cada token é único', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateSessionToken().token));
    expect(tokens.size).toBe(200);
  });

  it('rejeita formatos inesperados', () => {
    for (const valor of [
      '',
      'curto',
      'x'.repeat(44),
      'com espaço'.padEnd(43, 'x'),
      '../'.repeat(15),
    ]) {
      expect(isWellFormedSessionToken(valor)).toBe(false);
    }
  });
});
