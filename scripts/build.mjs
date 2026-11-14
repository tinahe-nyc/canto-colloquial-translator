import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const root = new URL('../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const [template, study] = await Promise.all([read('index.html'), read('src/study.js')]);
const marker = '<script src="./src/study.js"></script>';
if (!template.includes(marker) || /<\/script\s*>/i.test(study)) throw new Error('Study script could not be inlined.');
const page = template.replace(marker, () => '<script>\n' + study + '\n</script>');
for (const match of page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
  new Script(match[1], { filename:'coach.inline.js' });
}
await mkdir(new URL('dist/', root), {recursive:true});
await writeFile(new URL('dist/index.html', root), page);
for (const file of ['manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png']) {
  await copyFile(new URL('public-assets/' + file, root), new URL('dist/' + file, root));
}
console.log('Built the speaking coach in dist/index.html.');
