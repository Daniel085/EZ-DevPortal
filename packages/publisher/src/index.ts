// Placeholder for the M1 scaffold. `ezdp build`, `doctor` and `fix` are ADR 0003, "The M1 command line".
import { packageName as enginePackageName } from '@ezdp/engine';

export const packageName = '@ezdp/publisher';
export const dependsOn: readonly string[] = [enginePackageName];
