// ============================================================================
//  calculos.js  ·  Motor de cálculo hipotecario (modelo francés de amortización)
// ----------------------------------------------------------------------------
//  Funciones puras, sin dependencias del DOM. Todo el dinero en euros y los
//  tipos de interés en porcentaje anual (ej. 3.25 == 3,25 %).
// ============================================================================

/**
 * Cuota mensual constante de un préstamo (sistema francés).
 * @param {number} capital  Capital pendiente al inicio del tramo.
 * @param {number} tinAnual  Tipo de interés nominal anual en % (ej. 3.5).
 * @param {number} meses  Número de mensualidades.
 * @returns {number} Cuota mensual.
 */
export function cuotaFrancesa(capital, tinAnual, meses) {
  if (meses <= 0) return 0;
  const i = tinAnual / 100 / 12; // interés mensual
  if (i === 0) return capital / meses;
  return (capital * i) / (1 - Math.pow(1 + i, -meses));
}

/**
 * Saldo pendiente de un préstamo tras pagar `mesesPagados` cuotas.
 * @param {number} capital  Capital inicial.
 * @param {number} tinAnual  TIN anual %.
 * @param {number} cuota  Cuota mensual abonada.
 * @param {number} mesesPagados  Cuotas ya pagadas.
 * @returns {number} Capital vivo restante.
 */
export function saldoPendiente(capital, tinAnual, cuota, mesesPagados) {
  const r = tinAnual / 100 / 12;
  if (r === 0) return Math.max(0, capital - cuota * mesesPagados);
  const factor = Math.pow(1 + r, mesesPagados);
  return capital * factor - cuota * ((factor - 1) / r);
}

/**
 * Genera el cuadro de amortización mensual de un tramo a cuota e interés fijos.
 * Devuelve además el capital pendiente final.
 * @param {object} opts
 * @param {number} opts.capital  Capital inicial del tramo.
 * @param {number} opts.tinAnual  TIN anual %.
 * @param {number} opts.cuota  Cuota mensual.
 * @param {number} opts.meses  Nº de cuotas de este tramo.
 * @param {number} [opts.mesInicial=1]  Índice del primer mes (para tramos encadenados).
 * @param {boolean} [opts.ajustarUltima=true]  Si la última cuota salda el capital
 *        pendiente (solo debe hacerse en el tramo FINAL del préstamo, no en un
 *        tramo intermedio como el fijo de una hipoteca mixta).
 * @returns {{filas: Array, capitalFinal: number, totalIntereses: number, totalPagado: number}}
 */
export function cuadroAmortizacionTramo({ capital, tinAnual, cuota, meses, mesInicial = 1, ajustarUltima = true }) {
  const i = tinAnual / 100 / 12;
  const filas = [];
  let pendiente = capital;
  let totalIntereses = 0;
  let totalPagado = 0;

  for (let m = 0; m < meses; m++) {
    const interes = pendiente * i;
    let amortizado = cuota - interes;
    // Última cuota del préstamo: ajustamos para no dejar residuos por redondeo.
    if (m === meses - 1 && ajustarUltima) {
      amortizado = pendiente;
    }
    pendiente = Math.max(0, pendiente - amortizado);
    const cuotaReal = interes + amortizado;
    totalIntereses += interes;
    totalPagado += cuotaReal;
    filas.push({
      mes: mesInicial + m,
      cuota: cuotaReal,
      interes,
      amortizado,
      pendiente,
    });
  }

  return { filas, capitalFinal: pendiente, totalIntereses, totalPagado };
}

/**
 * Agrupa un cuadro de amortización mensual por años naturales del préstamo.
 * @param {Array} filas  Filas mensuales de cuadroAmortizacionTramo (concatenadas).
 * @returns {Array} Resumen anual.
 */
export function agruparPorAnos(filas) {
  const anos = [];
  for (const fila of filas) {
    const idxAno = Math.floor((fila.mes - 1) / 12);
    if (!anos[idxAno]) {
      anos[idxAno] = {
        ano: idxAno + 1,
        cuota: 0,
        interes: 0,
        amortizado: 0,
        pendiente: 0,
      };
    }
    const a = anos[idxAno];
    a.cuota += fila.cuota;
    a.interes += fila.interes;
    a.amortizado += fila.amortizado;
    a.pendiente = fila.pendiente; // el último mes del año manda
  }
  return anos.filter(Boolean);
}

