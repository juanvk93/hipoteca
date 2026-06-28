// ============================================================================
//  ui.js · Formateadores y renderizado de resultados (devuelve HTML)
// ============================================================================

import { graficoCapitalPendiente } from './graficos.js';

const fmtEuro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const fmtEuro0 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });

export const euro = (n) => fmtEuro.format(Number.isFinite(n) ? n : 0);
export const euro0 = (n) => fmtEuro0.format(Number.isFinite(n) ? n : 0);
export const pct = (n, d = 2) => `${(Number.isFinite(n) ? n : 0).toFixed(d).replace('.', ',')} %`;
export const num = (n) => fmtNum.format(Number.isFinite(n) ? n : 0);

/** Escapa texto para insertarlo de forma segura en HTML. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const NOMBRE_TIPO = { fija: 'Fija', variable: 'Variable', mixta: 'Mixta' };
export const nombreTipo = (t) => NOMBRE_TIPO[t] || t;

/**
 * Título y detalle de un tramo para mostrarlo en los resultados.
 * @param {string} tipo  Tipo de hipoteca ('fija'|'variable'|'mixta').
 * @param {object} t     Tramo { nombre, tinAnual, anos, meses }.
 */
export function etiquetaTramo(tipo, t) {
  if (t.nombre === 'inicial') {
    return { tit: `Primeros ${t.meses} meses`, det: `tipo de entrada · TIN ${pct(t.tinAnual)}` };
  }
  if (tipo === 'mixta') {
    return t.nombre === 'fijo'
      ? { tit: 'Tramo fijo', det: `${num(t.anos)} años · TIN ${pct(t.tinAnual)}` }
      : { tit: 'Tramo variable', det: `${num(t.anos)} años · ${pct(t.tinAnual)} (dif.+Euríbor)` };
  }
  // Fija o variable con tramo inicial: este es el "resto del plazo".
  return t.nombre === 'variable'
    ? { tit: 'Resto del plazo', det: `${num(t.anos)} años · ${pct(t.tinAnual)} (variable)` }
    : { tit: 'Resto del plazo', det: `${num(t.anos)} años · TIN ${pct(t.tinAnual)}` };
}

/** Toast efímero. */
let toastTimer = null;
export function toast(mensaje) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = mensaje;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ----------------------------------------------------------------------------
//  Render del bloque de resultados
// ----------------------------------------------------------------------------

/**
 * Construye el HTML completo de los resultados de una hipoteca.
 * @param {object} datos  { res, imp, escenarios, cfg }
 * @param {object} opts   { conGuardar: boolean }
 * @returns {string} HTML
 */
