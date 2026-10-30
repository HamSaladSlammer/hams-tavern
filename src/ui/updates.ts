// Updating from inside the app. On the web, the service worker fetches the new build. In the
// Android app, a new web bundle is downloaded from the same GitHub Pages site and swapped in
// on the spot (the save is untouched); only changes to the native shell need a new APK.
declare const __BUILD__: number;
declare const __NATIVE_API__: number;
export const BUILD = typeof __BUILD__ === 'number' ? __BUILD__ : 0;
export const SITE = 'https://hamsaladslammer.github.io/hams-tavern/';

export interface RemoteVersion { version: string; build: number; bundle: string; nativeApi: number; notes?: string }
type Notify = (msg: string, onTap?: () => void) => void;

const isNative = () => !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

export async function fetchRemote(): Promise<RemoteVersion | null> {
  try {
    const r = await fetch(`${SITE}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    return (await r.json()) as RemoteVersion;
  } catch { return null; }
}

/** Call once at start-up in the Android app, so a good update isn't rolled back. */
export async function nativeReady() {
  if (!isNative()) return;
  try { const { CapacitorUpdater } = await import('@capgo/capacitor-updater'); await CapacitorUpdater.notifyAppReady(); } catch { /* plugin missing in this shell */ }
}

async function shellNativeApi(): Promise<number> {
  try { const { App } = await import('@capacitor/app'); const info = await App.getInfo(); const m = info.version.match(/\+n(\d+)/); return m ? Number(m[1]) : 1; } catch { return 1; }
}

let busy = false;
/** Look for a newer build. manual: the player pressed the button, so always say something. */
export async function checkForUpdates(notify: Notify, manual = false) {
  if (busy) return;
  busy = true;
  try {
    const remote = await fetchRemote();
    if (!remote) { if (manual) notify('Couldn\'t reach the update server. You might be offline.'); return; }
    if (remote.build <= BUILD) { if (manual) notify(`You're up to date (v${remote.version}, build ${BUILD || 'dev'}).`); return; }
    if (!isNative()) {
      const reg = await navigator.serviceWorker?.getRegistration?.();
      await reg?.update().catch(() => undefined);
      notify(`Hams Tavern ${remote.version} (build ${remote.build}) is ready.`, () => { void webInstall(); });
      return;
    }
    const api = await shellNativeApi();
    if (remote.nativeApi > api) {
      notify(`Hams Tavern ${remote.version} needs a new app download. Your save stays on this phone.`, () => window.open(`${SITE}hams-tavern.apk`, '_system'));
      return;
    }
    notify(`Hams Tavern ${remote.version} (build ${remote.build}) is ready to install.`, () => { void install(remote, notify); });
  } finally { busy = false; }
}

async function install(remote: RemoteVersion, notify: Notify) {
  try {
    notify('Downloading the update…');
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    const url = new URL(remote.bundle, SITE).toString();
    const b = await CapacitorUpdater.download({ url, version: `${remote.version}-${remote.build}` });
    await CapacitorUpdater.set({ id: b.id });
  } catch {
    notify('The update didn\'t download. You can get the full app instead.', () => window.open(`${SITE}hams-tavern.apk`, '_system'));
  }
}

/** On the web: let the new service worker take over, then reload into the new version. */
async function webInstall() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) {
      await reg.update().catch(() => undefined);
      const w = reg.installing ?? reg.waiting;
      if (w && w.state !== 'activated') await Promise.race([new Promise((res) => w.addEventListener('statechange', () => { if (w.state === 'activated') res(0); })), new Promise((res) => setTimeout(res, 8000))]);
    }
  } catch { /* reload anyway */ }
  location.reload();
}
