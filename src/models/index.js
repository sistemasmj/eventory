const { sequelize } = require('../config/database');
const Event = require('./Event');
const GalleryImage = require('./GalleryImage');
const Imagen = require('./Imagen');
const Song = require('./Song');
const Category = require('./Category');

// Definir relaciones (protegido contra reinicializaciones)
if (!Event.associations || !Event.associations.images) {
  Event.hasMany(GalleryImage, {
    foreignKey: {
      name: 'event_id',
      allowNull: false
    },
    as: 'images',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  });
}

if (!GalleryImage.associations || !GalleryImage.associations.event) {
  GalleryImage.belongsTo(Event, {
    foreignKey: {
      name: 'event_id',
      allowNull: false
    },
    as: 'event'
  });
}

// Relación entre Categoría y GalleryImage
if (!Category.associations || !Category.associations.images) {
  Category.hasMany(GalleryImage, {
    foreignKey: {
      name: 'categoria_id',
      allowNull: true
    },
    as: 'images',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
  });
}

if (!GalleryImage.associations || !GalleryImage.associations.categoria) {
  GalleryImage.belongsTo(Category, {
    foreignKey: {
      name: 'categoria_id',
      allowNull: true
    },
    as: 'categoria'
  });
}

// Relación entre Evento y Canción
if (!Event.associations || !Event.associations.cancion) {
  Event.belongsTo(Song, {
    foreignKey: {
      name: 'cancion_id',
      allowNull: true
    },
    as: 'cancion'
  });
}

if (!Song.associations || !Song.associations.events) {
  Song.hasMany(Event, {
    foreignKey: {
      name: 'cancion_id',
      allowNull: true
    },
    as: 'events'
  });
}