export function renderResultados({ res, imp, escenarios, bonificacion, amortizacion }, opts = {}) {
  const partes = [];

  // --- Cuota(s) principal(es) ---
  if (res.tramos.length > 1) {
    // Varios tramos (mixta, o fija/variable con tramo inicial promocional).
    const filas = res.tramos.map((t) => {
      const { tit, det } = etiquetaTramo(res.tipo, t);
      return `
        <div class="tramo">
          <div class="t-tit">${tit} <small>· ${det}</small></div>
          <div class="t-cuota">${euro(t.cuota)}<span style="font-size:1rem;color:var(--texto-2)">/mes</span></div>
        </div>`;
    }).join('');
    partes.push(`
      <div class="card">
        <h3>Cuota mensual por tramo</h3>
        ${filas}
      </div>`);
  } else {
    const tramo = res.tramos[0];
    partes.push(`
      <div class="card card-cuota">
        <div class="etq">Cuota mensual</div>
        <div class="valor">${euro(res.cuotaPrimera)}<span>/mes</span></div>
        <div class="sub">${num(res.anosTotal)} años · ${res.mesesTotal} cuotas · TIN ${pct(tramo.tinAnual)}</div>
      </div>`);
  }

  // --- Métricas clave ---
  partes.push(`
    <div class="metricas">
      <div class="metrica">
        <span class="m-etq">Total intereses</span>
        <span class="m-val neg">${euro0(res.totalIntereses)}</span>
        <span class="m-extra">+${pct(res.porcentajeIntereses)} sobre el capital</span>
      </div>
      <div class="metrica">
        <span class="m-etq">Total a pagar</span>
        <span class="m-val">${euro0(res.importeTotal)}</span>
        <span class="m-extra">capital + intereses</span>
      </div>
      <div class="metrica">
        <span class="m-etq">TAE estimada</span>
        <span class="m-val">${pct(res.tae)}</span>
        <span class="m-extra">${res.comisionApertura > 0 ? 'incluye comisión' : 'sin comisiones'}</span>
      </div>
      <div class="metrica">
        <span class="m-etq">Coste total</span>
        <span class="m-val">${euro0(res.importeFinal)}</span>
        <span class="m-extra">+ comisión y vinculados</span>
      </div>
    </div>`);

  // --- Desglose económico ---
  partes.push(`
    <div class="card">
      <h3>Desglose del préstamo</h3>
      <div class="kv"><span class="k">Capital solicitado</span><span class="v">${euro(res.capital)}</span></div>
      <div class="kv"><span class="k">Intereses totales</span><span class="v">${euro(res.totalIntereses)}</span></div>
      <div class="kv"><span class="k">Importe total (capital + intereses)</span><span class="v">${euro(res.importeTotal)}</span></div>
      ${res.comisionApertura > 0 ? `<div class="kv"><span class="k">Comisión de apertura</span><span class="v">${euro(res.comisionApertura)}</span></div>` : ''}
      ${res.gastosVinculados > 0 ? `<div class="kv"><span class="k">Gastos vinculados <small>(${num(res.anosTotal)} años)</small></span><span class="v">${euro(res.gastosVinculados)}</span></div>` : ''}
      <div class="kv total"><span class="k">Coste total a reembolsar</span><span class="v">${euro(res.importeFinal)}</span></div>
    </div>`);

  // --- ¿Compensa la bonificación? ---
  if (bonificacion) {
    partes.push(renderBonificacion(bonificacion));
  }

  // --- Amortización anticipada ---
  if (amortizacion) {
    partes.push(renderAmortizacionAnticipada(amortizacion));
  }

  // --- Escenarios de Euríbor (variable / mixta) ---
  if (escenarios && escenarios.length) {
    partes.push(renderEscenarios(escenarios, res.tipo));
  }

  // --- Impuestos y gastos de compra ---
  if (imp) {
    partes.push(renderImpuestos(imp, res));
  }

  // --- Cuadro de amortización (de la simulación si hay aportaciones extra) ---
  const fuente = amortizacion
    ? { filas: amortizacion.filas, resumenAnual: amortizacion.resumenAnual }
    : { filas: res.filasAmortizacion, resumenAnual: res.resumenAnual };

  // --- Gráfico de evolución del capital pendiente ---
  partes.push(`
    <div class="card card-grafico">
      <h3>Evolución del capital pendiente</h3>
      ${graficoCapitalPendiente(fuente.resumenAnual, res.capital)}
    </div>`);

  partes.push(renderAmortizacion(fuente, !!amortizacion));

  // --- Acciones ---
  if (opts.conGuardar) {
    partes.push(`
      <div class="btn-fila">
        <button type="button" class="btn-secundario" id="btnNuevoCalculo">Nuevo</button>
        <button type="button" class="btn-principal" id="btnGuardar" style="margin:0">Guardar hipoteca</button>
      </div>`);
  }

  return partes.join('');
}

function renderEscenarios(escenarios, tipo) {
  const filas = escenarios.map((e) => {
    const esBase = e.delta === 0;
    const cls = esBase ? 'destacado' : '';
    const deltaTxt = e.delta === 0 ? 'Actual' : (e.delta > 0 ? `+${num(e.delta)}` : num(e.delta));
    const deltaCls = e.delta > 0 ? 'delta-pos' : (e.delta < 0 ? 'delta-neg' : 'escenario-base');
    return `
      <tr class="${cls}">
        <td><span class="${deltaCls}">${deltaTxt}</span></td>
        <td>${pct(e.euribor)}</td>
        <td>${euro0(e.cuotaVariable)}</td>
        <td>${euro0(e.importeTotal)}</td>
      </tr>`;
  }).join('');

  return `
    <div class="card">
      <h3>Escenarios de Euríbor</h3>
      <p class="muted" style="margin:-6px 0 12px">Cómo cambia ${tipo === 'mixta' ? 'la cuota del tramo variable' : 'tu cuota'} y el total según evolucione el Euríbor.</p>
      <div class="tabla-scroll">
        <table class="tabla">
          <thead><tr><th>Variación</th><th>Euríbor</th><th>Cuota</th><th>Total</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    </div>`;
}

