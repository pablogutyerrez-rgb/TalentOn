import { describe, expect, it } from 'vitest';
import { sealLinkToken, unsealLinkToken } from '../src/operations';

describe('enlaces RQ recuperables', () => {
  it('guarda un token cifrado que solo puede abrirse con la clave del Worker', async () => {
    const token = 'a'.repeat(48);
    const env = { CAPTURE_HASH_SECRET: 'test-secret-for-operations' };
    const first = await sealLinkToken(token, env);
    const second = await sealLinkToken(token, env);
    expect(first).not.toContain(token);
    expect(first).not.toBe(second);
    expect(await unsealLinkToken(first, env)).toBe(token);
    await expect(unsealLinkToken(first, { CAPTURE_HASH_SECRET: 'different-secret' })).rejects.toThrow();
  });
});
