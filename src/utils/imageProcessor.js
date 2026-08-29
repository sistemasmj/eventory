const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const { pipeline } = require('stream/promises');
const { createWriteStream } = require('fs');

class ImageProcessor {
  /**
   * Procesar imagen desde stream
   */
  async processImage(stream, options = {}) {
    const {
      outputPath,
      quality = 82,
      maxWidth = 2000,
      maxHeight = 2000,
      format = 'webp'
    } = options;

    try {
      const transformer = sharp()
        .resize({
          width: maxWidth,
          height: maxHeight,
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality, effort: 4 })
        .withMetadata();

      const writeStream = createWriteStream(outputPath);

      // Pipeline con backpressure automático
      await pipeline(stream, transformer, writeStream);

      // Obtener metadata
      const metadata = await sharp(outputPath).metadata();

      return {
        size: metadata.size,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format
      };

    } catch (error) {
      console.error('Error procesando imagen:', error);
      throw new Error(`Error al procesar imagen: ${error.message}`);
    }
  }

  /**
   * Generar thumbnail desde archivo
   */
  async generateThumbnail(inputPath, outputPath, options = {}) {
    const {
      width = 300,
      height = 300,
      quality = 75,
      format = 'webp',
      fit = 'cover'
    } = options;

    try {
      await sharp(inputPath)
        .resize({
          width,
          height,
          fit,
          position: 'center'
        })
        .webp({ quality })
        .toFile(outputPath);

      const metadata = await sharp(outputPath).metadata();
      
      return {
        size: metadata.size,
        width: metadata.width,
        height: metadata.height
      };

    } catch (error) {
      console.error('Error generando thumbnail:', error);
      throw new Error(`Error al generar thumbnail: ${error.message}`);
    }
  }

  /**
   * Procesar imagen en lote (para varias imágenes)
   */
  async processBatch(images, options = {}) {
    const results = [];
    const errors = [];

    for (const image of images) {
      try {
        const result = await this.processImage(image.stream, {
          outputPath: image.outputPath,
          ...options
        });
        results.push({
          filename: image.filename,
          ...result
        });
      } catch (error) {
        errors.push({
          filename: image.filename,
          error: error.message
        });
      }
    }

    return { results, errors };
  }

  /**
   * Optimizar imagen existente
   */
  async optimizeImage(inputPath, outputPath, options = {}) {
    const {
      quality = 82,
      maxWidth = 2000,
      maxHeight = 2000
    } = options;

    try {
      await sharp(inputPath)
        .resize({
          width: maxWidth,
          height: maxHeight,
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality })
        .toFile(outputPath);

      return await sharp(outputPath).metadata();
    } catch (error) {
      console.error('Error optimizando imagen:', error);
      throw error;
    }
  }

  /**
   * Obtener metadata de imagen
   */
  async getMetadata(imagePath) {
    try {
      return await sharp(imagePath).metadata();
    } catch (error) {
      console.error('Error obteniendo metadata:', error);
      throw error;
    }
  }

  /**
   * Verificar si es una imagen válida
   */
  async isValidImage(buffer) {
    try {
      await sharp(buffer).metadata();
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = new ImageProcessor();