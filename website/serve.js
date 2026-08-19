const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = parseInt(process.env.PORT || '8080', 10);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

http
  .createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const f = path.join(root, p);
    if (!f.startsWith(root)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    fs.readFile(f, (e, d) => {
      if (e) {
        res.writeHead(404);
        return res.end('404 - Not Found');
      }
      res.writeHead(200, {
        'Content-Type':
          types[path.extname(f).toLowerCase()] || 'application/octet-stream',
      });
      res.end(d);
    });
  })
  .listen(port, '0.0.0.0', () =>
    console.log(`Maurya site running at http://localhost:${port}`)
  );