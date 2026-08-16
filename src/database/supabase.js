const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');

// ══════════════════════════════════════════════════════
// ⟡ Cliente Supabase — Storage + PostgreSQL
// ══════════════════════════════════════════════════════

let supabase = null;

const BUCKET_NAME = 'burn-proofs';

/**
 * Inicializa el cliente Supabase.
 * Usa service_role key para bypass de RLS (backend server).
 */
function initialize() {
  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_KEY) {
    console.log('⟡ Supabase: Deshabilitado (sin credenciales).');
    return;
  }

  supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('✓ Supabase: Cliente inicializado.');
}

/**
 * Crea el bucket de pruebas si no existe.
 */
async function ensureBucket() {
  if (!supabase) return;

  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === BUCKET_NAME);

    if (!exists) {
      const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true, // Las pruebas deben ser accesibles por URL
        fileSizeLimit: 25 * 1024 * 1024, // 25MB max por archivo
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/json', 'text/plain'],
      });

      if (error) {
        console.error('⟡ Supabase: Error creando bucket:', error.message);
      } else {
        console.log(`✓ Supabase: Bucket "${BUCKET_NAME}" creado.`);
      }
    } else {
      // Actualizar MIME types permitidos en bucket existente
      try {
        await supabase.storage.updateBucket(BUCKET_NAME, {
          public: true,
          fileSizeLimit: 25 * 1024 * 1024,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/json', 'text/plain'],
        });
      } catch {}
      console.log(`✓ Supabase: Bucket "${BUCKET_NAME}" listo y actualizado.`);
    }
  } catch (err) {
    console.error('⟡ Supabase: Error verificando bucket:', err.message);
  }
}

/**
 * Sube un archivo (Buffer) al bucket de pruebas.
 * @param {Buffer} buffer - Datos del archivo
 * @param {string} fileName - Nombre del archivo (ej: "report_123_proof_1.jpg")
 * @param {string} mimeType - MIME type (ej: "image/jpeg")
 * @returns {string|null} URL pública del archivo o null si falla
 */
async function uploadProof(buffer, fileName, mimeType) {
  if (!supabase) {
    console.warn('⟡ Supabase: No inicializado, no se puede subir archivo.');
    return null;
  }

  try {
    const filePath = `proofs/${fileName}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: mimeType || 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.error('⟡ Supabase: Error subiendo archivo:', error.message);
      return null;
    }

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    const publicUrl = urlData?.publicUrl || null;
    console.log(`✓ Supabase: Archivo subido → ${publicUrl}`);
    return publicUrl;
  } catch (err) {
    console.error('⟡ Supabase: Error en upload:', err.message);
    return null;
  }
}

/**
 * Elimina un archivo del bucket.
 */
async function deleteProof(fileName) {
  if (!supabase) return;

  try {
    const filePath = `proofs/${fileName}`;
    await supabase.storage.from(BUCKET_NAME).remove([filePath]);
  } catch (err) {
    console.error('⟡ Supabase: Error eliminando archivo:', err.message);
  }
}

/**
 * Verifica si el cliente está disponible.
 */
function isEnabled() {
  return supabase !== null;
}

module.exports = {
  initialize,
  ensureBucket,
  uploadProof,
  deleteProof,
  isEnabled,
};
