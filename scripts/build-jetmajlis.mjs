import { copyFile, mkdir, readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('dist-jetmajlis/', root);
const assetFolder = 'assets/merch/';
const html = await readFile(new URL('index.html', root), 'utf8');

const assets = new Set(
  Array.from(html.matchAll(/(?:src|href)="\/(assets\/merch\/[\w.-]+)"/g), ([, path]) => path),
);
if (!assets.size) throw new Error('No merchandise assets found in index.html');

await mkdir(new URL(assetFolder, output), { recursive: true });
for (const path of ['index.html', '_headers', ...assets]) {
  await copyFile(new URL(path, root), new URL(path, output));
}

const expected = new Set([...assets].map((path) => path.slice(assetFolder.length)));
for (const file of await readdir(new URL(assetFolder, output))) {
  if (!expected.has(file)) throw new Error(`Unexpected build asset: ${file}. Use a clean output directory.`);
}
