import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initBeacon } from '../src/index';
import { name, version } from '../package.json';

// The beacon's wire identity (SDK-G07): sendBeacon cannot set x-camada-sdk, so the body carries it.
const SDK_ID = `${name}/${version}`;

// Every top-level key feedBeacon() (edge-analyst/src/features.js) may look at, plus `sdk`
// (read by freshness, not by the scorer).
const PAYLOAD_KEYS = [
  'sdk', 'rid', 'ts', 'scr', 'win', 'dpr', 'tz', 'tzo', 'lang', 'langs', 'plat', 'cores', 'mem',
  'touch', 'ua', 'dnt', 'cookies', 'conn', 'gl', 'cv', 'mf', 'auto', 'vis', 'focus',
  'timing', 'paint', 'input',
] as const;

let fetchMock: ReturnType<typeof vi.fn>;
const definedNavProps: string[] = [];

/** Define (or shadow) a navigator property for one test; cleaned up in afterEach. */
function defineNav(name: string, value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true, writable: true });
  definedNavProps.push(name);
}

/** fetch calls made to one endpoint (inits from other tests may still hold pagehide listeners). */
function fetchCallsTo(endpoint: string) {
  return fetchMock.mock.calls.filter((c) => c[0] === endpoint);
}

function bodyOf(call: unknown[]): Record<string, unknown> {
  return JSON.parse((call[1] as { body: string }).body);
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(() => Promise.resolve());
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  for (const name of definedNavProps.splice(0)) delete (navigator as unknown as Record<string, unknown>)[name];
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('payload shape', () => {
  it('posts the full payload after ~2s with every expected top-level key', async () => {
    // Stub what jsdom lacks so JSON.stringify does not drop undefined-valued keys.
    defineNav('deviceMemory', 8);
    defineNav('doNotTrack', '1');
    defineNav('hardwareConcurrency', 8);
    defineNav('maxTouchPoints', 0);
    defineNav('sendBeacon', undefined); // force the fetch path so we can read the body

    initBeacon({ endpoint: '/shape/fp', rid: 'r-shape' });
    await vi.advanceTimersByTimeAsync(2001);

    const calls = fetchCallsTo('/shape/fp');
    expect(calls).toHaveLength(1);
    const opts = calls[0][1] as { method: string; keepalive: boolean; headers: Record<string, string>; body: string };
    expect(opts.method).toBe('POST');
    expect(opts.headers['content-type']).toBe('application/json');

    const body = bodyOf(calls[0]);
    for (const key of PAYLOAD_KEYS) expect(body, `missing top-level key "${key}"`).toHaveProperty(key);
    expect(body.sdk).toBe(SDK_ID);
    expect(body.rid).toBe('r-shape');
    expect(typeof body.ts).toBe('number');
    expect(body.input).toMatchObject({ moves: 0, scrolls: 0, keys: 0, touches: 0, clicks: 0, first: null });
    expect(body.auto).toHaveProperty('wd');
    expect(body.auto).toHaveProperty('cdc');
    expect(typeof body.mf).toBe('string');
  });

  it('rid defaults to the empty string, matching the original beacon', async () => {
    defineNav('sendBeacon', undefined);
    initBeacon({ endpoint: '/norid/fp' });
    await vi.advanceTimersByTimeAsync(2001);
    expect(bodyOf(fetchCallsTo('/norid/fp')[0]).rid).toBe('');
  });

  it('merges high-entropy client hints as hi before the delayed send', async () => {
    defineNav('userAgentData', {
      getHighEntropyValues: vi.fn(() => Promise.resolve({ model: 'Pixel 9', bitness: '64' })),
    });
    defineNav('sendBeacon', undefined);
    initBeacon({ endpoint: '/hi/fp', rid: 'r-hi' });
    await vi.advanceTimersByTimeAsync(2001);
    const body = bodyOf(fetchCallsTo('/hi/fp')[0]);
    expect(body.hi).toEqual({ model: 'Pixel 9', bitness: '64' });
    expect(body.rid).toBe('r-hi');
  });

  it('counts input events and stamps first-input timing', async () => {
    defineNav('sendBeacon', undefined);
    initBeacon({ endpoint: '/input/fp' });
    window.dispatchEvent(new Event('mousemove'));
    window.dispatchEvent(new Event('mousemove'));
    window.dispatchEvent(new Event('keydown'));
    await vi.advanceTimersByTimeAsync(2001);
    const input = bodyOf(fetchCallsTo('/input/fp')[0]).input as Record<string, unknown>;
    expect(input.moves).toBe(2);
    expect(input.keys).toBe(1);
    expect(typeof input.first).toBe('number');
  });
});

describe('transport', () => {
  it('prefers sendBeacon and skips fetch when it accepts the payload', async () => {
    const sendBeacon = vi.fn(() => true);
    defineNav('sendBeacon', sendBeacon);
    initBeacon({ endpoint: '/sb-ok/fp' });
    await vi.advanceTimersByTimeAsync(2001);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect((sendBeacon.mock.calls[0] as unknown[])[0]).toBe('/sb-ok/fp');
    expect(fetchCallsTo('/sb-ok/fp')).toHaveLength(0);
    const blob = (sendBeacon.mock.calls[0] as unknown[])[1] as Blob;   // the only place this transport's body is inspected
    expect(blob.type).toBe('application/json');
    vi.useRealTimers();   // the beacon has fired; FileReader's load event needs real scheduling
    const text = await new Promise<string>((resolve) => {   // jsdom's Blob has no text(); FileReader is what it does implement
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsText(blob);
    });
    expect(JSON.parse(text).sdk).toBe(SDK_ID);
  });

  it('falls back to fetch keepalive POST when sendBeacon returns false', async () => {
    defineNav('sendBeacon', vi.fn(() => false));
    initBeacon({ endpoint: '/sb-false/fp' });
    await vi.advanceTimersByTimeAsync(2001);
    const calls = fetchCallsTo('/sb-false/fp');
    expect(calls).toHaveLength(1);
    const opts = calls[0][1] as { method: string; keepalive: boolean };
    expect(opts.method).toBe('POST');
    expect(opts.keepalive).toBe(true);
  });

  it('falls back to fetch when sendBeacon is missing entirely', async () => {
    defineNav('sendBeacon', undefined);
    initBeacon({ endpoint: '/sb-missing/fp' });
    await vi.advanceTimersByTimeAsync(2001);
    expect(fetchCallsTo('/sb-missing/fp')).toHaveLength(1);
  });

  it('sends again on pagehide', async () => {
    defineNav('sendBeacon', undefined);
    initBeacon({ endpoint: '/pagehide/fp' });
    await vi.advanceTimersByTimeAsync(2001);
    expect(fetchCallsTo('/pagehide/fp')).toHaveLength(1);
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(0); // flush the ready.then microtask
    expect(fetchCallsTo('/pagehide/fp')).toHaveLength(2);
  });
});

describe('resilience', () => {
  it('still posts when a collector throws (screen access blocked)', async () => {
    vi.stubGlobal('screen', {
      get width(): number { throw new Error('blocked'); },
    });
    defineNav('sendBeacon', undefined);
    initBeacon({ endpoint: '/throw/fp', rid: 'r-throw' });
    await vi.advanceTimersByTimeAsync(2001);

    const calls = fetchCallsTo('/throw/fp');
    expect(calls).toHaveLength(1);
    const body = bodyOf(calls[0]);
    expect(body.scr).toBeNull();      // the throwing collector degrades to null…
    expect(body.rid).toBe('r-throw'); // …and the rest of the payload still ships
    expect(body).toHaveProperty('ua');
    expect(body).toHaveProperty('input');
  });
});