function renderBonificacion(b) {
  const bon = b.bonificado;
  const sin = b.sinBonificar;
  const compensa = b.compensa;
  return `
    <div class="card">
      <h3>¿Compensa la bonificación?</h3>
      <p class="muted" style="margin:-6px 0 12px">Coste total contratando los productos (TIN reducido) frente a no contratarlos (TIN +${pct(b.incremento)}).</p>
      <div class="comparativa2">
        <div class="opcion ${compensa ? 'mejor-opcion' : ''}">
          <span class="o-tit">Bonificada</span>
          <span class="o-val">${euro0(bon.importeFinal)}</span>
          <div class="o-sub">cuota ${euro0(bon.cuotaPrimera)} · incl. productos</div>
        </div>
        <div class="opcion ${!compensa ? 'mejor-opcion' : ''}">
          <span class="o-tit">Sin bonificar</span>
          <span class="o-val">${euro0(sin.importeFinal)}</span>
          <div class="o-sub">cuota ${euro0(sin.cuotaPrimera)} · sin productos</div>
        </div>
      </div>
      <div class="veredicto ${compensa ? 'si' : 'no'}">
        ${compensa
          ? `Compensa bonificar: ahorras ${euro(b.diferencia)}`
          : `No compensa: bonificar cuesta ${euro(b.diferencia)} más`}
      </div>
    </div>`;
}

function renderAmortizacionAnticipada(a) {
  const modoTxt = a.modo === 'plazo' ? 'reducir plazo' : 'reducir cuota';
  const filasMeses = a.mesesAhorrados > 0
    ? `<div class="kv"><span class="k">Plazo</span><span class="v">${a.mesesReales} meses <small>(−${a.mesesAhorrados})</small></span></div>`
    : `<div class="kv"><span class="k">Cuota final</span><span class="v">${euro(a.cuotaFinal)} <small>(desde ${euro0(a.cuotaInicial)})</small></span></div>`;
  return `
    <div class="card">
      <h3>Amortización anticipada · ${modoTxt}</h3>
      <div class="metricas" style="margin-bottom:12px">
        <div class="metrica">
          <span class="m-etq">Ahorro en intereses</span>
          <span class="m-val pos">${euro0(a.ahorroIntereses)}</span>
        </div>
        <div class="metrica">
          <span class="m-etq">${a.mesesAhorrados > 0 ? 'Tiempo ahorrado' : 'Cuota nueva'}</span>
          <span class="m-val">${a.mesesAhorrados > 0 ? `${(a.mesesAhorrados / 12).toFixed(1)} años` : euro0(a.cuotaFinal)}</span>
        </div>
      </div>
      <div class="kv"><span class="k">Aportado de más (capital)</span><span class="v">${euro(a.totalExtra)}</span></div>
      ${filasMeses}
      ${a.totalComisiones > 0 ? `<div class="kv"><span class="k">Comisión por amortizar</span><span class="v">${euro(a.totalComisiones)}</span></div>` : ''}
      <div class="kv total"><span class="k">Intereses totales con amortización</span><span class="v">${euro(a.totalIntereses)}</span></div>
    </div>`;
}

function renderImpuestos(imp, res) {
  const lineaImpuesto = imp.obraNueva
    ? `<div class="kv"><span class="k">IVA <small>(${pct(imp.ivaPct)})</small></span><span class="v">${euro(imp.valorIVA)}</span></div>`
    : `<div class="kv"><span class="k">ITP <small>(${pct(imp.itpPct)})</small></span><span class="v">${euro(imp.valorITP)}</span></div>`;

  const costeTotalReal = imp.valorInmueble + imp.impuestosTotales + res.totalIntereses + res.comisionApertura + res.gastosVinculados;

  return `
    <div class="card">
      <h3>Impuestos y gastos de compra · ${esc(imp.ccaa)}</h3>
      ${lineaImpuesto}
      <div class="kv"><span class="k">AJD <small>(${pct(imp.ajdPct)})</small></span><span class="v">${euro(imp.valorAJD)}</span></div>
      <div class="kv"><span class="k">Notaría + Registro + Gestoría</span><span class="v">${euro(imp.gastosFijos)}</span></div>
      <div class="kv total"><span class="k">Total impuestos y gastos</span><span class="v">${euro(imp.impuestosTotales)} <small>(${pct(imp.porcentaje)})</small></span></div>
      <div style="height:14px"></div>
      <div class="kv"><span class="k">Entrada <small>(precio − hipoteca)</small></span><span class="v">${euro(imp.entrada)}</span></div>
      <div class="kv"><span class="k">Ahorro necesario <small>(entrada + gastos + comisión)</small></span><span class="v" style="color:var(--aviso)">${euro(imp.ahorroNecesario)}</span></div>
      <div class="kv total"><span class="k">Coste total real <small>(vivienda + gastos + intereses)</small></span><span class="v">${euro(costeTotalReal)}</span></div>
    </div>`;
}

