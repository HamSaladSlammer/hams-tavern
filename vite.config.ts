import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const native = JSON.parse(readFileSync('./native.json', 'utf8'));
const BUILD_NUMBER = Number(process.env.BUILD_NUMBER ?? 0);
const BUILD = `${pkg.version}-${BUILD_NUMBER || Date.now().toString(36)}`;

// Emits sw.js with a precache list of every built file, so the game works offline after one visit.
function serviceWorker(): Plugin {
  return {
    name: 'hams-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const assets = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './lahti-map.webp', ...files.map((f) => './' + f)];
      const src = readFileSync('./src/sw-template.js', 'utf8')
        .replace('__CACHE__', JSON.stringify('hams-' + BUILD))
        .replace('__ASSETS__', JSON.stringify(Array.from(new Set(assets))));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: src });
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: pkg.version, build: BUILD_NUMBER, bundle: `updates/bundle-${BUILD_NUMBER}.zip`, nativeApi: native.nativeApi }) });
    },
  };
}

// base './' so the same build works on GitHub Pages, inside Capacitor (Android) and Electron (Steam).
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD__: JSON.stringify(BUILD_NUMBER), __NATIVE_API__: JSON.stringify(native.nativeApi) },
  build: { outDir: 'dist', target: 'es2020', assetsInlineLimit: 0 },
  plugins: [serviceWorker()],
  test: { globals: true, environment: 'node' },
} as any);
