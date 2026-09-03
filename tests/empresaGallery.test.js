import { describe, it, expect, vi, beforeEach } from 'vitest';
import EmpresaImagesController from '../src/modules/empresaImages/empresaImages.controller';
import EmpresaImagesService from '../src/modules/empresaImages/empresaImages.service';
import { Imagen } from '../src/models';

describe('Galería de Imágenes de Empresas (/api/empresas/:empresaId/imagenes)', () => {
  let mockReply;
  let headersSent;
  let statusCodeSent;
  let bodySent;

  beforeEach(() => {
    headersSent = {};
    statusCodeSent = null;
    bodySent = null;

    mockReply = {
      header: (name, value) => {
        headersSent[name] = value;
        return mockReply;
      },
      status: (code) => {
        statusCodeSent = code;
        return mockReply;
      },
      send: (body) => {
        bodySent = body;
        return { statusCode: statusCodeSent, headers: headersSent, body: bodySent };
      }
    };
  });

  it('1. Debe obtener la galería con UNA sola consulta y construir URLs lógicas de 3 variantes', async () => {
    const mockImagesFromDb = [
      {
        id: 1542,
        image_token: '1756772985123-a83f21c7',
        orden: 1,
        width: 1600,
        height: 1200,
        size: 250000
      },
      {
        id: 1543,
        image_token: '1756772989999-b12c34d5',
        orden: 2,
        width: 1600,
        height: 1200,
        size: 280000
      }
    ];

    // Espiar Imagen.findAll para comprobar que se llama una sola vez
    const findAllSpy = vi.spyOn(Imagen, 'findAll').mockResolvedValue(mockImagesFromDb);

    const mockRequest = {
      params: { empresaId: '25' },
      query: { limit: '100', offset: '0' },
      headers: {}
    };

    await EmpresaImagesController.getGallery(mockRequest, mockReply);

    expect(findAllSpy).toHaveBeenCalledTimes(1);
    expect(statusCodeSent).toBe(200);

    // Validar cabeceras de no-caché para la lista dinámica
    expect(headersSent['Cache-Control']).toBe('no-cache, no-store, must-revalidate');
    expect(headersSent['Pragma']).toBe('no-cache');
    expect(headersSent['Expires']).toBe('0');

    // Validar estructura de respuesta esperada
    expect(bodySent.total).toBe(2);
    expect(bodySent.items[0].type).toBe('image');
    expect(bodySent.items[0].urls.thumb).toBe('/api/media/25/1756772985123-a83f21c7/thumb');
    expect(bodySent.items[0].urls.preview).toBe('/api/media/25/1756772985123-a83f21c7/preview');
    expect(bodySent.items[0].urls.original).toBe('/api/media/25/1756772985123-a83f21c7/original');

    findAllSpy.mockRestore();
  });

  it('2. Debe retornar total: 0 e items: [] cuando la empresa no tiene imágenes', async () => {
    const findAllSpy = vi.spyOn(Imagen, 'findAll').mockResolvedValue([]);

    const mockRequest = {
      params: { empresaId: '99' },
      query: {},
      headers: {}
    };

    await EmpresaImagesController.getGallery(mockRequest, mockReply);

    expect(statusCodeSent).toBe(200);
    expect(bodySent).toEqual({
      total: 0,
      items: []
    });

    findAllSpy.mockRestore();
  });

  it('3. Debe rechazar identificadores de empresa no numéricos o negativos con 400', async () => {
    const mockRequest = {
      params: { empresaId: 'abc' },
      query: {},
      headers: {}
    };

    await EmpresaImagesController.getGallery(mockRequest, mockReply);

    expect(statusCodeSent).toBe(400);
    expect(bodySent.success).toBe(false);
  });

  it('4. Debe actualizar el orden de una imagen satisfactoriamente', async () => {
    const mockImagen = {
      id: 10,
      image_token: '1756772985123-a83f21c7',
      orden: 1,
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(Imagen, 'findOne').mockResolvedValue(mockImagen);

    const mockRequest = {
      params: { empresaId: '25', tokenOrId: '1756772985123-a83f21c7' },
      body: { orden: 5 },
      headers: {}
    };

    await EmpresaImagesController.updateOrder(mockRequest, mockReply);

    expect(statusCodeSent).toBe(200);
    expect(mockImagen.orden).toBe(5);
    expect(mockImagen.save).toHaveBeenCalled();
  });

  it('5. Galería Mixta: debe estructurar correctamente ítems de imagen y video juntos', async () => {
    const mixedItemsFromDb = [
      {
        id: 1,
        image_token: '1756772985123-a83f21c7',
        tipo: 'image',
        duracion: null,
        extension: 'jpg',
        orden: 1
      },
      {
        id: 2,
        image_token: '1756773009123-b19d82af',
        tipo: 'video',
        duracion: 32.4,
        extension: 'mp4',
        orden: 2
      }
    ];

    const findAllSpy = vi.spyOn(Imagen, 'findAll').mockResolvedValue(mixedItemsFromDb);

    const mockRequest = {
      params: { empresaId: '25' },
      query: {},
      headers: {}
    };

    await EmpresaImagesController.getGallery(mockRequest, mockReply);

    expect(bodySent.total).toBe(2);
    expect(bodySent.items[0].type).toBe('image');
    expect(bodySent.items[0].urls.thumb).toBe('/api/media/25/1756772985123-a83f21c7/thumb');
    
    expect(bodySent.items[1].type).toBe('video');
    expect(bodySent.items[1].duracion).toBe(32.4);
    expect(bodySent.items[1].urls.thumb).toBe('/api/media/25/1756773009123-b19d82af/poster');
    expect(bodySent.items[1].urls.poster).toBe('/api/media/25/1756773009123-b19d82af/poster');
    expect(bodySent.items[1].urls.original).toBe('/api/media/25/1756773009123-b19d82af/original');

    findAllSpy.mockRestore();
  });
});