function renderAmortizacion(fuente, conExtra) {
  const filasAnual = fuente.resumenAnual.map((a) => `
    <tr>
      <td>Año ${a.ano}</td>
      <td>${euro0(a.cuota)}</td>
      <td>${euro0(a.interes)}</td>
      <td>${euro0(a.amortizado)}</td>
      <td>${euro0(a.pendiente)}</td>
    </tr>`).join('');

  const filasMes = fuente.filas.map((f) => `
    <tr${f.extra > 0 ? ' class="destacado"' : ''}>
      <td>${f.mes}</td>
      <td>${euro0(f.cuota)}</td>
      <td>${euro0(f.interes)}</td>
      <td>${euro0(f.amortizado)}</td>
      <td>${euro0(f.pendiente)}</td>
    </tr>`).join('');

  return `
    <details class="acordeon">
      <summary>
        <span>Cuadro de amortización <em>(modelo francés${conExtra ? ', con aportaciones' : ''})</em></span>
        <svg class="chevron" viewBox="0 0 24 24" width="20" height="20"><path d="M8 10l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </summary>
      <div class="acordeon-cuerpo">
        <div class="cuadro-acciones">
          <div class="segmented compacto seg-opciones" id="cuadroVista">
            <button type="button" class="seg activa" data-cuadro="anual">Anual</button>
            <button type="button" class="seg" data-cuadro="mensual">Mensual</button>
          </div>
          <button type="button" class="btn-csv" id="btnExportCuadro">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
        </div>
        <div class="tabla-scroll" id="cuadroAnual">
          <table class="tabla">
            <thead><tr><th>Periodo</th><th>Cuota</th><th>Intereses</th><th>Amortizado</th><th>Pendiente</th></tr></thead>
            <tbody>${filasAnual}</tbody>
          </table>
        </div>
        <div class="tabla-scroll" id="cuadroMensual" hidden>
          <table class="tabla">
            <thead><tr><th>Mes</th><th>Cuota</th><th>Intereses</th><th>Amortizado</th><th>Pendiente</th></tr></thead>
            <tbody>${filasMes}</tbody>
          </table>
        </div>
      </div>
    </details>`;
}

// ----------------------------------------------------------------------------
//  Render de la lista de hipotecas guardadas
// ----------------------------------------------------------------------------

export function renderTarjetaGuardada(h) {
  const r = h.resumen || {};
  const fecha = h.creada ? new Date(h.creada).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const multi = (r.numTramos ?? (r.tipo === 'mixta' ? 2 : 1)) > 1;
  const cuotaB = r.cuotaSegunda ?? r.cuotaVariable ?? r.cuotaPrimera;
  const cuotaTxt = multi ? `${euro0(r.cuotaPrimera)} → ${euro0(cuotaB)}` : euro0(r.cuotaPrimera);
  return `
    <div class="tarjeta-hipo" data-id="${h.id}">
      <div class="th-top">
        <div>
          <div class="th-nombre">${esc(h.nombre)}</div>
          <div class="th-meta">${euro0(r.capital)} · ${num(r.anosTotal)} años · ${fecha}</div>
        </div>
        <span class="th-badge ${r.tipo}">${nombreTipo(r.tipo)}</span>
      </div>
      <div class="th-grid">
        <div><span class="e">Cuota</span><span class="v">${cuotaTxt}</span></div>
        <div><span class="e">Intereses</span><span class="v">${euro0(r.totalIntereses)}</span></div>
        <div><span class="e">TAE</span><span class="v">${pct(r.tae)}</span></div>
      </div>
      <div class="th-acciones">
        <button type="button" data-accion="ver">Ver detalle</button>
        <button type="button" data-accion="borrar" class="peligro">Borrar</button>
      </div>
    </div>`;
}

export function estadoVacio(titulo, svg) {
  return `<div class="vacio">${svg || ''}<p>${esc(titulo)}</p></div>`;
}