// Función para sincronizar y crear índices y columnas faltantes de forma segura
const syncModels = async (options = {}) => {
  try {
    await sequelize.sync(options);
    console.log('✅ Models synchronized with MySQL');
    
    // 1. Asegurar columnas multimedia en la tabla 'imagenes'
    try {
      const [imgCols] = await sequelize.query('SHOW COLUMNS FROM imagenes');
      const imgColNames = imgCols.map(c => c.Field);

      if (!imgColNames.includes('tipo')) {
        await sequelize.query("ALTER TABLE imagenes ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'image' AFTER nombre_original");
        console.log("✅ Columna 'tipo' agregada a imagenes");
      }
      if (!imgColNames.includes('duracion')) {
        await sequelize.query("ALTER TABLE imagenes ADD COLUMN duracion FLOAT NULL AFTER tipo");
        console.log("✅ Columna 'duracion' agregada a imagenes");
      }
      if (!imgColNames.includes('version')) {
        await sequelize.query("ALTER TABLE imagenes ADD COLUMN version INT NOT NULL DEFAULT 1 AFTER metadata");
        console.log("✅ Columna 'version' agregada a imagenes");
      }

      await sequelize.query("UPDATE imagenes SET tipo = 'image' WHERE tipo IS NULL OR tipo = ''");
      await sequelize.query("UPDATE imagenes SET version = 1 WHERE version IS NULL OR version < 1");
    } catch (err) {
      console.warn('⚠️ Nota sobre columnas de imagenes:', err.message);
    }

    // 2. Asegurar columnas multimedia en la tabla 'gallery_images'
    try {
      const [galleryCols] = await sequelize.query('SHOW COLUMNS FROM gallery_images');
      const galleryColNames = galleryCols.map(c => c.Field);

      if (!galleryColNames.includes('tipo')) {
        await sequelize.query("ALTER TABLE gallery_images ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'image' AFTER nombre_original");
        console.log("✅ Columna 'tipo' agregada a gallery_images");
      }
      if (!galleryColNames.includes('duracion')) {
        await sequelize.query("ALTER TABLE gallery_images ADD COLUMN duracion FLOAT NULL AFTER tipo");
        console.log("✅ Columna 'duracion' agregada a gallery_images");
      }
      if (!galleryColNames.includes('ruta_temp')) {
        await sequelize.query("ALTER TABLE gallery_images ADD COLUMN ruta_temp VARCHAR(500) NULL AFTER ruta_raw");
        console.log("✅ Columna 'ruta_temp' agregada a gallery_images");
      }
      if (!galleryColNames.includes('ruta_poster')) {
        await sequelize.query("ALTER TABLE gallery_images ADD COLUMN ruta_poster VARCHAR(500) NULL AFTER ruta_thumb");
        console.log("✅ Columna 'ruta_poster' agregada a gallery_images");
      }
      if (!galleryColNames.includes('categoria_id')) {
        await sequelize.query("ALTER TABLE gallery_images ADD COLUMN categoria_id INT NULL AFTER event_id");
        console.log("✅ Columna 'categoria_id' agregada a gallery_images");
      }
      if (!galleryColNames.includes('orden')) {
        await sequelize.query("ALTER TABLE gallery_images ADD COLUMN orden INT NOT NULL DEFAULT 0 AFTER fecha_subida");
        console.log("✅ Columna 'orden' agregada a gallery_images");
      }
      if (!galleryColNames.includes('version')) {
        await sequelize.query("ALTER TABLE gallery_images ADD COLUMN version INT NOT NULL DEFAULT 1 AFTER metadata");
        console.log("✅ Columna 'version' agregada a gallery_images");
      }

      await sequelize.query("UPDATE gallery_images SET tipo = 'image' WHERE tipo IS NULL OR tipo = ''");
      await sequelize.query("UPDATE gallery_images SET version = 1 WHERE version IS NULL OR version < 1");
    } catch (err) {
      console.warn('⚠️ Nota sobre columnas de gallery_images:', err.message);
    }

    // 2.1. Asegurar categorías iniciales ID 1 y ID 2 si no existen
    try {
      await Category.findOrCreate({
        where: { id: 1 },
        defaults: {
          id: 1,
          descripcion: 'Album Personalizado',
          estado: 'S'
        }
      });
      await Category.findOrCreate({
        where: { id: 2 },
        defaults: {
          id: 2,
          descripcion: 'Galeria de Fotos',
          estado: 'S'
        }
      });
    } catch (err) {
      // Ignorar si ya existe
    }

    // 3. Asegurar columna cancion_id en la tabla 'events'
    try {
      const [eventCols] = await sequelize.query('SHOW COLUMNS FROM events');
      const eventColNames = eventCols.map(c => c.Field);

      if (!eventColNames.includes('cancion_id')) {
        await sequelize.query("ALTER TABLE events ADD COLUMN cancion_id INT NULL AFTER notas");
        console.log("✅ Columna 'cancion_id' agregada a events");
      }
    } catch (err) {
      console.warn('⚠️ Nota sobre columna cancion_id en events:', err.message);
    }

    // 4. Crear índices adicionales si no existen (compatible con MySQL 5.7+)
    try {
      const [indexes] = await sequelize.query("SHOW INDEX FROM events WHERE Key_name = 'idx_events_nombre_estado'");
      if (!indexes || indexes.length === 0) {
        await sequelize.query('CREATE INDEX idx_events_nombre_estado ON events(nombre, estado)');
      }
    } catch (err) {
      // Ignorar si ya existe
    }

    try {
      const [imgIndexes] = await sequelize.query("SHOW INDEX FROM imagenes WHERE Key_name = 'idx_imagenes_empresa_estado_orden'");
      if (!imgIndexes || imgIndexes.length === 0) {
        await sequelize.query('CREATE INDEX idx_imagenes_empresa_estado_orden ON imagenes(empresa_id, estado, orden)');
      }
    } catch (err) {
      // Ignorar si ya existe o la tabla aún no se ha creado
    }

    try {
      const [imgTokenIdx] = await sequelize.query("SHOW INDEX FROM imagenes WHERE Key_name = 'idx_imagenes_image_token_unique'");
      if (!imgTokenIdx || imgTokenIdx.length === 0) {
        await sequelize.query('CREATE UNIQUE INDEX idx_imagenes_image_token_unique ON imagenes(image_token)');
      }
    } catch (err) {
      // Ignorar si ya existe
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error syncing models:', error);
    throw error;
  }
};

// Función para ejecutar migraciones manuales
const runMigrations = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ Migrations executed successfully');
    return true;
  } catch (error) {
    console.error('❌ Error running migrations:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  Event,
  GalleryImage,
  Imagen,
  Song,
  Category,
  syncModels,
  runMigrations
};