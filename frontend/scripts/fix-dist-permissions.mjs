import { chmod, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(process.cwd(), 'dist');

async function apply(path) {
  const info = await stat(path);
  if (info.isDirectory()) {
    await chmod(path, 0o755);
    const entries = await readdir(path);
    await Promise.all(entries.map((entry) => apply(join(path, entry))));
    return;
  }
  await chmod(path, 0o644);
}

try {
  await apply(root);
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    process.exit(0);
  }
  throw error;
}
