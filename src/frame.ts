// Internal: bundled into the beacon, not part of the package entry. Compare to `window`, not
// `self`: window.self can be rewritten by a tenant global, window and window.top cannot.
// Reading a cross-origin top does not throw; callers still wrap in safe() for hostile getters.
export function frameFlag(w: Window): 0 | 1 {
  return w.top !== w ? 1 : 0;
}
