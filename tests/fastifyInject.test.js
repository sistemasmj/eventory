import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import buildApp from '../src/app';
import { Imagen } from '../src/models';

// Top-level mock para testConnection
vi.mock('../src/config/database', async () => {
  const actual = await vi.importActual('../src/config/database');
  return {
    ...actual,
    testConnection: vi.fn().mockResolvedValue(true)
  };
});

describe('Fastify Inject Integration Tests (Rutas de Imágenes y X-Accel-Redirect)', () => {
  let app;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /api/media/25/1756772985123-a83f21c7/thumb -> 200 con cabecera X-Accel-Redirect y cache', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/media/25/1756772985123-a83f21c7/thumb'
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-accel-redirect']).toBe('/protected/empresa-25/1756772985123-a83f21c7/thumb.webp');
    expect(response.headers['content-type']).toBe('image/webp');
    expect(response.headers['cache-control']).toBe('private, max-age=31536000, immutable');
    expect(response.payload).toBe('');
  });

  it('GET /api/media/25/1756772985123-a83f21c7/preview -> 200 con preview.webp', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/media/25/1756772985123-a83f21c7/preview'
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-accel-redirect']).toBe('/protected/empresa-25/1756772985123-a83f21c7/preview.webp');
    expect(response.headers['content-type']).toBe('image/webp');
  });

  it('GET /api/media/25/1756772985123-a83f21c7/original -> 200 con original.jpg', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/media/25/1756772985123-a83f21c7/original'
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-accel-redirect']).toBe('/protected/empresa-25/1756772985123-a83f21c7/original.jpg');
    expect(response.headers['content-type']).toBe('image/jpeg');
  });

  it('GET /api/media/25/1756772985123-a83f21c7/tipo_invalido -> 400 Bad Request', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/media/25/1756772985123-a83f21c7/tipo_invalido'
    });

    expect(response.statusCode).toBe(400);
    const json = JSON.parse(response.payload);
    expect(json.success).toBe(false);
  });

  it('GET /api/empresas/25/imagenes -> 200 con lista formateada y no-cache headers', async () => {
    vi.spyOn(Imagen, 'findAll').mockResolvedValueOnce([
      {
        id: 100,
        image_token: '1756772985123-a83f21c7',
        orden: 1,
        width: 1200,
        height: 800,
        size: 150000
      }
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/empresas/25/imagenes'
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');

    const json = JSON.parse(response.payload);
    expect(json.total).toBe(1);
    expect(json.items[0].id).toBe(100);
    expect(json.items[0].token).toBe('1756772985123-a83f21c7');
    expect(json.items[0].type).toBe('image');
    expect(json.items[0].urls).toEqual({
      thumb: '/api/media/25/1756772985123-a83f21c7/thumb',
      preview: '/api/media/25/1756772985123-a83f21c7/preview',
      original: '/api/media/25/1756772985123-a83f21c7/original'
    });
  });

  it('GET /api/media/25/1756772985123-a83f21c7/poster -> 200 con poster.webp', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/media/25/1756772985123-a83f21c7/poster'
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-accel-redirect']).toBe('/protected/empresa-25/1756772985123-a83f21c7/poster.webp');
    expect(response.headers['content-type']).toBe('image/webp');
  });

  it('GET /api/health -> 200 OK', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health'
    });

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.payload);
    expect(json.status).toBe('OK');
  });

  it('GET / -> 404 Not Found (no expone endpoints ni información privada)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/'
    });

    expect(response.statusCode).toBe(404);
  });
});
