import { copyFile, cp, mkdir, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('dist-jetmajlis/', root);
const directory = 'assets/campaign/';
const required = ['campaign.css', 'campaign.js', 'display.woff2', 'arabic.woff2',
  'jet-apron.webp', 'jet-boarding.webp', 'jet-cabin.webp',
  ...['uae', 'saudi', 'bahrain', 'qatar', 'kuwait', 'oman'].flatMap(country =>
    ['front', 'detail', 'back']
      .map(view => `${country}-hoodie-${view}.webp`))];

for (const file of required) {
  if (!(await stat(new URL(directory + file, root))).isFile()) throw new Error(`Missing asset ${file}`);
}

await mkdir(new URL(directory, output), { recursive: true });
for (const file of ['index.html', '_headers']) {
  await copyFile(new URL(file, root), new URL(file, output));
}
await cp(new URL(directory, root), new URL(directory, output), { recursive: true });
