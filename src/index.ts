// @camada/browser — TypeScript port of the collector's fp-beacon.js.
// Runs in the visitor's browser. Collects device, engine, automation and interaction
// signals, waits two seconds for human input, posts once to the configured same-origin
// endpoint (and again on pagehide). No cookies read, no storage written, no third-party calls.
//
// WIRE COMPATIBILITY: the payload shape below is consumed by the analysis pipeline's
// feedBeacon() (edge-analyst/src/features.js) — the exact top-level keys (rid, ts, scr,
// win, dpr, tz, tzo, lang, langs, plat, cores, mem, touch, ua, dnt, cookies, conn, gl,
// cv, mf, auto, vis, focus, timing, paint, input, and hi merged before the delayed send)
// must not be renamed or removed.

export interface InitBeaconOptions {
  /** Same-origin path (or URL) the payload is POSTed to, e.g. '/_cam/fp'. */
  endpoint: string;
  /** Request id correlating this beacon with the page view that served it. */
  rid?: string | null;
}

/** A throwing API (canvas blocked, spoofed getters, …) must never kill collection. */
function safe<T>(f: () => T): T | null {
  try { return f(); } catch { return null; }
}

function hash(s: string): string {           // FNV-1a, 32-bit, enough to compare
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

function canvasHash(): string | null {
  const c = document.createElement('canvas'); c.width = 240; c.height = 60;
  const x = c.getContext('2d'); if (!x) return null;
  x.textBaseline = 'alphabetic'; x.fillStyle = '#f60'; x.fillRect(120, 5, 60, 20);
  x.fillStyle = '#069'; x.font = '15px Arial'; x.fillText('Sfp☃ 1.0', 2, 15);
  x.fillStyle = 'rgba(102,204,0,0.7)'; x.font = '17px Times'; x.fillText('Sfp☃ 1.0', 4, 45);
  return hash(c.toDataURL());
}

function webgl(): { v: unknown; r: unknown } | null {
  const c = document.createElement('canvas');
  const g = (c.getContext('webgl') || c.getContext('experimental-webgl')) as WebGLRenderingContext | null;
  if (!g) return null;
  const d = g.getExtension('WEBGL_debug_renderer_info');
  return {
    v: d ? g.getParameter(d.UNMASKED_VENDOR_WEBGL) : g.getParameter(g.VENDOR),
    r: d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER),
  };
}

function mathFp(): string {                  // engine constants differ across JS engines and emulators
  return hash([Math.tan(-1e300), Math.sinh(1), Math.expm1(1), Math.cbrt(100), Math.log1p(10), Math.atanh(0.5)].join('|'));
}

const AUTOMATION_DOC_RE = /^\$?cdc_|^__webdriver|^__selenium|^__nightmare|^__playwright|^callPhantom/;
const AUTOMATION_WIN_RE = /^\$?cdc_|^__webdriver|^__selenium|^__nightmare|^__playwright|^callPhantom|^_phantom/;

function automation() {
  const d = document as unknown as Record<string, unknown>;
  const n = navigator as Navigator & { pdfViewerEnabled?: boolean };
  const w = window as unknown as Record<string, unknown>;
  let cdc = 0;
  for (const k in d) if (AUTOMATION_DOC_RE.test(k)) cdc++;
  for (const k2 in w) if (AUTOMATION_WIN_RE.test(k2)) cdc++;
  return {
    wd: n.webdriver === true ? 1 : 0,
    cdc: cdc,
    chrome: typeof w.chrome !== 'undefined' ? 1 : 0,
    plugins: n.plugins ? n.plugins.length : -1,
    langs: n.languages ? n.languages.length : -1,
    outer: window.outerWidth === 0 && window.outerHeight === 0 ? 1 : 0,
    perm: safe(() => Notification.permission),
    pdf: typeof n.pdfViewerEnabled === 'boolean' ? (n.pdfViewerEnabled ? 1 : 0) : -1,
    err: safe(() => { try { (null as unknown as { x: unknown }).x; } catch (e) { const st = (e as Error).stack; return st ? st.split('\n').length : 0; } }),
  };
}

