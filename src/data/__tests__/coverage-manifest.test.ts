import { describe, expect, it } from 'vitest';
import { testOnlyFiles } from '../../../test-only-manifest.ts';

describe('production coverage manifest', () => {
  it('classifies test-setup.ts as test-only', () => {
    expect(testOnlyFiles).toContain('src/test-setup.ts');
  });
});
