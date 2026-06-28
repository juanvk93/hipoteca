// ============================================================================
//  ui.js · Formateadores y renderizado de resultados (devuelve HTML)
// ============================================================================

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
export function renderResultados({ res, imp, escenarios }, opts = {}) {
  const partes = [];

  // --- Cuota(s) principal(es) ---
  if (res.tipo === 'mixta') {
    const fijo = res.tramos.find((t) => t.nombre === 'fijo');
    const variable = res.tramos.find((t) => t.nombre === 'variable');
    partes.push(`
      <div class="card">
        <h3>Cuota mensual por tramo</h3>
        <div class="tramo">
          <div class="t-tit">Tramo fijo <small>· ${num(fijo.anos)} años · TIN ${pct(fijo.tinAnual)}</small></div>
          <div class="t-cuota">${euro(fijo.cuota)}<span style="font-size:1rem;color:var(--texto-2)">/mes</span></div>
        </div>
        <div class="tramo">
          <div class="t-tit">Tramo variable <small>· ${num(variable.anos)} años · ${pct(variable.tinAnual)} (dif.+Euríbor)</small></div>
          <div class="t-cuota">${euro(variable.cuota)}<span style="font-size:1rem;color:var(--texto-2)">/mes</span></div>
        </div>
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

  // --- Escenarios de Euríbor (variable / mixta) ---
  if (escenarios && escenarios.length) {
    partes.push(renderEscenarios(escenarios, res.tipo));
  }

  // --- Impuestos y gastos de compra ---
  if (imp) {
    partes.push(renderImpuestos(imp, res));
  }

  // --- Cuadro de amortización ---
  partes.push(renderAmortizacion(res));

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

function renderAmortizacion(res) {
  const filas = res.resumenAnual.map((a) => `
    <tr>
      <td>Año ${a.ano}</td>
      <td>${euro0(a.cuota)}</td>
      <td>${euro0(a.interes)}</td>
      <td>${euro0(a.amortizado)}</td>
      <td>${euro0(a.pendiente)}</td>
    </tr>`).join('');

  return `
    <details class="acordeon">
      <summary>
        <span>Cuadro de amortización <em>(modelo francés, resumen anual)</em></span>
        <svg class="chevron" viewBox="0 0 24 24" width="20" height="20"><path d="M8 10l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </summary>
      <div class="acordeon-cuerpo" style="padding-left:0;padding-right:0">
        <div class="tabla-scroll">
          <table class="tabla">
            <thead><tr><th>Periodo</th><th>Cuota</th><th>Intereses</th><th>Amortizado</th><th>Pendiente</th></tr></thead>
            <tbody>${filas}</tbody>
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
  const cuotaTxt = r.tipo === 'mixta'
    ? `${euro0(r.cuotaPrimera)} → ${euro0(r.cuotaVariable)}`
    : `${euro0(r.cuotaPrimera)}`;
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