/**
 * Start the beacon: register input listeners now, collect and POST the payload to
 * `endpoint` after ~2s (merging high-entropy client hints as `hi` when available),
 * and send again on pagehide. Prefers navigator.sendBeacon, falls back to
 * fetch({ method: 'POST', keepalive: true }).
 */
export function initBeacon({ endpoint, rid }: InitBeaconOptions): void {
  const ridVal = rid || '';
  const t0 = performance.now();
  let moves = 0, scrolls = 0, keys = 0, touches = 0, clicks = 0;
  let firstInput: number | null = null;
  function mark() { if (firstInput === null) firstInput = Math.round(performance.now() - t0); }
  addEventListener('mousemove', () => { moves++; mark(); }, { passive: true });
  addEventListener('scroll', () => { scrolls++; mark(); }, { passive: true });
  addEventListener('keydown', () => { keys++; mark(); }, { passive: true });
  addEventListener('touchstart', () => { touches++; mark(); }, { passive: true });
  addEventListener('click', () => { clicks++; mark(); }, { passive: true });

  function collect(): Record<string, unknown> {
    const n = navigator as Navigator & { deviceMemory?: number; connection?: Record<string, unknown>; doNotTrack?: string | null };
    const nav = safe(() => performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined);
    const paint = safe(() => { const p = performance.getEntriesByType('paint'); return p.length ? Math.round(p[p.length - 1].startTime) : null; });
    const conn = safe(() => n.connection) || ({} as Record<string, unknown>);
    return {
      rid: ridVal, ts: Date.now(),
      scr: safe(() => [screen.width, screen.height, screen.availWidth, screen.availHeight, screen.colorDepth]),
      win: safe(() => [window.innerWidth, window.innerHeight, window.outerWidth, window.outerHeight]),
      dpr: safe(() => window.devicePixelRatio),
      tz: safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
      tzo: safe(() => new Date().getTimezoneOffset()),
      lang: safe(() => n.language),
      langs: safe(() => (n.languages ? Array.prototype.slice.call(n.languages, 0, 5) : null)),
      plat: safe(() => n.platform),
      cores: safe(() => n.hardwareConcurrency),
      mem: safe(() => n.deviceMemory),
      touch: safe(() => n.maxTouchPoints),
      ua: safe(() => n.userAgent),
      dnt: safe(() => n.doNotTrack),
      cookies: safe(() => (n.cookieEnabled ? 1 : 0)),
      conn: safe(() => [conn.effectiveType, conn.rtt, conn.downlink, conn.saveData ? 1 : 0]),
      gl: safe(webgl), cv: safe(canvasHash), mf: safe(mathFp), auto: safe(automation),
      vis: safe(() => document.visibilityState),
      focus: safe(() => (document.hasFocus() ? 1 : 0)),
      timing: nav ? [Math.round(nav.domContentLoadedEventEnd), Math.round(nav.loadEventEnd), Math.round(nav.responseEnd - nav.requestStart)] : null,
      paint: paint,
      input: { moves: moves, scrolls: scrolls, keys: keys, touches: touches, clicks: clicks, first: firstInput, at: Math.round(performance.now() - t0) },
    };
  }

  function send(hi: unknown): void {
    const body = JSON.stringify(hi ? Object.assign(collect(), { hi: hi }) : collect());
    if (!(navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' })))) {
      fetch(endpoint, { method: 'POST', body: body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {});
    }
  }

  // High-entropy client hints arrive async; include them when available.
  const uad = (navigator as Navigator & { userAgentData?: { getHighEntropyValues?: (hints: string[]) => Promise<unknown> } }).userAgentData;
  const ready: Promise<unknown> = uad && uad.getHighEntropyValues
    ? uad.getHighEntropyValues(['architecture', 'bitness', 'model', 'platformVersion', 'fullVersionList']).catch(() => null)
    : Promise.resolve(null);

  setTimeout(() => { ready.then(send); }, 2000);
  addEventListener('pagehide', () => { ready.then((hi) => { send(hi); }); }, { once: true });
}
