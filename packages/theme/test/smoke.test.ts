import { describe, expect, it } from 'vitest';
import { packageName } from '../src/index.js';

describe('@ezdp/theme scaffold', () => {
  it('exports its placeholder', () => {
    expect(packageName).toBe('@ezdp/theme');
  });
});
