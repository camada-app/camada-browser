# Changelog

## 0.4.0 (2026-10-26; follows 0.3.2)

Version-only, in lockstep with `@camada/node` 0.4.0 (SDK-G08).

## 0.3.2 (2026-10-12; follows 0.3.1)

### Changed

- `dist/iife-string.d.cts` is now emitted (`export =`). The `exports` map now gives `require` its own `.d.cts` declarations (`import` and `require` each carry a `types` condition), so a CommonJS TypeScript app on `moduleResolution: node16` compiles; CI runs `@arethetypeswrong/cli`. (camada-all-vuzm)

## 0.3.1 (2026-10-09; follows 0.3.0)

- Version-only release, in lockstep with `@camada/node` 0.3.1. Nothing changed for the browser.

## 0.3.0 (2026-10-04; follows 0.2.0)

### Changed

- `engines.node` is `>=20` (was `>=18`). npm only warns on an older Node unless
  `engine-strict` is set.
- No API changes. The version moves in lockstep with `@camada/node` 0.3.0.
