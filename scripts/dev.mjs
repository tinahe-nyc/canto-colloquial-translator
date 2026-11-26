import http from 'node:http';
import { readFile } from 'node:fs/promises';
import translate from '../api/translate.js';
import speak from '../api/speak.js';

const root = new URL('../', import.meta.url);
const built = process.argv.includes('--production');
const port = Number(process.env.PORT || 3000);
const routes = { '/api/translate': translate, '/api/speak': speak };
const assets = {'/': [built ? 'dist/index.html':'index.html','text/html'], '/index.html':[built ? 'dist/index.html':'index.html','text/html']};
if (!built) assets['/src/study.js'] = ['src/study.js','text/javascript'];
for (const name of ['manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png','kapok-flower.png']) {
  assets['/' + name] = [(built ? 'dist/' : 'public-assets/') + name,
    name.endsWith('.png') ? 'image/png' : 'application/manifest+json'];
}
http.createServer(async (req,res) => {
  try {
    const path = new URL(req.url,'http://localhost').pathname;
    const asset = Object.hasOwn(assets,path) && assets[path];
    if (req.method === 'GET' && asset) {
      res.setHeader('Content-Type',asset[1]+'; charset=utf-8');
      return res.end(await readFile(new URL(asset[0],root)));
    }
    const route = Object.hasOwn(routes,path) && routes[path];
    if (!route) {res.writeHead(404); return res.end();}
    res.status = n => {res.statusCode=n; return res;};
    res.json = obj => {res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(obj)); return res;};
    res.send = data => {res.end(data); return res;};
    if (req.method==='POST') {
      const chunks=[]; let size=0;
      for await (const chunk of req) {
        size+=chunk.length; if(size>96*1024) return res.status(413).json({error:'Request is too large.'});
        chunks.push(chunk);
      }
      try {req.body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}
      catch {return res.status(400).json({error:'Send a JSON object.'});}
    }
    await route(req,res);
  } catch {
    if (!res.headersSent) res.writeHead(500);
    res.end('Request could not be completed.');
  }
}).listen(port,'127.0.0.1',()=>console.log('Speaking coach: http://127.0.0.1:'+port));
