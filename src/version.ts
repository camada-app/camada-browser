// The beacon's wire identity (SDK-G07): `sdk: "<package>/<version>"` in the payload, because
// `sendBeacon` cannot set the `x-camada-sdk` header the server SDKs use. Named JSON imports are
// inlined by tsup, so the ESM, CJS and IIFE builds each carry a literal — no runtime lookup.
import { name, version } from '../package.json';

export const SDK_ID = `${name}/${version}`;