/**
 * Calcula la TAE (tasa anual equivalente) resolviendo la TIR mensual de los
 * flujos reales del préstamo, incluyendo la comisión de apertura.
 * La TAE iguala: (capital - comisiones) = Σ cuota_t / (1+i)^t
 * @param {number} capital  Capital del préstamo.
 * @param {number} comisionApertura  Comisión de apertura en euros.
 * @param {number[]} cuotas  Flujo de cuotas mensuales (todas las mensualidades).
 * @returns {number} TAE en %.
 */
export function calcularTAE(capital, comisionApertura, cuotas) {
  const neto = capital - comisionApertura;
  if (neto <= 0 || cuotas.length === 0) return 0;

  const vp = (i) => cuotas.reduce((acc, c, idx) => acc + c / Math.pow(1 + i, idx + 1), 0);

  // Bisección sobre el interés mensual i ∈ [0, 1] (0 % a 100 % mensual).
  let lo = 0;
  let hi = 1;
  // Si ni con i=0 (suma simple) se alcanza el neto, no hay solución positiva.
  for (let iter = 0; iter < 200; iter++) {
    const mid = (lo + hi) / 2;
    const valor = vp(mid);
    if (valor > neto) {
      lo = mid; // hay que subir el interés para descontar más
    } else {
      hi = mid;
    }
    if (hi - lo < 1e-12) break;
  }
  const iMensual = (lo + hi) / 2;
  return (Math.pow(1 + iMensual, 12) - 1) * 100;
}

/**
 * TIE / tasa efectiva anual derivada directamente del TIN (sin comisiones).
 * @param {number} tinAnual  TIN anual %.
 * @returns {number} Tasa efectiva anual en %.
 */
export function tinAtae(tinAnual) {
  return (Math.pow(1 + tinAnual / 100 / 12, 12) - 1) * 100;
}

/**
 * Conversión inversa: dada una TAE (sin comisiones) obtiene el TIN equivalente.
 * @param {number} tae  TAE anual %.
 * @returns {number} TIN anual %.
 */
export function taeAtin(tae) {
  return (Math.pow(1 + tae / 100, 1 / 12) - 1) * 12 * 100;
}

// ----------------------------------------------------------------------------
//  Cálculo principal de una hipoteca
// ----------------------------------------------------------------------------

/**
 * Normaliza la configuración y resuelve el tipo aplicado y los plazos en meses
 * para cada tipo de hipoteca.
 */
function resolverTramos(cfg) {
  const tramos = [];
  if (cfg.tipo === 'fija') {
    tramos.push({ nombre: 'fijo', tinAnual: cfg.tinFija, meses: Math.round(cfg.anosFija * 12) });
  } else if (cfg.tipo === 'variable') {
    const tin = cfg.diferencialVariable + cfg.euribor;
    tramos.push({ nombre: 'variable', tinAnual: tin, meses: Math.round(cfg.anosVariable * 12) });
  } else if (cfg.tipo === 'mixta') {
    tramos.push({ nombre: 'fijo', tinAnual: cfg.tinMixtaFija, meses: Math.round(cfg.anosMixtaFija * 12) });
    tramos.push({
      nombre: 'variable',
      tinAnual: cfg.diferencialMixtaVariable + cfg.euribor,
      meses: Math.round(cfg.anosMixtaVariable * 12),
    });
  }
  return tramos;
}

/**
 * Calcula una hipoteca completa.
 *
 * @param {object} cfg  Configuración de la hipoteca:
 *   tipo: 'fija'|'variable'|'mixta'
 *   capital: number
 *   comisionAperturaPct: number  (% sobre el capital)
 *   gastosVinculadosAnuales: number  (euros/año)
 *   --- fija ---            tinFija, anosFija
 *   --- variable ---        diferencialVariable, euribor, anosVariable
 *   --- mixta ---           tinMixtaFija, anosMixtaFija,
 *                           diferencialMixtaVariable, anosMixtaVariable, euribor
 * @returns {object} Resultado detallado.
 */
