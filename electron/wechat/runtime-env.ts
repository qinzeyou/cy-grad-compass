import { join } from 'node:path';

export function prepareWcdbRuntimeEnv(): void {
  if (process.platform !== 'win32') return;

  const resourceRoot = process.env.VITE_DEV_SERVER_URL
    ? join(process.cwd(), 'resources')
    : join(process.resourcesPath, 'resources');
  const paths = [
    join(resourceRoot, 'wcdb', 'win32', 'x64'),
    join(resourceRoot, 'runtime', 'win32'),
    resourceRoot,
    process.env.PATH || process.env.Path || '',
  ].filter(Boolean);
  const nextPath = paths.join(';');
  process.env.PATH = nextPath;
  process.env.Path = nextPath;
}
