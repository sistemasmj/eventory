import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const buildApp = require('../src/app');
const { Event, GalleryImage } = require('../src/models');

describe('Custom Album & Gallery Category Filtering and Order Tests', () => {
  let app;
  let testEvent;
  let testImage1;
  let testImage2;
  let testImage3;

  beforeAll(async () => {
    app = await buildApp();

    testEvent = await Event.create({
      nombre_cliente: 'Evento Prueba Filtros Categoria',
      tipo_ceremonia: 1,
      lugar: 'Lima'
    });

    // Imagen 1: Categoría 1 (Álbum Personalizado)
    testImage1 = await GalleryImage.create({
      event_id: testEvent.id,
      nombre: 'img1.webp',
      nombre_original: 'foto1.jpg',
      ruta_raw: 'uploads/raw/img1.webp',
      ruta_thumb: 'uploads/thumbs/thumb_img1.webp',
      extension: 'webp',
      size: 1024,
      categoria_id: 1,
      orden: 1,
      estado: 'activo'
    });

    // Imagen 2: Categoría 1 (Álbum Personalizado)
    testImage2 = await GalleryImage.create({
      event_id: testEvent.id,
      nombre: 'img2.webp',
      nombre_original: 'foto2.jpg',
      ruta_raw: 'uploads/raw/img2.webp',
      ruta_thumb: 'uploads/thumbs/thumb_img2.webp',
      extension: 'webp',
      size: 1024,
      categoria_id: 1,
      orden: 2,
      estado: 'activo'
    });

    // Imagen 3: Categoría 2 (Galería de Fotos)
    testImage3 = await GalleryImage.create({
      event_id: testEvent.id,
      nombre: 'img3.webp',
      nombre_original: 'foto3.jpg',
      ruta_raw: 'uploads/raw/img3.webp',
      ruta_thumb: 'uploads/thumbs/thumb_img3.webp',
      extension: 'webp',
      size: 1024,
      categoria_id: 2,
      orden: 1,
      estado: 'activo'
    });
  });

  afterAll(async () => {
    if (testImage1) await testImage1.destroy({ force: true }).catch(() => {});
    if (testImage2) await testImage2.destroy({ force: true }).catch(() => {});
    if (testImage3) await testImage3.destroy({ force: true }).catch(() => {});
    if (testEvent) await testEvent.destroy({ force: true }).catch(() => {});
    if (app) await app.close();
  });

  it('1. GET /api/events/:eventId/gallery?categoria_id=1 - Debe listar solo imágenes de Categoría 1', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/events/${testEvent.id}/gallery?categoria_id=1`
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBe(2);
    expect(json.data.every(img => img.categoria_id === 1)).toBe(true);
  });

  it('2. GET /api/events/:eventId/gallery?categoria_id=2 - Debe listar solo imágenes de Categoría 2', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/events/${testEvent.id}/gallery?categoria_id=2`
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBe(1);
    expect(json.data[0].id).toBe(testImage3.id);
    expect(json.data[0].categoria_id).toBe(2);
  });

  it('3. PUT /api/events/:eventId/gallery/order - Debe actualizar el orden de las imágenes en bloque', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/events/${testEvent.id}/gallery/order`,
      payload: {
        items: [
          { id: testImage2.id, orden: 1 },
          { id: testImage1.id, orden: 2 }
        ]
      }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.updatedCount).toBe(2);

    // Verificar en BD
    await testImage1.reload();
    await testImage2.reload();
    expect(testImage2.orden).toBe(1);
    expect(testImage1.orden).toBe(2);
  });
});
