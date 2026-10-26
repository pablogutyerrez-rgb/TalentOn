const RELOAD_KEY = 'talent-on:asset-reload-at';
const RELOAD_WINDOW_MS = 30_000;

export function isAssetLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|loading chunk .* failed|chunkloaderror|expected a javascript(?:-or-wasm)? module script|preload.*error/i.test(message);
}

export function shouldAutoReload(lastReloadAt: number, now: number): boolean {
  return !Number.isFinite(lastReloadAt) || now - lastReloadAt > RELOAD_WINDOW_MS;
}

export function reloadOnceForAssetError(error: unknown): boolean {
  if (!isAssetLoadError(error)) return false;
  try {
    const now = Date.now();
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
    if (!shouldAutoReload(last, now)) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(now));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}
