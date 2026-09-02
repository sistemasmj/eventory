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
    expect(bodySent).toEqual({
      total: 2,
      items: [
        {
          id: 1542,
          token: '1756772985123-a83f21c7',
          orden: 1,
          urls: {
            thumb: '/api/media/25/1756772985123-a83f21c7/thumb',
            preview: '/api/media/25/1756772985123-a83f21c7/preview',
            original: '/api/media/25/1756772985123-a83f21c7/original'
          }
        },
        {
          id: 1543,
          token: '1756772989999-b12c34d5',
          orden: 2,
          urls: {
            thumb: '/api/media/25/1756772989999-b12c34d5/thumb',
            preview: '/api/media/25/1756772989999-b12c34d5/preview',
            original: '/api/media/25/1756772989999-b12c34d5/original'
          }
        }
      ]
    });

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
});
