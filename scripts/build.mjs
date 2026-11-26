import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const root = new URL('../', import.meta.url);
const page = await readFile(new URL('index.html', root), 'utf8');
for (const match of page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
  new Script(match[1], { filename:'coach.inline.js' });
}
await mkdir(new URL('dist/', root), {recursive:true});
await writeFile(new URL('dist/index.html', root), page);
for (const file of ['manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png']) {
  await copyFile(new URL('public-assets/' + file, root), new URL('dist/' + file, root));
}
console.log('Built the speaking coach in dist/index.html.');
