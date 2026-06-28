// ============================================================================
//  impuestos.js  ·  Impuestos y gastos de compra de vivienda por CCAA
// ----------------------------------------------------------------------------
//  Replica y amplía la lógica de la app antigua. Los porcentajes son
//  orientativos (tipos generales máximos) y pueden variar según tramos de
//  precio, edad del comprador, etc. Se muestran como estimación.
// ============================================================================

/**
 * Tabla de tipos por comunidad autónoma.
 *  itpSegunda    → ITP para vivienda de 2ª mano que NO es habitual.
 *  itpHabitual   → ITP para vivienda habitual de 2ª mano (tipo reducido).
 *  ajdSegunda    → AJD para vivienda no habitual.
 *  ajdHabitual   → AJD para vivienda habitual.
 *  igic          → (solo Canarias) IGIC en lugar de IVA para obra nueva.
 */
export const CCAA = [
  { id: 1, nombre: 'Andalucía', itpSegunda: 7.0, itpHabitual: 6.0, ajdSegunda: 1.2, ajdHabitual: 1.0 },
  { id: 2, nombre: 'Aragón', itpSegunda: 8.0, itpHabitual: 8.0, ajdSegunda: 1.5, ajdHabitual: 1.5 },
  { id: 3, nombre: 'Asturias', itpSegunda: 8.0, itpHabitual: 8.0, ajdSegunda: 1.2, ajdHabitual: 1.2 },
  { id: 4, nombre: 'Baleares', itpSegunda: 8.0, itpHabitual: 4.0, ajdSegunda: 1.5, ajdHabitual: 1.2 },
  { id: 5, nombre: 'Canarias', itpSegunda: 6.5, itpHabitual: 5.0, ajdSegunda: 1.0, ajdHabitual: 0.4, igic: 6.5 },
  { id: 6, nombre: 'Cantabria', itpSegunda: 10.0, itpHabitual: 8.0, ajdSegunda: 2.0, ajdHabitual: 1.5 },
  { id: 7, nombre: 'Castilla y León', itpSegunda: 8.0, itpHabitual: 8.0, ajdSegunda: 1.5, ajdHabitual: 1.5 },
  { id: 8, nombre: 'Castilla-La Mancha', itpSegunda: 9.0, itpHabitual: 6.0, ajdSegunda: 1.5, ajdHabitual: 0.75 },
  { id: 9, nombre: 'Cataluña', itpSegunda: 10.0, itpHabitual: 10.0, ajdSegunda: 2.0, ajdHabitual: 2.0 },
  { id: 10, nombre: 'Comunidad Valenciana', itpSegunda: 10.0, itpHabitual: 10.0, ajdSegunda: 2.0, ajdHabitual: 2.0 },
  { id: 11, nombre: 'Extremadura', itpSegunda: 8.0, itpHabitual: 7.0, ajdSegunda: 2.0, ajdHabitual: 1.0 },
  { id: 12, nombre: 'Galicia', itpSegunda: 9.0, itpHabitual: 7.0, ajdSegunda: 1.5, ajdHabitual: 1.0 },
  { id: 13, nombre: 'Madrid', itpSegunda: 6.0, itpHabitual: 6.0, ajdSegunda: 0.75, ajdHabitual: 0.75 },
  { id: 14, nombre: 'Murcia', itpSegunda: 8.0, itpHabitual: 8.0, ajdSegunda: 1.5, ajdHabitual: 1.5 },
  { id: 15, nombre: 'Navarra', itpSegunda: 6.0, itpHabitual: 5.0, ajdSegunda: 0.5, ajdHabitual: 0.5 },
  { id: 16, nombre: 'País Vasco', itpSegunda: 7.0, itpHabitual: 4.0, ajdSegunda: 0.5, ajdHabitual: 0.5 },
  { id: 17, nombre: 'La Rioja', itpSegunda: 7.0, itpHabitual: 7.0, ajdSegunda: 1.0, ajdHabitual: 1.0 },
  { id: 18, nombre: 'Ceuta', itpSegunda: 6.0, itpHabitual: 6.0, ajdSegunda: 0.5, ajdHabitual: 0.5 },
  { id: 19, nombre: 'Melilla', itpSegunda: 6.0, itpHabitual: 6.0, ajdSegunda: 0.5, ajdHabitual: 0.5 },
];

