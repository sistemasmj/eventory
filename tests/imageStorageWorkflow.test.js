import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { uploadRoot } from '../src/config/uploads';
import FileService from '../src/modules/files/files.service';
import { GalleryImage, Event } from '../src/models';

import buildApp from '../src/app';

vi.mock('../src/config/database', async () => {
  const actual = await vi.importActual('../src/config/database');
  return {
    ...actual,
    testConnection: vi.fn().mockResolvedValue(true)
  };
});

describe('3-Tier Image Storage Workflow (raw, temp, thumbs)', () => {
  let app;
  let testEvent;
  let testEventId;
  let testJpgBuffer;
  const createdFiles = [];
  let createdImageRecord = null;

  beforeAll(async () => {
    app = await buildApp();

    testEvent = await Event.create({
      nombre: 'Evento Test Workflow 3 Niveles',
      fecha: '2026-09-03',
      estado: 'activo'
    });
    testEventId = testEvent.id;

    // Generar buffer JPG sintético de alta resolución (800x600)
    testJpgBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 50, g: 120, b: 200 }
      }
    }).jpeg({ quality: 95 }).toBuffer();
  });

  afterAll(async () => {
    if (testEvent) {
      await GalleryImage.destroy({ where: { event_id: testEventId }, force: true }).catch(() => {});
      await testEvent.destroy({ force: true }).catch(() => {});
    }
    if (app) {
      await app.close();
    }
    for (const file of createdFiles) {
      await fs.unlink(file).catch(() => {});
    }
  });

  it('1. processSingleImage debe guardar archivo original intacto en raw/, preview WebP en temp/ y miniatura WebP en thumbs/', async () => {
    const fakeFile = {
      filename: 'foto_boda_original.jpg',
      buffer: testJpgBuffer,
      data: testJpgBuffer,
      size: testJpgBuffer.length
    };

    const imageResult = await FileService.processSingleImage(testEventId, fakeFile, {
      categoria_id: 2
    });

    expect(imageResult).toBeDefined();
    expect(imageResult.id).toBeDefined();
    expect(imageResult.extension).toBe('jpg');
    expect(imageResult.ruta_raw).toMatch(/uploads\/raw\/[a-f0-9-]+\.jpg/);
    expect(imageResult.ruta_temp).toMatch(/uploads\/temp\/[a-f0-9-]+\.webp/);
    expect(imageResult.ruta_thumb).toMatch(/uploads\/thumbs\/thumb_[a-f0-9-]+\.webp/);

    createdImageRecord = imageResult;

    const absRawPath = path.join(uploadRoot, imageResult.ruta_raw.replace(/^uploads[\\/]/, ''));
    const absTempPath = path.join(uploadRoot, imageResult.ruta_temp.replace(/^uploads[\\/]/, ''));
    const absThumbPath = path.join(uploadRoot, imageResult.ruta_thumb.replace(/^uploads[\\/]/, ''));

    createdFiles.push(absRawPath, absTempPath, absThumbPath);

    // Validar existencia de los 3 archivos físicos
    const rawExists = await fs.stat(absRawPath);
    const tempExists = await fs.stat(absTempPath);
    const thumbExists = await fs.stat(absThumbPath);

    expect(rawExists.size).toBe(testJpgBuffer.length); // Mismo tamaño exacto del buffer original
    expect(tempExists.size).toBeGreaterThan(0);
    expect(thumbExists.size).toBeGreaterThan(0);

    // Validar formato del archivo en raw (debe ser jpeg)
    const rawMeta = await sharp(absRawPath).metadata();
    expect(rawMeta.format).toBe('jpeg');
    expect(rawMeta.width).toBe(800);
    expect(rawMeta.height).toBe(600);

    // Validar formato del archivo en temp (debe ser webp)
    const tempMeta = await sharp(absTempPath).metadata();
    expect(tempMeta.format).toBe('webp');

    // Validar formato y dimensiones del thumbnail (300x300 cover webp)
    const thumbMeta = await sharp(absThumbPath).metadata();
    expect(thumbMeta.format).toBe('webp');
    expect(thumbMeta.width).toBe(300);
    expect(thumbMeta.height).toBe(300);
  });

  it('2. getGallery debe retornar URLs diferenciadas para raw (original), temp (preview) y thumbs', async () => {
    vi.spyOn(GalleryImage, 'findAll').mockResolvedValueOnce([
      {
        id: createdImageRecord.id,
        nombre: createdImageRecord.nombre,
        nombre_original: createdImageRecord.nombre_original,
        tipo: 'image',
        duracion: null,
        ruta_raw: createdImageRecord.ruta_raw,
        ruta_temp: createdImageRecord.ruta_temp,
        ruta_thumb: createdImageRecord.ruta_thumb,
        ruta_poster: null,
        extension: 'jpg',
        width: 800,
        height: 600,
        size: testJpgBuffer.length,
        orden: 0,
        categoria_id: 2,
        version: 1,
        fecha_subida: new Date(),
        metadata: createdImageRecord.metadata
      }
    ]);

    const gallery = await FileService.getGallery(testEventId);
    expect(gallery.length).toBe(1);

    const item = gallery[0];
    expect(item.urlRaw).toContain('/api/uploads/raw/');
    expect(item.urlTemp).toContain('/api/uploads/temp/');
    expect(item.urlPreview).toContain('/api/uploads/temp/');
    expect(item.urlThumb).toContain('/api/uploads/thumbs/');

    expect(item.urls.original).toContain('/api/uploads/raw/');
    expect(item.urls.preview).toContain('/api/uploads/temp/');
    expect(item.urls.temp).toContain('/api/uploads/temp/');
    expect(item.urls.thumb).toContain('/api/uploads/thumbs/');
  });

  it('3. Hook beforeDestroy de GalleryImage debe eliminar los 3 archivos físicos (raw, temp, thumbs)', async () => {
    const rawP = path.join(uploadRoot, 'raw', 'test_delete_orig.jpg');
    const tempP = path.join(uploadRoot, 'temp', 'test_delete_temp.webp');
    const thumbP = path.join(uploadRoot, 'thumbs', 'thumb_test_delete.webp');

    await fs.writeFile(rawP, Buffer.from('test-orig'));
    await fs.writeFile(tempP, Buffer.from('test-temp'));
    await fs.writeFile(thumbP, Buffer.from('test-thumb'));

    const mockImg = await GalleryImage.create({
      event_id: testEventId,
      nombre: 'test_delete_orig.jpg',
      nombre_original: 'test_delete_orig.jpg',
      ruta_raw: 'uploads/raw/test_delete_orig.jpg',
      ruta_temp: 'uploads/temp/test_delete_temp.webp',
      ruta_thumb: 'uploads/thumbs/thumb_test_delete.webp',
      extension: 'jpg',
      size: 9
    });

    await mockImg.destroy({ force: true });

    // Verificar que ya no existen
    await expect(fs.access(rawP)).rejects.toThrow();
    await expect(fs.access(tempP)).rejects.toThrow();
    await expect(fs.access(thumbP)).rejects.toThrow();
  });
});
