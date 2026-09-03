import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import buildApp from '../src/app';
import { GalleryImage } from '../src/models';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { uploadRoot } from '../src/config/uploads';

vi.mock('../src/config/database', async () => {
  const actual = await vi.importActual('../src/config/database');
  return {
    ...actual,
    testConnection: vi.fn().mockResolvedValue(true)
  };
});

describe('Image Rotation API Tests (POST /api/images/:imageId/rotate)', () => {
  let app;
  const testImageId = 'test-rotate-image-uuid';
  const testRawRel = path.join('raw', 'test_rotate.webp');
  const testThumbRel = path.join('thumbs', 'thumb_test_rotate.webp');
  const rawPath = path.join(uploadRoot, testRawRel);
  const thumbPath = path.join(uploadRoot, testThumbRel);

  beforeAll(async () => {
    app = await buildApp();

    // Crear directorios y archivos de prueba sintéticos con Sharp
    await fs.mkdir(path.join(uploadRoot, 'raw'), { recursive: true });
    await fs.mkdir(path.join(uploadRoot, 'thumbs'), { recursive: true });

    // Imagen de 200x100 (horizontal para notar la rotación a 100x200)
    await sharp({
      create: {
        width: 200,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 }
      }
    }).webp().toFile(rawPath);

    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 }
      }
    }).webp().toFile(thumbPath);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await fs.unlink(rawPath).catch(() => {});
    await fs.unlink(thumbPath).catch(() => {});
  });

  it('POST /api/images/:imageId/rotate -> 404 si la imagen no existe', async () => {
    vi.spyOn(GalleryImage, 'findByPk').mockResolvedValueOnce(null);
    vi.spyOn(GalleryImage, 'findOne').mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'POST',
      url: '/api/images/non-existent-uuid/rotate',
      payload: { direction: 'right' }
    });

    expect(res.statusCode).toBe(404);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(false);
  });

  it('POST /api/images/:imageId/rotate -> 200 y rota la imagen a la derecha (+90°)', async () => {
    const mockImage = {
      id: testImageId,
      event_id: 1,
      nombre: 'test_rotate.webp',
      nombre_original: 'test_rotate.webp',
      tipo: 'image',
      ruta_raw: `uploads/${testRawRel.replace(/\\/g, '/')}`,
      ruta_thumb: `uploads/${testThumbRel.replace(/\\/g, '/')}`,
      width: 200,
      height: 100,
      size: 1024,
      metadata: {},
      changed: vi.fn(),
      save: vi.fn().mockResolvedValue(true),
      toJSON: function() {
        return {
          id: this.id,
          event_id: this.event_id,
          width: this.width,
          height: this.height,
          size: this.size,
          metadata: this.metadata
        };
      }
    };

    vi.spyOn(GalleryImage, 'findByPk').mockResolvedValueOnce(mockImage);

    const res = await app.inject({
      method: 'POST',
      url: `/api/images/${testImageId}/rotate`,
      payload: { direction: 'right' }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.message).toContain('derecha');
    expect(mockImage.version).toBe(2);
    expect(mockImage.metadata.v).toBe(2);

    // Verificar que el archivo rotado ahora tiene width 100 y height 200
    const rawBuf = await fs.readFile(rawPath);
    const meta = await sharp(rawBuf).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(200);
  });

  it('POST /api/images/:imageId/rotate -> 200 y rota la imagen a la izquierda (-90°)', async () => {
    const mockImage = {
      id: testImageId,
      event_id: 1,
      nombre: 'test_rotate.webp',
      nombre_original: 'test_rotate.webp',
      tipo: 'image',
      ruta_raw: `uploads/${testRawRel.replace(/\\/g, '/')}`,
      ruta_thumb: `uploads/${testThumbRel.replace(/\\/g, '/')}`,
      width: 100,
      height: 200,
      size: 1024,
      version: 2,
      metadata: { v: 2 },
      changed: vi.fn(),
      save: vi.fn().mockResolvedValue(true),
      toJSON: function() {
        return {
          id: this.id,
          event_id: this.event_id,
          width: this.width,
          height: this.height,
          size: this.size,
          version: this.version,
          metadata: this.metadata
        };
      }
    };

    vi.spyOn(GalleryImage, 'findByPk').mockResolvedValueOnce(mockImage);

    const res = await app.inject({
      method: 'POST',
      url: `/api/images/${testImageId}/rotate`,
      payload: { direction: 'left' }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.message).toContain('izquierda');
    expect(mockImage.version).toBe(3);
    expect(mockImage.metadata.v).toBe(3);

    // Vuelve a quedar 200x100
    const rawBuf = await fs.readFile(rawPath);
    const meta = await sharp(rawBuf).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(100);
  });

  it('GET /api/events/:id/gallery -> Genera URLs con query param ?v=version y no afecta imágenes no modificadas', async () => {
    const mockImagesList = [
      {
        id: 'img-1-uuid',
        nombre: 'img1.webp',
        nombre_original: 'img1.jpg',
        tipo: 'image',
        duracion: null,
        ruta_raw: 'uploads/raw/img1.webp',
        ruta_thumb: 'uploads/thumbs/thumb_img1.webp',
        ruta_poster: null,
        extension: 'webp',
        width: 1920,
        height: 1080,
        size: 50000,
        orden: 1,
        categoria_id: 1,
        version: 3,
        fecha_subida: new Date(),
        metadata: { v: 3 }
      },
      {
        id: 'img-2-uuid',
        nombre: 'img2.webp',
        nombre_original: 'img2.jpg',
        tipo: 'image',
        duracion: null,
        ruta_raw: 'uploads/raw/img2.webp',
        ruta_thumb: 'uploads/thumbs/thumb_img2.webp',
        ruta_poster: null,
        extension: 'webp',
        width: 1920,
        height: 1080,
        size: 60000,
        orden: 2,
        categoria_id: 1,
        version: 1,
        fecha_subida: new Date(),
        metadata: { v: 1 }
      }
    ];

    vi.spyOn(GalleryImage, 'findAll').mockResolvedValueOnce(mockImagesList);

    const res = await app.inject({
      method: 'GET',
      url: '/api/events/99/gallery?categoria_id=1'
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.data.length).toBe(2);

    // Primera imagen modificada (v=3)
    expect(json.data[0].version).toBe(3);
    expect(json.data[0].urlRaw).toContain('?v=3');
    expect(json.data[0].urlThumb).toContain('?v=3');
    expect(json.data[0].urls.thumb).toContain('?v=3');
    expect(json.data[0].urls.original).toContain('?v=3');

    // Segunda imagen intacta (v=1)
    expect(json.data[1].version).toBe(1);
    expect(json.data[1].urlRaw).toContain('?v=1');
    expect(json.data[1].urlThumb).toContain('?v=1');
  });
});
