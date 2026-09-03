import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const buildApp = require('../src/app');
const { Song, Event } = require('../src/models');
const path = require('path');
const fs = require('fs').promises;

describe('Songs API & Events Association Integration Tests', () => {
  let app;
  let createdSongId;
  let createdEventId;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    if (createdEventId) {
      await Event.destroy({ where: { id: createdEventId }, force: true }).catch(() => {});
    }
    if (createdSongId) {
      await Song.destroy({ where: { id: createdSongId }, force: true }).catch(() => {});
    }
    if (app) {
      await app.close();
    }
  });

  it('1. GET /api/songs - Debe retornar lista de canciones con formato adecuado', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/songs'
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('2. POST /api/songs - Debe permitir subir una canción y registrarla en BD', async () => {
    const fakeAudioBuffer = Buffer.from('ID3fakeaudiocontentforintegrationtesting1234567890');
    
    const res = await app.inject({
      method: 'POST',
      url: '/api/songs',
      headers: {
        'content-type': 'application/json'
      },
      payload: {
        nombre: 'A Thousand Years - Christina Perri',
        filename: 'thousand_years.mp3',
        mimetype: 'audio/mpeg',
        fileBase64: fakeAudioBuffer.toString('base64')
      }
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
    expect(json.data.nombre).toBe('A Thousand Years - Christina Perri');
    expect(json.data.mimeType).toBe('audio/mpeg');
    expect(json.data.size).toBeGreaterThan(0);
    expect(json.data.url).toBeDefined();
    expect(json.data.streamUrl).toContain('/api/songs/');

    createdSongId = json.data.id;
  });

  it('2b. POST /api/songs - Debe soportar subida multipart/form-data con boundary', async () => {
    const boundary = '----WebKitFormBoundaryTest123456';
    const fakeAudioContent = 'ID3fakeaudiomultiparttesting12345';
    
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="nombre"',
      '',
      'Cancion de Prueba Multipart',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test_cancion.mp3"',
      'Content-Type: audio/mpeg',
      '',
      fakeAudioContent,
      `--${boundary}--`,
      ''
    ].join('\r\n');

    const res = await app.inject({
      method: 'POST',
      url: '/api/songs',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload: body
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.data.nombre).toBe('Cancion de Prueba Multipart');

    // Limpieza
    await Song.destroy({ where: { id: json.data.id }, force: true }).catch(() => {});
  });

  it('3. GET /api/songs/:id - Debe obtener los detalles de la canción recién subida', async () => {
    expect(createdSongId).toBeDefined();

    const res = await app.inject({
      method: 'GET',
      url: `/api/songs/${createdSongId}`
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe(createdSongId);
    expect(json.data.nombre).toBe('A Thousand Years - Christina Perri');
  });

  it('4. PUT /api/songs/:id - Debe permitir actualizar el nombre de la canción', async () => {
    expect(createdSongId).toBeDefined();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/songs/${createdSongId}`,
      headers: {
        'content-type': 'application/json'
      },
      payload: {
        nombre: 'A Thousand Years (Acoustic Version)'
      }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.data.nombre).toBe('A Thousand Years (Acoustic Version)');
  });

  it('5. GET /api/songs/:id/stream - Debe soportar streaming de audio con 206 Partial Content', async () => {
    expect(createdSongId).toBeDefined();

    const res = await app.inject({
      method: 'GET',
      url: `/api/songs/${createdSongId}/stream`,
      headers: {
        Range: 'bytes=0-15'
      }
    });

    expect([200, 206]).toContain(res.statusCode);
    if (res.statusCode === 206) {
      expect(res.headers['content-range']).toBeDefined();
      expect(res.headers['accept-ranges']).toBe('bytes');
    }
  });

  it('6. POST /api/events y GET /api/events/:id - Debe guardar cancion_id y retornar objeto cancion', async () => {
    expect(createdSongId).toBeDefined();

    const eventPayload = {
      tipo_ceremonia: 1,
      nombre_cliente: 'Jose & Liliana',
      fecha_evento: '2026-11-15',
      cancion_id: createdSongId,
      notas: 'Evento con música asignada'
    };

    const resCreate = await app.inject({
      method: 'POST',
      url: '/api/events',
      headers: {
        'content-type': 'application/json'
      },
      payload: eventPayload
    });

    expect(resCreate.statusCode).toBe(201);
    const jsonCreate = JSON.parse(resCreate.payload);
    expect(jsonCreate.success).toBe(true);
    expect(jsonCreate.data.cancion_id).toBe(createdSongId);

    createdEventId = jsonCreate.data.id;

    // Verificar en GET /api/events/:id
    const resGet = await app.inject({
      method: 'GET',
      url: `/api/events/${createdEventId}`
    });

    expect(resGet.statusCode).toBe(200);
    const jsonGet = JSON.parse(resGet.payload);
    expect(jsonGet.success).toBe(true);
    expect(jsonGet.data.cancion_id).toBe(createdSongId);
    expect(jsonGet.data.cancion).toBeDefined();
    expect(jsonGet.data.cancion.id).toBe(createdSongId);
    expect(jsonGet.data.cancion.nombre).toBe('A Thousand Years (Acoustic Version)');
    expect(jsonGet.data.cancion.url).toBeDefined();
  });

  it('7. DELETE /api/songs/:id - Debe eliminar la canción y desvincularla del evento', async () => {
    expect(createdSongId).toBeDefined();

    const resDelete = await app.inject({
      method: 'DELETE',
      url: `/api/songs/${createdSongId}`
    });

    expect(resDelete.statusCode).toBe(200);
    const jsonDelete = JSON.parse(resDelete.payload);
    expect(jsonDelete.success).toBe(true);

    // El evento ahora debe tener cancion_id como null
    const resEvent = await app.inject({
      method: 'GET',
      url: `/api/events/${createdEventId}`
    });

    const jsonEvent = JSON.parse(resEvent.payload);
    expect(jsonEvent.data.cancion_id).toBeNull();
  });
});
