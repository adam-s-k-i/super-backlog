// test/integration/dashboard-api.test.ts
import { describe, it, expect } from 'vitest';
import { createServer, request, type Server } from 'node:http';
import { createModelApiHandler } from '../../src/models/dashboard-api.js';

function makeRequest(server: Server, path: string, method = 'GET'): Promise<{ status: number; body: string }> {
  const addr = server.address();
  const port = addr && typeof addr === 'object' ? addr.port : 0;
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => {
        body += c;
      });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('/api/models', () => {
  it('returns the current config', async () => {
    const handler = createModelApiHandler(process.cwd());
    const server = createServer((req, res) => {
      void handler(req, res);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const res = await makeRequest(server, '/api/models');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body).config).toHaveProperty('enabled');
    } finally {
      server.close();
    }
  });
});
