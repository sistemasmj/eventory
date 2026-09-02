import { describe, it, expect } from 'vitest';
import imageProcessor from '../src/utils/imageProcessor';

describe('ImageProcessor (imageProcessor.js)', () => {
  it('debe identificar buffers inválidos como imágenes no válidas', async () => {
    const invalidBuffer = Buffer.from('not an image');
    const isValid = await imageProcessor.isValidImage(invalidBuffer);
    expect(isValid).toBe(false);
  });
});
