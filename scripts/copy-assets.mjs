import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const src = path.join(root, 'src', 'proto', 'descriptors.bin');
const dest = path.join(root, 'build', 'src', 'proto', 'descriptors.bin');

await fs.mkdir(path.dirname(dest), { recursive: true });
await fs.copyFile(src, dest);
console.log(`copied descriptors.bin -> ${path.relative(root, dest)}`);
