// @vitest-environment node
// The built artefacts must carry the package name and version as literals: the server SDKs
// serve dist/iife-string.js verbatim, so these are the strings a visitor's browser joins into
// `sdk`. tsup inlines the two JSON fields as separate constants, so both are asserted rather
// than the joined id. CI builds before it tests; locally the suite skips until `npm run build`.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { name, version } from '../package.json';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
// iife-string.* hold the minified IIFE as a JSON string, so its quotes arrive escaped.
const literal = (s: string) => new RegExp(`\\\\?"${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\\\?"`);

describe.skipIf(!existsSync(dist + 'auto.global.js'))('built artefacts', () => {
  for (const file of ['auto.global.js', 'iife-string.js', 'iife-string.cjs', 'index.js', 'index.cjs']) {
    it(`${file} carries ${name} ${version} inlined`, () => {
      const src = readFileSync(dist + file, 'utf8');
      expect(src).toMatch(literal(name));
      expect(src).toMatch(literal(version));
      expect(src).not.toMatch(/(from|require\()\s*["'][^"']*package\.json/);   // inlined, never resolved at runtime
    });
  }
});
