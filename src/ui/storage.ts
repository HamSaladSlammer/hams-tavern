// One save layer for every platform. Browser/PWA uses localStorage today; the Android (Capacitor)
// and Steam (Electron) builds can swap in their own backends without touching the game.
export interface SaveBackend {
  load(key: string): string | null;
  save(key: string, value: string): void;
  remove(key: string): void;
}

const memory = new Map<string, string>();

export const browserBackend: SaveBackend = {
  load(key) { try { return localStorage.getItem(key); } catch { return memory.get(key) ?? null; } },
  save(key, value) { try { localStorage.setItem(key, value); } catch { memory.set(key, value); } },
  remove(key) { try { localStorage.removeItem(key); } catch { memory.delete(key); } },
};

export let backend: SaveBackend = browserBackend;
export function setBackend(b: SaveBackend) { backend = b; }

export const SAVE_KEY = 'hams.save.v1';
export const PREFS_KEY = 'hams.prefs.v1';
