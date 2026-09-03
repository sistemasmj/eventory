import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import EmpresaImagesService from '../src/modules/empresaImages/empresaImages.service';
import { Imagen } from '../src/models';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { imageStorageRoot } from '../src/config/imageStorage';

describe('Ciclo de Vida de Imagen (Subida, Procesamiento Sharp y Borrado)', () => {
  const empresaId = 88;
  let testImageBuffer;
  let createdToken;

  beforeEach(async () => {
    // Crear un buffer de imagen de prueba válido de 400x400 píxeles
    testImageBuffer = await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 3,
        background: { r: 100, g: 150, b: 200 }
      }
    }).jpeg().toBuffer();
  });

  afterAll(async () => {
    // Limpieza de directorio de prueba
    try {
      const testEmpresaDir = path.join(imageStorageRoot, `empresa-${empresaId}`);
      const { rm } = await import('fs/promises');
      await rm(testEmpresaDir, { recursive: true, force: true });
    } catch {
      // Ignorar si no existe
    }
  });

  it('1. Debe procesar la subida, crear variantes thumb.webp y preview.webp y registrar en BD', async () => {
    // Mock Imagen.create
    vi.spyOn(Imagen, 'create').mockImplementationOnce(async (data) => {
      createdToken = data.image_token;
      return {
        id: 999,
        empresa_id: data.empresa_id,
        image_token: data.image_token,
        orden: data.orden,
        estado: data.estado
      };
    });

    const mockFile = {
      filename: 'sample_foto.jpg',
      buffer: testImageBuffer
    };

    const result = await EmpresaImagesService.uploadImages(empresaId, [mockFile], { quality: 80 });

    expect(result.success).toBe(true);
    expect(result.uploaded.length).toBe(1);
    expect(result.uploaded[0].token).toBeDefined();
    expect(result.uploaded[0].urls.thumb).toContain(`/media/${empresaId}/${result.uploaded[0].token}/thumb`);
    expect(result.uploaded[0].urls.preview).toContain(`/media/${empresaId}/${result.uploaded[0].token}/preview`);
    expect(result.uploaded[0].urls.original).toContain(`/media/${empresaId}/${result.uploaded[0].token}/original`);

    // Verificar que los archivos físicos existen en disco
    const token = result.uploaded[0].token;
    const tokenDir = path.join(imageStorageRoot, `empresa-${empresaId}`, token);
    const { access } = await import('fs/promises');
    
    await expect(access(path.join(tokenDir, 'original.jpg'))).resolves.toBeUndefined();
    await expect(access(path.join(tokenDir, 'preview.webp'))).resolves.toBeUndefined();
    await expect(access(path.join(tokenDir, 'thumb.webp'))).resolves.toBeUndefined();
  });

  it('2. Debe eliminar el registro y los archivos físicos en disco al borrar la imagen', async () => {
    const mockImagen = {
      id: 999,
      empresa_id: empresaId,
      image_token: createdToken,
      destroy: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(Imagen, 'findOne').mockResolvedValueOnce(mockImagen);

    const deleteResult = await EmpresaImagesService.deleteImage(empresaId, createdToken);

    expect(deleteResult.success).toBe(true);
    expect(mockImagen.destroy).toHaveBeenCalled();

    // Comprobar que el directorio físico fue eliminado
    const tokenDir = path.join(imageStorageRoot, `empresa-${empresaId}`, createdToken);
    const { access } = await import('fs/promises');
    await expect(access(tokenDir)).rejects.toThrow();
  });

  it('3. Debe procesar la subida de un video, crear poster.webp y registrar como video en BD', async () => {
    let videoToken;
    vi.spyOn(Imagen, 'create').mockImplementationOnce(async (data) => {
      videoToken = data.image_token;
      return {
        id: 1000,
        empresa_id: data.empresa_id,
        image_token: data.image_token,
        tipo: data.tipo,
        duracion: data.duracion,
        orden: data.orden,
        estado: data.estado
      };
    });

    const mockVideoBuffer = Buffer.from('FAKE_MP4_HEADER_DATA_FOR_TESTING');
    const mockFile = {
      filename: 'clip_boda.mp4',
      mimetype: 'video/mp4',
      buffer: mockVideoBuffer
    };

    const result = await EmpresaImagesService.uploadImages(empresaId, [mockFile]);

    expect(result.success).toBe(true);
    expect(result.uploaded.length).toBe(1);
    expect(result.uploaded[0].type).toBe('video');
    expect(result.uploaded[0].urls.poster).toBeDefined();
    expect(result.uploaded[0].urls.poster).toContain(`/media/${empresaId}/${result.uploaded[0].token}/poster`);

    // Comprobar que los archivos de video y poster se crearon en disco
    const token = result.uploaded[0].token;
    const tokenDir = path.join(imageStorageRoot, `empresa-${empresaId}`, token);
    const { access } = await import('fs/promises');

    await expect(access(path.join(tokenDir, 'original.mp4'))).resolves.toBeUndefined();
    await expect(access(path.join(tokenDir, 'poster.webp'))).resolves.toBeUndefined();
  });
});