export function calcularHipoteca(cfg) {
  const capital = cfg.capital;
  const tramos = resolverTramos(cfg);
  const mesesTotal = tramos.reduce((s, t) => s + t.meses, 0);

  // Para la mixta la cuota del tramo fijo se calcula amortizando el capital
  // total en el plazo TOTAL al tipo fijo (igual que un banco), y al entrar el
  // tramo variable se recalcula la cuota sobre el saldo pendiente.
  let filas = [];
  let pendiente = capital;
  let totalIntereses = 0;
  let totalPagado = 0;
  const cuotasFlujo = [];
  const detalleTramos = [];
  let mesCursor = 1;

  tramos.forEach((tramo, idx) => {
    const esUltimo = idx === tramos.length - 1;
    // Para calcular la cuota, el plazo de referencia es el que queda hasta el
    // final del préstamo (capital pendiente repartido en las cuotas restantes).
    const mesesRestantesTotales = mesesTotal - (mesCursor - 1);
    const cuota = cuotaFrancesa(pendiente, tramo.tinAnual, mesesRestantesTotales);

    const cuadro = cuadroAmortizacionTramo({
      capital: pendiente,
      tinAnual: tramo.tinAnual,
      cuota,
      // En el último tramo agotamos todas las mensualidades restantes.
      meses: esUltimo ? mesesRestantesTotales : tramo.meses,
      mesInicial: mesCursor,
      ajustarUltima: esUltimo,
    });

    filas = filas.concat(cuadro.filas);
    cuadro.filas.forEach((f) => cuotasFlujo.push(f.cuota));
    totalIntereses += cuadro.totalIntereses;
    totalPagado += cuadro.totalPagado;

    detalleTramos.push({
      nombre: tramo.nombre,
      tinAnual: tramo.tinAnual,
      meses: cuadro.filas.length,
      anos: cuadro.filas.length / 12,
      cuota,
      capitalInicio: pendiente,
      intereses: cuadro.totalIntereses,
      pagado: cuadro.totalPagado,
    });

    pendiente = cuadro.capitalFinal;
    mesCursor += cuadro.filas.length;
  });

  const comisionApertura = (capital * (cfg.comisionAperturaPct || 0)) / 100;
  const anosTotal = mesesTotal / 12;
  const gastosVinculados = (cfg.gastosVinculadosAnuales || 0) * anosTotal;

  const importeTotal = totalPagado; // capital + intereses
  const importeFinal = importeTotal + comisionApertura + gastosVinculados;
  const tae = calcularTAE(capital, comisionApertura, cuotasFlujo);

  return {
    tipo: cfg.tipo,
    capital,
    mesesTotal,
    anosTotal,
    cuotaPrimera: detalleTramos[0]?.cuota || 0,
    tramos: detalleTramos,
    totalIntereses,
    importeTotal,
    porcentajeIntereses: capital > 0 ? (totalIntereses * 100) / capital : 0,
    comisionApertura,
    gastosVinculados,
    importeFinal,
    porcentajeFinal: capital > 0 ? ((importeFinal - capital) * 100) / capital : 0,
    tae,
    filasAmortizacion: filas,
    resumenAnual: agruparPorAnos(filas),
  };
}

/**
 * Genera escenarios de Euríbor para hipotecas variables y mixtas.
 * Recalcula la hipoteca aplicando distintos incrementos al Euríbor.
 * @param {object} cfg  Configuración base.
 * @param {number[]} [deltas]  Incrementos del Euríbor en puntos (ej. [-1,0,1,2]).
 * @returns {Array|null} Lista de escenarios, o null si la hipoteca es fija.
 */
export function calcularEscenarios(cfg, deltas = [-1, -0.5, 0, 0.5, 1, 2]) {
  if (cfg.tipo === 'fija') return null;
  const base = cfg.euribor || 0;
  return deltas.map((delta) => {
    const euriborEsc = base + delta;
    const res = calcularHipoteca({ ...cfg, euribor: euriborEsc });
    // Para variable, la cuota relevante es la única; para mixta, la del tramo variable.
    const tramoVar = res.tramos.find((t) => t.nombre === 'variable');
    return {
      delta,
      euribor: euriborEsc,
      cuotaVariable: tramoVar ? tramoVar.cuota : res.cuotaPrimera,
      cuotaPrimera: res.cuotaPrimera,
      totalIntereses: res.totalIntereses,
      importeTotal: res.importeTotal,
      importeFinal: res.importeFinal,
    };
  });
}
