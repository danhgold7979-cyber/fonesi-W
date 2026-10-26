import { copyFileSync, mkdirSync } from 'node:fs';
const root = new URL('../packages/contracts/', import.meta.url);
mkdirSync(new URL('dist/generated/', root), { recursive: true });
for (const file of ['workflow-validator.js', 'workflow-validator.d.ts'])
  copyFileSync(new URL('src/generated/' + file, root), new URL('dist/generated/' + file, root));
