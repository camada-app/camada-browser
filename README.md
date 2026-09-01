# @camada/browser

The camada fingerprint beacon as a TypeScript package: a browser module plus a
self-initializing IIFE build that backend SDKs serve first-party.

It collects device, engine, automation and interaction signals in the visitor's
browser, waits ~2 seconds for human input, then POSTs a single JSON payload to a
same-origin endpoint (and again on `pagehide`). No cookies read, no storage
written, no third-party calls. The payload shape is wire-compatible with the
original edge-collector beacon — the analysis pipeline depends on its exact keys.

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

This is the intended production path: the backend SDKs serve the built IIFE at
`/_cam/b.js` on the customer's own origin. `npm run build` embeds
`dist/auto.global.js` as a string, importable without filesystem access:

```ts
import beaconSource from '@camada/browser/iife-string';

// e.g. in your route handler:
res.setHeader('content-type', 'text/javascript');
res.end(beaconSource);
```

`@camada/browser/iife` resolves to the raw `dist/auto.global.js` file for
setups that prefer serving the file itself.

## Development

```bash
npm install
npm run build   # tsup (ESM + CJS + IIFE) + dist/iife-string.{js,cjs,d.ts}
npm test        # vitest (jsdom)
npm run check   # tsc --noEmit
```
