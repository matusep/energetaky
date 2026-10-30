import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Jednoduchý lokálny server na prezretie dist/ – len na tvojom počítači, na internete stránku hostuje GitHub Pages.
const dist = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml' };

http
  .createServer((req, res) => {
    let file = path.normalize(path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!file.startsWith(dist)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(404, { 'content-type': TYPES['.html'] });
      return res.end(fs.readFileSync(path.join(dist, '404.html')));
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  })
  .listen(3000, () => console.log('Náhľad stránky: http://localhost:3000'));
