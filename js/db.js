// ============================================================================
//  db.js  ·  Persistencia con IndexedDB (hipotecas guardadas + ajustes)
// ----------------------------------------------------------------------------
//  Solicita almacenamiento persistente al navegador para que los datos no se
//  borren por presión de espacio. Expone una API basada en promesas.
// ============================================================================

const DB_NOMBRE = 'hipotecaDB';
const DB_VERSION = 1;
const STORE_HIPOTECAS = 'hipotecas';
const STORE_AJUSTES = 'ajustes';

/** Ajustes por defecto de la aplicación. */
export const AJUSTES_DEFAULT = {
  tema: 'oscuro', // 'oscuro' | 'claro'
  acento: '#3d8bff', // color de acento configurable
  usarEuriborManual: false,
  euriborManual: null,
};

let _dbPromise = null;

/**
 * Abre (y si hace falta crea) la base de datos.
 * @returns {Promise<IDBDatabase>}
 */
function abrirDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOMBRE, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_HIPOTECAS)) {
        db.createObjectStore(STORE_HIPOTECAS, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_AJUSTES)) {
        db.createObjectStore(STORE_AJUSTES, { keyPath: 'clave' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

/**
 * Solicita al navegador que el almacenamiento sea persistente.
 * @returns {Promise<boolean>} true si el almacenamiento es persistente.
 */
export async function solicitarPersistencia() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const yaPersistente = await navigator.storage.persisted();
      if (yaPersistente) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* no soportado */
  }
  return false;
}

/**
 * Estima el uso de almacenamiento (para mostrarlo en ajustes).
 * @returns {Promise<{uso:number, cuota:number, persistente:boolean}|null>}
 */
export async function infoAlmacenamiento() {
  try {
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    const persistente = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
    return est ? { uso: est.usage || 0, cuota: est.quota || 0, persistente } : null;
  } catch {
    return null;
  }
}

function tx(db, store, modo) {
  return db.transaction(store, modo).objectStore(store);
}

function promesa(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ----------------------------------------------------------------------------
//  Hipotecas guardadas
// ----------------------------------------------------------------------------

/**
 * Guarda una hipoteca nueva. Devuelve el id asignado.
 * @param {object} hipoteca  { nombre, config, datosVivienda, resumen, creada }
 */
export async function guardarHipoteca(hipoteca) {
  const db = await abrirDB();
  const registro = { ...hipoteca };
  delete registro.id; // id lo asigna el autoIncrement
  return promesa(tx(db, STORE_HIPOTECAS, 'readwrite').add(registro));
}

/**
 * Actualiza una hipoteca existente (debe incluir su id).
 */
export async function actualizarHipoteca(hipoteca) {
  const db = await abrirDB();
  return promesa(tx(db, STORE_HIPOTECAS, 'readwrite').put(hipoteca));
}

/** Devuelve todas las hipotecas guardadas, de la más reciente a la más antigua. */
export async function listarHipotecas() {
  const db = await abrirDB();
  const todas = await promesa(tx(db, STORE_HIPOTECAS, 'readonly').getAll());
  return todas.sort((a, b) => (b.creada || 0) - (a.creada || 0));
}

/** Obtiene una hipoteca por id. */
export async function obtenerHipoteca(id) {
  const db = await abrirDB();
  return promesa(tx(db, STORE_HIPOTECAS, 'readonly').get(id));
}

/** Borra una hipoteca por id. */
export async function borrarHipoteca(id) {
  const db = await abrirDB();
  return promesa(tx(db, STORE_HIPOTECAS, 'readwrite').delete(id));
}

// ----------------------------------------------------------------------------
//  Ajustes
// ----------------------------------------------------------------------------

/** Carga los ajustes, mezclando con los valores por defecto. */
export async function cargarAjustes() {
  const db = await abrirDB();
  const guardado = await promesa(tx(db, STORE_AJUSTES, 'readonly').get('app'));
  return { ...AJUSTES_DEFAULT, ...(guardado?.valor || {}) };
}

/** Guarda (reemplaza) los ajustes de la aplicación. */
export async function guardarAjustes(ajustes) {
  const db = await abrirDB();
  return promesa(tx(db, STORE_AJUSTES, 'readwrite').put({ clave: 'app', valor: ajustes }));
}

// ----------------------------------------------------------------------------
//  Exportar / importar (copia de seguridad)
// ----------------------------------------------------------------------------

/** Genera un objeto con todas las hipotecas y los ajustes para exportar. */
export async function exportarTodo() {
  const hipotecas = await listarHipotecas();
  const ajustes = await cargarAjustes();
  return {
    app: 'calculadora-hipoteca',
    formato: 1,
    exportado: Date.now(),
    hipotecas,
    ajustes,
  };
}

/**
 * Importa una lista de hipotecas como nuevos registros (sin sobrescribir las
 * existentes; se les asigna un id nuevo).
 * @param {Array} lista  Hipotecas a importar.
 * @returns {Promise<number>} Número de hipotecas importadas.
 */
export async function importarHipotecas(lista) {
  if (!Array.isArray(lista)) throw new Error('Formato no válido');
  let n = 0;
  for (const h of lista) {
    if (!h || !h.config) continue; // ignora entradas corruptas
    const reg = { ...h };
    delete reg.id;
    if (!reg.creada) reg.creada = Date.now();
    await guardarHipoteca(reg);
    n++;
  }
  return n;
}
