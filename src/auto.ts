// Self-initializing entry — built by tsup as dist/auto.global.js and served first-party
// by the backend SDKs (e.g. at /_cam/b.js). Reads its own <script> src to derive the
// ingest endpoint and the request id, then starts the beacon. Does nothing, silently,
// when document.currentScript is unavailable (module scripts, workers, test imports).
import { initBeacon } from './index';

/**
 * Derive the beacon config from the serving script's src:
 * - endpoint: the script URL's path with its final segment replaced by 'fp', same origin
 *   (/_cam/b.js -> /_cam/fp, /api/camada/b.js -> /api/camada/fp; absolute URLs keep only
 *   their same-origin path).
 * - rid: the `r` query param, or null when absent.
 */
export function deriveFromScriptSrc(src: string): { endpoint: string; rid: string | null } {
  const u = new URL(src, 'http://_');   // base lets path-relative srcs parse; absolute srcs ignore it
  const parts = u.pathname.split('/');
  parts[parts.length - 1] = 'fp';
  return { endpoint: parts.join('/'), rid: u.searchParams.get('r') };
}

(function () {
  try {
    const el = document.currentScript as HTMLScriptElement | null;
    const src = el && el.src;
    if (!src) return;
    const { endpoint, rid } = deriveFromScriptSrc(src);
    initBeacon({ endpoint, rid });
  } catch {
    // never break the host page
  }
})();
