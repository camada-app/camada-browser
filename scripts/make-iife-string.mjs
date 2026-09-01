// Reads dist/auto.global.js (the built self-initializing beacon) and re-emits it as an
// importable string, so backend SDKs can serve the beacon at /_cam/b.js straight from
// memory via the `@camada/browser/iife-string` export — no filesystem access at runtime.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const source = readFileSync(join(dist, 'auto.global.js'), 'utf8');
const escaped = JSON.stringify(source);

writeFileSync(join(dist, 'iife-string.js'), `export default ${escaped};\n`);
// Sloppy-mode CJS on purpose: module.exports is a string primitive, so the .default
// assignment is a silent no-op interop nicety rather than a strict-mode TypeError.
writeFileSync(join(dist, 'iife-string.cjs'), `module.exports = ${escaped};\nmodule.exports.default = module.exports;\n`);
writeFileSync(join(dist, 'iife-string.d.ts'), `declare const s: string;\nexport default s;\n`);

console.log(`iife-string: ${source.length} bytes -> dist/iife-string.{js,cjs,d.ts}`);
