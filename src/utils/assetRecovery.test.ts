import { describe, expect, it } from 'vitest';
import { isAssetLoadError, shouldAutoReload } from './assetRecovery';

describe('recuperación de módulos', () => {
  it('reconoce fallos de bundles sin confundirlos con errores de datos', () => {
    expect(isAssetLoadError(new Error('Failed to fetch dynamically imported module: /assets/Dashboard-old.js'))).toBe(true);
    expect(isAssetLoadError(new Error('Loading chunk 42 failed'))).toBe(true);
    expect(isAssetLoadError(new Error('Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of text/html'))).toBe(true);
    expect(isAssetLoadError(new Error('Preload error'))).toBe(true);
    expect(isAssetLoadError(new Error('No se pudo guardar el candidato'))).toBe(false);
  });

  it('permite una recarga y evita el bucle durante treinta segundos', () => {
    expect(shouldAutoReload(0, 100_000)).toBe(true);
    expect(shouldAutoReload(100_000, 100_001)).toBe(false);
    expect(shouldAutoReload(100_000, 130_000)).toBe(false);
    expect(shouldAutoReload(100_000, 130_001)).toBe(true);
  });
});
