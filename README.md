# @camada/browser

The camada fingerprint beacon as a TypeScript package: a browser module plus a
self-initializing IIFE build that backend SDKs serve first-party.

It collects device, engine, automation and interaction signals in the visitor's
browser, waits ~2 seconds for human input, then POSTs a single JSON payload to a
same-origin endpoint (and again on `pagehide`). No cookies read, no storage
written, no third-party calls.

## Wire payload

The analyst's `feedBeacon()` (`edge-analyst/src/features.js`) reads the payload by
key, so the top-level keys are pinned (`test/beacon.test.ts` guards them): `sdk`,
`rid`, `ts`, `scr`, `win`, `dpr`, `tz`, `tzo`, `lang`, `langs`, `plat`, `cores`,
`mem`, `touch`, `ua`, `dnt`, `cookies`, `conn`, `gl`, `cv`, `mf`, `auto`, `vis`,
`focus`, `timing`, `paint`, `input`, plus `hi` (high-entropy client hints) when the
browser answers in time.

`sdk` is `"@camada/browser/<version>"` — the beacon's own build, stamped at build
time. `sendBeacon` cannot set headers, so this is how the analyst's freshness learns
which beacon a project runs (the server SDKs report themselves through
`x-camada-sdk`); the dashboard uses it to flag an outdated beacon. A `b.js` cached
from before 0.2.0 sends no `sdk` and is simply not versioned.

## Install

Unpublished. Consume it from a sibling checkout via a `file:` dependency:

```json
{
  "dependencies": {
    "@camada/browser": "file:../camada-browser"
  }
}
```

Run `npm run build` in this repo first so `dist/` exists.

## Quickstart

Programmatic init (bundled into your own app code):

```ts
import { initBeacon } from '@camada/browser';

initBeacon({ endpoint: '/_cam/fp', rid: pageViewRequestId });
```

- `endpoint` — same-origin path the payload is POSTed to.
- `rid` (optional) — request id correlating the beacon with the page view that
  served it; defaults to the empty string on the wire.

Self-initializing script (no bundler on the page): serve `dist/auto.global.js`
as a classic `<script src>`. It reads its own script URL — the `r` query param
becomes the rid, and the URL's final path segment is replaced with `fp` to form
the endpoint (`/_cam/b.js?r=abc` → POST `/_cam/fp` with `rid: "abc"`). If
`document.currentScript` is unavailable it does nothing, silently.

## Serving from a backend SDK

This is the intended production path, and `@camada/node`, `@camada/next` and
`@camada/hono` already do it: each serves the built IIFE first-party at its
`scriptPath` (`/_cam/b.js`; `@camada/next` uses `/api/camada/b.js`), accepts the
beacon at the sibling `fpPath` (`/_cam/fp`, at most 32 KB, answers 204) and ships it
inside its event batch as a `sig: 1` row stamped with the client IP it resolved
itself and its own `tap` — one request per flush at the analyst, not one per page
view. Both endpoints sit behind the SDK's verdict (a blocked client gets 403). When
the project turns the beacon off in its settings `@camada/node` and `@camada/hono`
stand both endpoints down; `@camada/next` stops serving `b.js` (its `fp` route still
relays a body a cached script posts until that cache expires).

The `fpPath` must live in the `scriptPath`'s directory: the self-initializing
script derives the POST target by replacing the last segment of its own URL with
`fp`. Move both when mounting under a prefix.

`npm run build` embeds `dist/auto.global.js` as a string, importable without
filesystem access, which is what the SDKs serve:

```ts
import beaconSource from '@camada/browser/iife-string';

// e.g. in your own route handler:
res.setHeader('content-type', 'application/javascript');
res.setHeader('cache-control', 'public, max-age=3600');
res.end(beaconSource);
```

The SDK packages mark this import external, so they need no rebuild — but the
import is resolved where the application is bundled: a Worker inlines the IIFE at
`wrangler deploy` and a Next app at `next build`, so redeploy those after rebuilding
this package; a plain-Node process picks the new `dist/` up on restart.
`@camada/browser/iife` resolves to the raw `dist/auto.global.js` file for setups
that prefer serving the file itself.

## Development

```bash
npm install
npm run build   # tsup (ESM + CJS + IIFE) + dist/iife-string.{js,cjs,d.ts}
npm test        # vitest (jsdom)
npm run check   # tsc --noEmit
```
