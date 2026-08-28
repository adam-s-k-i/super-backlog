// test/unit/run-api.test.ts
import { createServer, request, type Server } from 'node:http';
import { describe, expect, it } from 'vitest';

import { createRunApiHandler } from '../../src/dashboard/server.js';

function makeRequest(server: Server, path: string, method = 'GET', body?: string): Promise<{ status: number; body: string }> {
  const addr = server.address();
  const port = addr && typeof addr === 'object' ? addr.port : 0;
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method, headers: { 'content-type': 'application/json' } }, (res) => {
      let resBody = '';
      res.setEncoding('utf8');
      res.on('data', (c) => {
        resBody += c;
      });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: resBody }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

describe('/api/run', () => {
  it('rejects non-POST requests', async () => {
    const handler = createRunApiHandler(process.cwd());
    const server = createServer((req, res) => {
      void handler(req, res);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const res = await makeRequest(server, '/api/run', 'GET');
      expect(res.status).toBe(404);
    } finally {
      server.close();
    }
  });

  it('rejects invalid JSON', async () => {
    const handler = createRunApiHandler(process.cwd());
    const server = createServer((req, res) => {
      void handler(req, res);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const res = await makeRequest(server, '/api/run', 'POST', 'not-json');
      expect(res.status).toBe(400);
      expect(JSON.parse(res.body).error).toBe('invalid json');
    } finally {
      server.close();
    }
  });

  it('rejects unknown commands', async () => {
    const handler = createRunApiHandler(process.cwd());
    const server = createServer((req, res) => {
      void handler(req, res);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const res = await makeRequest(server, '/api/run', 'POST', JSON.stringify({ command: 'rm -rf /' }));
      expect(res.status).toBe(400);
      expect(JSON.parse(res.body).error).toBe('unknown command');
    } finally {
      server.close();
    }
  });

  it('returns 503 when backlog binary is not found', async () => {
    const handler = createRunApiHandler('/nonexistent-dir');
    const server = createServer((req, res) => {
      void handler(req, res);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const res = await makeRequest(server, '/api/run', 'POST', JSON.stringify({ command: 'browser' }));
      expect(res.status).toBe(503);
      expect(JSON.parse(res.body).error).toBe('backlog cli not found');
    } finally {
      server.close();
    }
  });

  it('accepts whitelisted browser command', async () => {
    const handler = createRunApiHandler(process.cwd());
    const server = createServer((req, res) => {
      void handler(req, res);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const res = await makeRequest(server, '/api/run', 'POST', JSON.stringify({ command: 'browser' }));
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body).ok).toBe(true);
    } finally {
      server.close();
    }
  });

  it('accepts whitelisted board command', async () => {
    const handler = createRunApiHandler(process.cwd());
    const server = createServer((req, res) => {
      void handler(req, res);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const res = await makeRequest(server, '/api/run', 'POST', JSON.stringify({ command: 'board' }));
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body).ok).toBe(true);
    } finally {
      server.close();
    }
  });
});

function makeRequestWithHeaders(
  server: Server,
  path: string,
  method = 'GET',
  body?: string,
): Promise<{ status: number; body: string; headers: Record<string, string | string[] | undefined> }> {
  const addr = server.address();
  const port = addr && typeof addr === 'object' ? addr.port : 0;
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method, headers: { 'content-type': 'application/json' } }, (res) => {
      let resBody = '';
      res.setEncoding('utf8');
      res.on('data', (c) => {
        resBody += c;
      });
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, body: resBody, headers: res.headers }),
      );
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

describe('/api/run CORS', () => {
  it('answers OPTIONS preflight with allow-origin so static pages can call it', async () => {
    const handler = createRunApiHandler(process.cwd());
    const server = createServer((req, res) => {
      void handler(req, res);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const res = await makeRequestWithHeaders(server, '/api/run', 'OPTIONS');
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('*');
      expect(String(res.headers['access-control-allow-methods'] ?? '')).toContain('POST');
    } finally {
      server.close();
    }
  });

  it('sends access-control-allow-origin on POST responses', async () => {
    const handler = createRunApiHandler(process.cwd());
    const server = createServer((req, res) => {
      void handler(req, res);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const res = await makeRequestWithHeaders(server, '/api/run', 'POST', JSON.stringify({ command: 'browser' }));
      expect(res.headers['access-control-allow-origin']).toBe('*');
    } finally {
      server.close();
    }
  });
});
