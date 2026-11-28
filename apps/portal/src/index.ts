// Placeholder for the M1 scaffold. The Next.js renderer and its `export` script are ADR 0006, step 6.
import { packageName as enginePackageName } from '@ezdp/engine';
import { packageName as themePackageName } from '@ezdp/theme';

export const packageName = '@ezdp/portal';
export const dependsOn: readonly string[] = [enginePackageName, themePackageName];
