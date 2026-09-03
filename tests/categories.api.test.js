import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const buildApp = require('../src/app');
const { Category } = require('../src/models');

describe('Categories API Integration Tests (CRUD Categorías)', () => {
  let app;
  let createdCategoryId;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    if (createdCategoryId) {
      await Category.destroy({ where: { id: createdCategoryId } }).catch(() => {});
    }
    if (app) {
      await app.close();
    }
  });

  it('1. GET /api/categories - Debe retornar lista de categorías con formato estructurado', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/categories'
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
    expect(Array.isArray(json.data.items)).toBe(true);
    expect(typeof json.data.total).toBe('number');
  });

  it('2. POST /api/categories - Debe validar y rechazar si falta la descripción (400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/categories',
      payload: {
        descripcion: '   ',
        estado: 'S'
      }
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(false);
    expect(json.message).toContain('requerida');
  });

  it('3. POST /api/categories - Debe crear una categoría correctamente con estado S (201)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/categories',
      payload: {
        descripcion: 'Ceremonia Civil',
        estado: 'S'
      }
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.data.id).toBeDefined();
    expect(json.data.descripcion).toBe('Ceremonia Civil');
    expect(json.data.estado).toBe('S');

    createdCategoryId = json.data.id;
  });

  it('4. GET /api/categories/:id - Debe obtener la categoría recién creada', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/categories/${createdCategoryId}`
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe(createdCategoryId);
    expect(json.data.descripcion).toBe('Ceremonia Civil');
    expect(json.data.estado).toBe('S');
  });

  it('5. PUT /api/categories/:id - Debe actualizar la descripción y estado de la categoría', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/categories/${createdCategoryId}`,
      payload: {
        descripcion: 'Ceremonia Civil & Religiosa',
        estado: 'N'
      }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.data.descripcion).toBe('Ceremonia Civil & Religiosa');
    expect(json.data.estado).toBe('N');
  });

  it("6. PATCH /api/categories/:id/status - Debe alternar el estado ('N' -> 'S')", async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/categories/${createdCategoryId}/status`
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.data.estado).toBe('S');
  });

  it('7. DELETE /api/categories/:id - Debe eliminar la categoría', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/categories/${createdCategoryId}`
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
  });

  it('8. GET /api/categories/:id - Debe retornar 404 para la categoría eliminada', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/categories/${createdCategoryId}`
    });

    expect(res.statusCode).toBe(404);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(false);
  });
});
