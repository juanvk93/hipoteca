// ============================================================================
//  euribor.js  ·  Obtención del Euríbor 12 meses (API del BCE) con caché offline
// ----------------------------------------------------------------------------
//  Fuente: European Central Bank Data Portal (data-api.ecb.europa.eu).
//  Serie FM.M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA → Euríbor a 1 año, media mensual.
//  La API admite CORS (Access-Control-Allow-Origin: *), por lo que puede
//  consultarse directamente desde el navegador.
// ============================================================================

const URL_BCE =
  'https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA' +
  '?format=jsondata&lastNObservations=1';

const CACHE_KEY = 'euribor_cache_v1';

/**
 * Lee el último valor del Euríbor cacheado en localStorage (fallback offline).
 * @returns {{valor:number, periodo:string, fuente:string, ts:number}|null}
 */
export function leerEuriborCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function guardarEuriborCache(dato) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(dato));
  } catch {
    /* almacenamiento no disponible: se ignora */
  }
}

/**
 * Formatea un periodo "AAAA-MM" a algo legible: "mayo 2026".
 */
export function formatearPeriodo(periodo) {
  if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) return periodo || '';
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const [a, m] = periodo.split('-');
  return `${meses[parseInt(m, 10) - 1]} ${a}`;
}

/**
 * Consulta el Euríbor 12 meses más reciente en la API del BCE.
 * @param {number} [timeoutMs=8000]  Tiempo máximo de espera.
 * @returns {Promise<{valor:number, periodo:string, fuente:string, ts:number}>}
 * @throws Si la petición falla, agota el tiempo o el formato es inesperado.
 */
export async function fetchEuriborBCE(timeoutMs = 8000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(URL_BCE, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const serie = data?.dataSets?.[0]?.series?.['0:0:0:0:0:0:0']?.observations;
    if (!serie) throw new Error('Respuesta del BCE sin observaciones');

    // La clave de cada observación indexa el array de periodos de la estructura.
    const clave = Object.keys(serie)[0];
    const valor = serie[clave]?.[0];
    if (typeof valor !== 'number') throw new Error('Valor de Euríbor no numérico');

    const periodos = data?.structure?.dimensions?.observation?.[0]?.values || [];
    const periodo = periodos[Number(clave)]?.id || '';

    const dato = { valor, periodo, fuente: 'BCE', ts: Date.now() };
    guardarEuriborCache(dato);
    return dato;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Resuelve el valor del Euríbor a aplicar según los ajustes del usuario.
 * Prioridad:
 *   1. Valor manual, si el usuario lo ha fijado en ajustes.
 *   2. Valor cacheado del BCE.
 *   3. null (la UI pedirá introducirlo a mano).
 *
 * @param {object} ajustes  Ajustes de la app (euriborManual, usarEuriborManual).
 * @returns {{valor:number|null, fuente:string, periodo:string}}
 */
export function resolverEuribor(ajustes) {
  if (ajustes?.usarEuriborManual && typeof ajustes.euriborManual === 'number') {
    return { valor: ajustes.euriborManual, fuente: 'manual', periodo: '' };
  }
  const cache = leerEuriborCache();
  if (cache) return { valor: cache.valor, fuente: 'BCE', periodo: cache.periodo };
  return { valor: null, fuente: 'desconocido', periodo: '' };
}
