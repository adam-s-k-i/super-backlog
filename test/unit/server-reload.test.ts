// test/unit/server-reload.test.ts
import { createServer, request, type Server } from 'node:http';
import { describe, expect, it, vi } from 'vitest';

import { createDebouncedReloader, createReloadBroker } from '../../src/dashboard/server.js';

async function untilTrue(deadlineMs: number, probe: () => boolean): Promise<boolean> {
  const deadline = Date.now() + deadlineMs;
  for (;;) {
    if (probe()) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, 20));
  }
}

interface SseClient {
  status: number;
  contentType: string;
  chunks: string[];
  done: Promise<void>;
  close(): void;
}

function connectSse(server: Server, path = '/api/events', method = 'GET'): Promise<SseClient> {
  const addr = server.address();
  const port = addr && typeof addr === 'object' ? addr.port : 0;
  return new Promise((resolvePromise, rejectPromise) => {
    const req = request({ host: '127.0.0.1', port, path, method }, (res) => {
      const chunks: string[] = [];
      res.setEncoding('utf8');
      res.on('data', (c: string) => chunks.push(c));
      const done = new Promise<void>((resolveDone) => res.on('end', () => resolveDone()));
      resolvePromise({
        status: res.statusCode ?? 0,
        contentType: String(res.headers['content-type'] ?? ''),
        chunks,
        done,
        close: () => req.destroy(),
      });
    });
    req.on('error', rejectPromise);
    req.end();
  });
}

async function withBrokerServer(
  broker: ReturnType<typeof createReloadBroker>,
  fn: (server: Server) => Promise<void>,
): Promise<void> {
  const server = createServer((req, res) => {
    if (!broker.handler(req, res)) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  try {
    await fn(server);
  } finally {
    broker.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}

describe('createReloadBroker', () => {
  it('serves an SSE stream on GET /api/events and greets the client', async () => {
    const broker = createReloadBroker();
    await withBrokerServer(broker, async (server) => {
      const client = await connectSse(server);
      expect(client.status).toBe(200);
      expect(client.contentType).toContain('text/event-stream');
      await untilTrue(1000, () => client.chunks.join('').includes(':'));
      expect(broker.clientCount()).toBe(1);
      client.close();
    });
  });

  it('does not handle other paths or methods', async () => {
    const broker = createReloadBroker();
    await withBrokerServer(broker, async (server) => {
      const wrongPath = await connectSse(server, '/api/other');
      await wrongPath.done;
      expect(wrongPath.status).toBe(404);
      const wrongMethod = await connectSse(server, '/api/events', 'POST');
      await wrongMethod.done;
      expect(wrongMethod.status).toBe(404);
      expect(broker.clientCount()).toBe(0);
    });
  });

  it('broadcasts a named event with a data line to all connected clients', async () => {
    const broker = createReloadBroker();
    await withBrokerServer(broker, async (server) => {
      const a = await connectSse(server);
      const b = await connectSse(server);
      expect(broker.clientCount()).toBe(2);

      broker.broadcast('reload');

      for (const client of [a, b]) {
        await untilTrue(1000, () => client.chunks.join('').includes('event: reload'));
        const body = client.chunks.join('');
        expect(body).toContain('event: reload');
        // without a data line EventSource would never dispatch the event in browsers
        expect(body).toMatch(/event: reload\ndata: /);
      }
      a.close();
      b.close();
    });
  });

  it('removes clients when they disconnect', async () => {
    const broker = createReloadBroker();
    await withBrokerServer(broker, async (server) => {
      const client = await connectSse(server);
      expect(broker.clientCount()).toBe(1);
      client.close();
      await untilTrue(1000, () => broker.clientCount() === 0);
      expect(broker.clientCount()).toBe(0);
    });
  });

  it('close() ends all client connections and broadcast becomes a no-op', async () => {
    const broker = createReloadBroker();
    const server = createServer((req, res) => {
      if (!broker.handler(req, res)) {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const client = await connectSse(server);
    expect(broker.clientCount()).toBe(1);

    broker.close();
    await client.done; // stream ended by broker.close()
    expect(broker.clientCount()).toBe(0);
    broker.broadcast('reload'); // must not throw after close
    await new Promise<void>((r) => server.close(() => r()));
  });
});

describe('createDebouncedReloader', () => {
  it('runs regenerate once after the delay and reports success', async () => {
    const regenerate = vi.fn(async () => {});
    const onReload = vi.fn();
    const reloader = createDebouncedReloader(regenerate, onReload, 30);

    reloader.trigger();
    expect(regenerate).not.toHaveBeenCalled();

    await untilTrue(500, () => onReload.mock.calls.length > 0);
    expect(regenerate).toHaveBeenCalledTimes(1);
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('debounces rapid triggers into a single regeneration', async () => {
    const regenerate = vi.fn(async () => {});
    const onReload = vi.fn();
    const reloader = createDebouncedReloader(regenerate, onReload, 50);

    reloader.trigger();
    reloader.trigger();
    reloader.trigger();

    await untilTrue(500, () => onReload.mock.calls.length > 0);
    await new Promise((r) => setTimeout(r, 80));
    expect(regenerate).toHaveBeenCalledTimes(1);
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('swallows regeneration failures and does not report a reload', async () => {
    const regenerate = vi.fn(async () => {
      throw new Error('boom');
    });
    const onReload = vi.fn();
    const reloader = createDebouncedReloader(regenerate, onReload, 30);

    reloader.trigger();
    await untilTrue(500, () => regenerate.mock.calls.length > 0);
    await new Promise((r) => setTimeout(r, 60));
    expect(onReload).not.toHaveBeenCalled();
  });

  it('cancel() prevents a pending regeneration', async () => {
    const regenerate = vi.fn(async () => {});
    const onReload = vi.fn();
    const reloader = createDebouncedReloader(regenerate, onReload, 40);

    reloader.trigger();
    reloader.cancel();
    await new Promise((r) => setTimeout(r, 80));
    expect(regenerate).not.toHaveBeenCalled();
    expect(onReload).not.toHaveBeenCalled();
  });

  it('does nothing when no regenerate callback is configured', async () => {
    const onReload = vi.fn();
    const reloader = createDebouncedReloader(undefined, onReload, 10);
    reloader.trigger();
    await new Promise((r) => setTimeout(r, 40));
    expect(onReload).not.toHaveBeenCalled();
  });
});