export const CCAA_MADRID = 13;

/** IVA general de vivienda de obra nueva en territorio peninsular/Baleares. */
const IVA_GENERAL = 10.0;

/** Gastos fijos estimados (tipos máximos habituales). */
const NOTARIA_PCT = 0.5; // 0,2 % - 0,5 %
const REGISTRO_PCT = 0.25; // 0,1 % - 0,25 %
const GESTORIA_EUR = 300; // tarifa aproximada

/**
 * Devuelve la configuración de una CCAA por su id (o Madrid por defecto).
 */
export function getCCAA(id) {
  return CCAA.find((c) => c.id === id) || CCAA.find((c) => c.id === CCAA_MADRID);
}

/**
 * Calcula los impuestos y gastos de compra de una vivienda.
 *
 * @param {object} opts
 * @param {number} opts.valorInmueble  Precio de compra de la vivienda.
 * @param {number} opts.capital  Importe financiado por la hipoteca.
 * @param {number} [opts.comisionApertura=0]  Comisión de apertura en euros.
 * @param {number} [opts.ccaaId=13]  Id de la comunidad autónoma.
 * @param {boolean} [opts.obraNueva=false]  Obra nueva (IVA) vs 2ª mano (ITP).
 * @param {boolean} [opts.viviendaHabitual=false]  Aplica tipos reducidos.
 * @returns {object} Desglose de impuestos, gastos fijos y ahorro necesario.
 */
export function calcularImpuestos({
  valorInmueble,
  capital,
  comisionApertura = 0,
  ccaaId = CCAA_MADRID,
  obraNueva = false,
  viviendaHabitual = false,
}) {
  const ccaa = getCCAA(ccaaId);
  const v = valorInmueble;

  let ivaPct = 0;
  let valorIVA = 0;
  let itpPct = 0;
  let valorITP = 0;

  if (obraNueva) {
    // Obra nueva: tributa por IVA (o IGIC en Canarias).
    ivaPct = ccaa.igic ?? IVA_GENERAL;
    valorIVA = (ivaPct * v) / 100;
  } else {
    // Segunda mano: tributa por ITP (tipo reducido si es vivienda habitual).
    itpPct = viviendaHabitual ? ccaa.itpHabitual : ccaa.itpSegunda;
    valorITP = (itpPct * v) / 100;
  }

  // AJD (Actos Jurídicos Documentados) — aplicado como en la app original.
  const ajdPct = viviendaHabitual ? ccaa.ajdHabitual : ccaa.ajdSegunda;
  const valorAJD = (ajdPct * v) / 100;

  // Gastos fijos.
  const valorNotaria = (NOTARIA_PCT * v) / 100;
  const valorRegistro = (REGISTRO_PCT * v) / 100;
  const valorGestoria = GESTORIA_EUR;
  const gastosFijos = valorNotaria + valorRegistro + valorGestoria;

  const impuestosTotales = valorIVA + valorITP + valorAJD + gastosFijos;
  const porcentaje = v > 0 ? (impuestosTotales * 100) / v : 0;

  // Ahorro necesario = entrada (precio - hipoteca) + impuestos/gastos + comisión.
  const entrada = Math.max(0, v - capital);
  const ahorroNecesario = entrada + impuestosTotales + comisionApertura;

  return {
    ccaa: ccaa.nombre,
    valorInmueble: v,
    obraNueva,
    viviendaHabitual,
    ivaPct,
    valorIVA,
    itpPct,
    valorITP,
    ajdPct,
    valorAJD,
    valorNotaria,
    valorRegistro,
    valorGestoria,
    gastosFijos,
    impuestosTotales,
    porcentaje,
    entrada,
    ahorroNecesario,
    // Coste total real de la operación = precio + impuestos/gastos + intereses
    // (los intereses se suman fuera, en la capa de UI, con el resultado de la hipoteca).
  };
}
