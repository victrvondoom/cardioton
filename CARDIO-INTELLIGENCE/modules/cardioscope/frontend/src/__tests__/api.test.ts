import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api';
afterEach(() => vi.unstubAllGlobals());
it('preserves unavailable-manifest API error details', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: 'Anatomy not prepared' }), { status: 503 })));
  await expect(api.anatomy()).rejects.toThrow('Anatomy not prepared');
});
it('handles non-JSON proxy/server failures', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>bad gateway</html>', { status: 502 })));
  await expect(api.anatomy()).rejects.toThrow('API error 502');
});
it('propagates cancellation and passes its signal', async () => {
  const controller = new AbortController(); controller.abort();
  const fetcher = vi.fn(async (_path, options) => { options.signal.throwIfAborted(); });
  vi.stubGlobal('fetch', fetcher);
  await expect(api.anatomy(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetcher).toHaveBeenCalledWith('/api/anatomy', expect.objectContaining({ signal: controller.signal }));
});
