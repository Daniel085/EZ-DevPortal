import { describe, expect, it } from 'vitest';
import { dependsOn, packageName } from '../src/index.js';

describe('@ezdp/publisher scaffold', () => {
  it('exports its placeholder and resolves @ezdp/engine through its exports entry', () => {
    expect(packageName).toBe('@ezdp/publisher');
    expect(dependsOn).toEqual(['@ezdp/engine']);
  });
});
