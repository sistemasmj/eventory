import { describe, it, expect, vi, beforeEach } from 'vitest';
import EmpresaImagesController from '../src/modules/empresaImages/empresaImages.controller';
import { generateImageToken, isValidImageToken } from '../src/config/imageStorage';

describe('Media Delivery con X-Accel-Redirect (empresaImages.controller.js)', () => {
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

  it('1. Acceso autorizado: debe responder 200 con cabecera X-Accel-Redirect y cache inmutable para thumb', async () => {
    const validToken = '1756772985123-a83f21c7';
    const mockRequest = {
      params: {
        empresaId: '25',
        imageToken: validToken,
        type: 'thumb'
      },
      headers: {},
      raw: { url: `/media/25/${validToken}/thumb` }
    };

    await EmpresaImagesController.serveMedia(mockRequest, mockReply);

    expect(statusCodeSent).toBe(200);
    expect(headersSent['X-Accel-Redirect']).toBe(`/protected/empresa-25/${validToken}/thumb.webp`);
    expect(headersSent['Content-Type']).toBe('image/webp');
    expect(headersSent['Cache-Control']).toBe('private, max-age=31536000, immutable');
    expect(headersSent['X-Content-Type-Options']).toBe('nosniff');
    // Fastify no debe enviar bytes del archivo
    expect(bodySent).toBe('');
  });

  it('2. Acceso autorizado: debe mapear correctamente preview a preview.webp y original a original.jpg', async () => {
    const validToken = '1756772985123-a83f21c7';
    
    // Preview
    const previewReq = {
      params: { empresaId: '25', imageToken: validToken, type: 'preview' },
      headers: {},
      raw: { url: `/media/25/${validToken}/preview` }
    };
    await EmpresaImagesController.serveMedia(previewReq, mockReply);
    expect(headersSent['X-Accel-Redirect']).toBe(`/protected/empresa-25/${validToken}/preview.webp`);
    expect(headersSent['Content-Type']).toBe('image/webp');

    // Original
    const originalReq = {
      params: { empresaId: '25', imageToken: validToken, type: 'original' },
      headers: {},
      raw: { url: `/media/25/${validToken}/original` }
    };
    await EmpresaImagesController.serveMedia(originalReq, mockReply);
    expect(headersSent['X-Accel-Redirect']).toBe(`/protected/empresa-25/${validToken}/original.jpg`);
    expect(headersSent['Content-Type']).toBe('image/jpeg');
  });

  it('3. Acceso no autorizado: debe rechazar con 403 Forbidden si la sesión pertenece a otra empresa', async () => {
    const validToken = '1756772985123-a83f21c7';
    const mockRequest = {
      params: {
        empresaId: '25',
        imageToken: validToken,
        type: 'thumb'
      },
      session: {
        empresaId: 10 // Sesión de otra empresa
      },
      headers: {},
      raw: { url: `/media/25/${validToken}/thumb` }
    };

    await EmpresaImagesController.serveMedia(mockRequest, mockReply);

    expect(statusCodeSent).toBe(403);
    expect(bodySent.success).toBe(false);
    expect(bodySent.error).toMatch(/Acceso denegado/);
    expect(headersSent['X-Accel-Redirect']).toBeUndefined();
  });

  it('4. Type inválido: debe rechazar tipos no permitidos con 400 Bad Request', async () => {
    const validToken = '1756772985123-a83f21c7';
    const mockRequest = {
      params: {
        empresaId: '25',
        imageToken: validToken,
        type: 'malicious_type'
      },
      headers: {},
      raw: { url: `/media/25/${validToken}/malicious_type` }
    };

    await EmpresaImagesController.serveMedia(mockRequest, mockReply);

    expect(statusCodeSent).toBe(400);
    expect(bodySent.success).toBe(false);
    expect(bodySent.error).toMatch(/no permitido/);
  });

  it('5. Path Traversal: debe rechazar intentos con secuencias relativas .. o caracteres de escape', async () => {
    const maliciousToken = '../../etc/passwd';
    const mockRequest = {
      params: {
        empresaId: '25',
        imageToken: maliciousToken,
        type: 'thumb'
      },
      headers: {},
      raw: { url: `/media/25/../../etc/passwd/thumb` }
    };

    await EmpresaImagesController.serveMedia(mockRequest, mockReply);

    expect(statusCodeSent).toBe(400);
    expect(bodySent.success).toBe(false);
  });

  it('6. Token format validation: valida tokens criptográficos válidos e inválidos', () => {
    const validToken = generateImageToken();
    expect(isValidImageToken(validToken)).toBe(true);
    expect(isValidImageToken('1756772985123-a83f21c7')).toBe(true);

    expect(isValidImageToken('hack')).toBe(false);
    expect(isValidImageToken('../test')).toBe(false);
    expect(isValidImageToken('12345')).toBe(false);
    expect(isValidImageToken('')).toBe(false);
    expect(isValidImageToken(null)).toBe(false);
  });

  it('7. Soporte de Poster: debe responder 200 con X-Accel-Redirect a poster.webp para tipo poster', async () => {
    const validToken = '1756772985123-a83f21c7';
    const mockRequest = {
      params: {
        empresaId: '25',
        imageToken: validToken,
        type: 'poster'
      },
      headers: {},
      raw: { url: `/media/25/${validToken}/poster` }
    };

    await EmpresaImagesController.serveMedia(mockRequest, mockReply);

    expect(statusCodeSent).toBe(200);
    expect(headersSent['X-Accel-Redirect']).toBe(`/protected/empresa-25/${validToken}/poster.webp`);
    expect(headersSent['Content-Type']).toBe('image/webp');
    expect(headersSent['Accept-Ranges']).toBe('bytes');
  });
});
