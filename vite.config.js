import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// POST /api/save  { id, ... }  → characters/<id>.json  (el generador guarda la ficha editada)
const saveSpecs = () => ({
  name: 'save-specs',
  configureServer(server) {
    server.middlewares.use('/api/save', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const spec = JSON.parse(body);
          if (!/^[a-z0-9-]+$/.test(spec.id || '')) throw new Error('id inválido');
          const dir = path.resolve('characters', spec.draft ? 'drafts' : '');
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, spec.id + '.json'), JSON.stringify(spec, null, 2) + '\n');
          res.setHeader('content-type', 'application/json'); res.end('{"ok":true}');
        } catch (e) { res.statusCode = 400; res.end(String(e.message)); }
      });
    });
  },
});

export default defineConfig({
  plugins: [saveSpecs()],
  server: { port: 8118, strictPort: true, host: '127.0.0.1', watch: { ignored: ['**/characters/**', '**/shots/**'] } },
});
