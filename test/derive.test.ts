import { describe, expect, it } from 'vitest';
import { deriveFromScriptSrc } from '../src/auto';

describe('deriveFromScriptSrc', () => {
  it('replaces the final path segment with fp and reads the r query param', () => {
    expect(deriveFromScriptSrc('/_cam/b.js?r=abc')).toEqual({ endpoint: '/_cam/fp', rid: 'abc' });
  });

  it('works at any mount path; rid is null when absent', () => {
    expect(deriveFromScriptSrc('/api/camada/b.js')).toEqual({ endpoint: '/api/camada/fp', rid: null });
  });

  it('keeps only the same-origin path for absolute URLs', () => {
    expect(deriveFromScriptSrc('https://shop.example.com/_cam/b.js?r=xyz')).toEqual({ endpoint: '/_cam/fp', rid: 'xyz' });
    expect(deriveFromScriptSrc('https://shop.example.com:8443/deep/nested/loader.js')).toEqual({ endpoint: '/deep/nested/fp', rid: null });
  });
});
