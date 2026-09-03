const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const sharp = require('sharp');
const pLimit = require('p-limit');

class VideoProcessor {
  constructor() {
    // Limitar procesamiento concurrente de video a 2 tareas para proteger CPU y RAM
    this.videoQueue = pLimit(2);
    this._hasFfmpeg = null;
  }

  /**
   * Verifica si FFmpeg está instalado y disponible en el PATH del sistema
   */
  async checkFfmpeg() {
    if (this._hasFfmpeg !== null) return this._hasFfmpeg;
    return new Promise((resolve) => {
      const proc = spawn('ffmpeg', ['-version']);
      proc.on('error', () => {
        this._hasFfmpeg = false;
        resolve(false);
      });
      proc.on('close', (code) => {
        this._hasFfmpeg = code === 0;
        resolve(code === 0);
      });
    });
  }

  /**
   * Extrae un fotograma representativo del video y genera el poster en formato WebP optimizado
   */
  async generatePoster(inputVideoPath, outputPosterPath, options = {}) {
    return this.videoQueue(async () => {
      const { timeOffset = '00:00:01', quality = 80, width = 1280 } = options;
      const hasFfmpeg = await this.checkFfmpeg();

      if (hasFfmpeg) {
        try {
          await new Promise((resolve, reject) => {
            const tempJpg = `${outputPosterPath}.tmp.jpg`;
            const args = [
              '-y',
              '-ss', timeOffset,
              '-i', inputVideoPath,
              '-vframes', '1',
              '-q:v', '2',
              tempJpg
            ];

            const ffmpegProc = spawn('ffmpeg', args);
            const killTimer = setTimeout(() => {
              try { ffmpegProc.kill('SIGKILL'); } catch {}
              reject(new Error('Tiempo de espera agotado al extraer fotograma'));
            }, 15000);

            let stderrData = '';

            ffmpegProc.stderr.on('data', (data) => {
              stderrData += data.toString();
            });

            ffmpegProc.on('error', (err) => {
              clearTimeout(killTimer);
              reject(err);
            });
            ffmpegProc.on('close', async (code) => {
              clearTimeout(killTimer);
              if (code === 0) {
                try {
                  // Optimizar el fotograma capturado a WebP usando Sharp
                  await sharp(tempJpg)
                    .resize({
                      width,
                      fit: 'inside',
                      withoutEnlargement: true
                    })
                    .webp({ quality })
                    .toFile(outputPosterPath);

                  await fs.unlink(tempJpg).catch(() => {});
                  resolve();
                } catch (sharpErr) {
                  reject(sharpErr);
                }
              } else {
                reject(new Error(`FFmpeg exited with code ${code}: ${stderrData}`));
              }
            });
          });

          const meta = await sharp(outputPosterPath).metadata();
          return {
            width: meta.width,
            height: meta.height,
            size: meta.size
          };
        } catch (error) {
          console.warn('⚠️ Extracción de fotograma con FFmpeg falló, usando poster fallback:', error.message);
        }
      }

      // Fallback elegante si FFmpeg no está disponible o falla: Generar poster WebP estilizado
      return this.generateFallbackPoster(outputPosterPath, options);
    });
  }

  /**
   * Genera un poster WebP estilizado de respaldo con degradado y estética cinematográfica
   */
  async generateFallbackPoster(outputPosterPath, options = {}) {
    const width = options.width || 1280;
    const height = options.height || 720;
    const title = options.title || 'Video';

    const svgPoster = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1c2e24"/>
            <stop offset="50%" stop-color="#0f1913"/>
            <stop offset="100%" stop-color="#070c09"/>
          </linearGradient>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#d4af37" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#d4af37" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
        <circle cx="${width / 2}" cy="${height / 2}" r="180" fill="url(#glow)"/>
        <circle cx="${width / 2}" cy="${height / 2}" r="50" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.6)" stroke-width="3"/>
        <polygon points="${width / 2 - 12},${height / 2 - 20} ${width / 2 + 20},${height / 2} ${width / 2 - 12},${height / 2 + 20}" fill="#ffffff"/>
      </svg>
    `;

    await sharp(Buffer.from(svgPoster))
      .webp({ quality: 85 })
      .toFile(outputPosterPath);

    return {
      width,
      height,
      size: (await fs.stat(outputPosterPath)).size
    };
  }

  /**
   * Obtiene metadatos de video (duración, resolución)
   */
  async getVideoMetadata(inputVideoPath) {
    const hasFfmpeg = await this.checkFfmpeg();

    if (hasFfmpeg) {
      return new Promise((resolve) => {
        const args = [
          '-v', 'error',
          '-show_entries', 'format=duration:stream=width,height',
          '-of', 'json',
          inputVideoPath
        ];

        const ffprobeProc = spawn('ffprobe', args);
        let stdoutData = '';

        ffprobeProc.stdout.on('data', (d) => {
          stdoutData += d.toString();
        });

        ffprobeProc.on('error', () => {
          resolve({ duration: 0, width: 1920, height: 1080 });
        });

        ffprobeProc.on('close', (code) => {
          if (code === 0) {
            try {
              const data = JSON.parse(stdoutData);
              const duration = parseFloat(data.format?.duration) || 0;
              const stream = data.streams?.[0] || {};
              resolve({
                duration: Math.round(duration * 10) / 10,
                width: stream.width || 1920,
                height: stream.height || 1080
              });
            } catch {
              resolve({ duration: 0, width: 1920, height: 1080 });
            }
          } else {
            resolve({ duration: 0, width: 1920, height: 1080 });
          }
        });
      });
    }

    return { duration: 0, width: 1920, height: 1080 };
  }
}

module.exports = new VideoProcessor();
