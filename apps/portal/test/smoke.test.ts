import { describe, expect, it } from 'vitest';
import { dependsOn, packageName } from '../src/index.js';

describe('@ezdp/portal scaffold', () => {
  it('exports its placeholder and resolves engine and theme through their exports entries', () => {
    expect(packageName).toBe('@ezdp/portal');
    expect(dependsOn).toEqual(['@ezdp/engine', '@ezdp/theme']);
  });
});
