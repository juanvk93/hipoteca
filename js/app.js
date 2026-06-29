// ============================================================================
//  app.js · Controlador principal de la PWA (navegación, eventos, orquestación)
// ============================================================================

import { calcularHipoteca, calcularEscenarios, calcularBonificacion, simularAmortizacionAnticipada, deducirCosteProductos } from './calculos.js';
import { calcularImpuestos, CCAA, CCAA_MADRID } from './impuestos.js';
import { fetchEuriborBCE, fetchHistoricoEuribor, resolverEuribor, formatearPeriodo, leerEuriborCache } from './euribor.js';
import {
  AJUSTES_DEFAULT, cargarAjustes, guardarAjustes,
  guardarHipoteca, actualizarHipoteca, listarHipotecas, obtenerHipoteca, borrarHipoteca,
  solicitarPersistencia, infoAlmacenamiento, exportarTodo, importarHipotecas,
} from './db.js';
import {
  renderResultados, renderTarjetaGuardada, estadoVacio,
  euro, euro0, pct, num, nombreTipo, esc, toast,
} from './ui.js';
import { VERSION, CAMBIOS } from './changelog.js';
import { graficoComparador, graficoHistoricoEuribor } from './graficos.js';

// Colores de acento disponibles.
const ACENTOS = ['#3d8bff', '#22c55e', '#a855f7', '#ef4444', '#f59e0b', '#14b8a6', '#ec4899', '#6366f1'];

// ---------------------------------------------------------------------------
//  Estado de la aplicación
// ---------------------------------------------------------------------------
const estado = {
  ajustes: { ...AJUSTES_DEFAULT },
  tipo: 'fija',
  euribor: null,         // valor numérico actual del Euríbor a aplicar
  euriborInfo: { fuente: 'desconocido', periodo: '' },
  ultimoResultado: null, // { cfg, datosVivienda, res, imp, escenarios }
  editandoId: null,      // id de la hipoteca que se está editando (o null)
  seleccionComparar: new Set(),
  historicoEuribor: null, // caché del histórico del BCE
};

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

// ---------------------------------------------------------------------------
//  Utilidades
// ---------------------------------------------------------------------------
function leerNum(id) {
  const el = document.getElementById(id);
  if (!el || el.value === '') return null;
  const n = parseFloat(String(el.value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function hexARgb(hex) {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return '61, 139, 255';
  const [r, g, b] = m.map((x) => parseInt(x, 16));
  return `${r}, ${g}, ${b}`;
}

// ---------------------------------------------------------------------------
//  Tema y acento
// ---------------------------------------------------------------------------
function aplicarTema() {
  document.documentElement.setAttribute('data-tema', estado.ajustes.tema);
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', estado.ajustes.tema === 'claro' ? '#f3f5f8' : '#0f1115');
  $$('#segTema .seg').forEach((b) => b.classList.toggle('activa', b.dataset.tema === estado.ajustes.tema));
}

function aplicarAcento() {
  document.documentElement.style.setProperty('--acento', estado.ajustes.acento);
  document.documentElement.style.setProperty('--acento-rgb', hexARgb(estado.ajustes.acento));
  $$('#acentos .acento-opt').forEach((o) => o.classList.toggle('sel', o.dataset.color === estado.ajustes.acento));
}

async function persistirAjustes() {
  try { await guardarAjustes(estado.ajustes); } catch { /* ignorar */ }
}

// ---------------------------------------------------------------------------
//  Navegación
// ---------------------------------------------------------------------------
const TITULOS = { calcular: 'Calcular', guardadas: 'Guardadas', comparar: 'Comparar', ajustes: 'Ajustes' };

function navegar(vista) {
  $$('.vista').forEach((v) => v.classList.toggle('activa', v.id === `vista-${vista}`));
  $$('.nav-item').forEach((n) => n.classList.toggle('activa', n.dataset.vista === vista));
  $('#tituloVista').textContent = TITULOS[vista] || '';
  window.scrollTo({ top: 0, behavior: 'auto' });

  if (vista === 'guardadas') pintarGuardadas();
  if (vista === 'comparar') pintarComparador();
  if (vista === 'ajustes') { refrescarAlmacenamiento(); cargarGraficoEuribor(); }
}

// Carga (y cachea) el histórico del Euríbor y lo dibuja en Ajustes.
async function cargarGraficoEuribor(forzar = false) {
  const cont = $('#graficoEuribor');
  if (!cont) return;
  if (estado.historicoEuribor && !forzar) {
    cont.innerHTML = graficoHistoricoEuribor(estado.historicoEuribor);
    return;
  }
  cont.innerHTML = '<p class="muted" style="margin-top:12px">Cargando histórico…</p>';
  try {
    const puntos = await fetchHistoricoEuribor(24);
    estado.historicoEuribor = puntos;
    cont.innerHTML = graficoHistoricoEuribor(puntos);
  } catch {
    cont.innerHTML = '<p class="muted" style="margin-top:12px">No se pudo cargar el histórico (sin conexión).</p>';
  }
}

// ---------------------------------------------------------------------------
//  Euríbor
// ---------------------------------------------------------------------------
function actualizarChipEuribor() {
  const chip = $('#chipEuriborValor');
  if (estado.euribor == null) {
    chip.textContent = 'n/d';
    return;
  }
  chip.textContent = pct(estado.euribor);
}

function prellenarEuriborEnFormulario() {
  if (estado.euribor == null) return;
  // Solo rellena si el usuario no ha escrito ya un valor.
  ['euriborVariable', 'euriborMixta'].forEach((id) => {
    const el = document.getElementById(id);
    if (el && el.value === '') el.value = String(estado.euribor);
  });
}

function fijarEuribor(valor, info) {
  estado.euribor = valor;
  estado.euriborInfo = info;
  actualizarChipEuribor();
  prellenarEuriborEnFormulario();
  // Texto en ajustes.
  const auto = $('#ajusteEuriborAuto');
  if (auto) {
    const cache = leerEuriborCache();
    auto.textContent = cache
      ? `${pct(cache.valor)}${cache.periodo ? ` · ${formatearPeriodo(cache.periodo)}` : ''}`
      : 'no disponible';
  }
}

async function inicializarEuribor() {
  // 1) Valor inmediato (manual o caché).
  const resuelto = resolverEuribor(estado.ajustes);
  fijarEuribor(resuelto.valor, { fuente: resuelto.fuente, periodo: resuelto.periodo });

  // 2) Actualización en segundo plano desde el BCE (si no se usa manual).
  if (!estado.ajustes.usarEuriborManual) {
    try {
      const bce = await fetchEuriborBCE();
      if (!estado.ajustes.usarEuriborManual) {
        fijarEuribor(bce.valor, { fuente: 'BCE', periodo: bce.periodo });
      }
    } catch {
      /* sin conexión: nos quedamos con la caché */
    }
  }
}

// ---------------------------------------------------------------------------
//  Formulario → configuración
// ---------------------------------------------------------------------------
function leerFormulario() {
  const cfg = {
    tipo: estado.tipo,
    capital: leerNum('capital') || 0,
    comisionAperturaPct: leerNum('comisionApertura') || 0,
    gastosVinculadosAnuales: leerNum('gastosVinculados') || 0,
  };

  if (estado.tipo === 'fija') {
    cfg.tinFija = leerNum('tinFija') || 0;
    cfg.anosFija = leerNum('anosFija') || 0;
    if ($('#promoFijaActiva').checked) {
      cfg.promoActiva = true;
      cfg.promoMeses = leerNum('promoFijaMeses') || 0;
      cfg.promoTin = leerNum('promoFijaTin') || 0;
    }
  } else if (estado.tipo === 'variable') {
    cfg.diferencialVariable = leerNum('diferencialVariable') || 0;
    cfg.euribor = leerNum('euriborVariable') ?? estado.euribor ?? 0;
    cfg.anosVariable = leerNum('anosVariable') || 0;
    if ($('#promoVariableActiva').checked) {
      cfg.promoActiva = true;
      cfg.promoMeses = leerNum('promoVariableMeses') || 0;
      cfg.promoTin = leerNum('promoVariableTin') || 0;
    }
  } else if (estado.tipo === 'mixta') {
    cfg.tinMixtaFija = leerNum('tinMixtaFija') || 0;
    cfg.anosMixtaFija = leerNum('anosMixtaFija') || 0;
    cfg.diferencialMixtaVariable = leerNum('diferencialMixtaVariable') || 0;
    cfg.euribor = leerNum('euriborMixta') ?? estado.euribor ?? 0;
    cfg.anosMixtaVariable = leerNum('anosMixtaVariable') || 0;
  }

  // Bonificación (productos vinculados).
  if ($('#bonifActiva').checked) {
    cfg.bonifActiva = true;
    cfg.bonifIncremento = leerNum('bonifIncremento') || 0;
  }

  // TAE del banco → deducir coste de productos.
  if ($('#taeActiva').checked) {
    cfg.taeActiva = true;
    cfg.taeObjetivo = leerNum('taeObjetivo') || 0;
  }

  // Datos de vivienda (opcionales).
  const valorInmueble = leerNum('valorInmueble');
  let datosVivienda = null;
  if (valorInmueble && valorInmueble > 0) {
    datosVivienda = {
      valorInmueble,
      ccaaId: parseInt($('#ccaa').value, 10) || CCAA_MADRID,
      obraNueva: $('#obraNueva').checked,
      viviendaHabitual: $('#viviendaHabitual').checked,
    };
  }

  // Amortización anticipada (opcional).
  let amort = null;
  if ($('#amortActiva').checked) {
    const periodicidad = $('#amortPeriodicidad .seg.activa')?.dataset.period || 'unica';
    const modo = $('#amortModo .seg.activa')?.dataset.modo || 'plazo';
    amort = {
      importe: leerNum('amortImporte') || 0,
      periodicidad,
      modo,
      comisionPct: leerNum('amortComision') || 0,
    };
    const mesVal = leerNum('amortMes') || (periodicidad === 'unica' ? 12 : 1);
    if (periodicidad === 'unica') amort.mes = mesVal;
    else amort.desde = mesVal;
  }

  return { cfg, datosVivienda, amort };
}

function validarConfig(cfg) {
  if (!cfg.capital || cfg.capital <= 0) return 'Introduce el capital solicitado.';
  if (cfg.tipo === 'fija') {
    if (cfg.tinFija == null || cfg.tinFija < 0) return 'Introduce el TIN.';
    if (!cfg.anosFija || cfg.anosFija <= 0) return 'Introduce el plazo en años.';
  } else if (cfg.tipo === 'variable') {
    if (!cfg.anosVariable || cfg.anosVariable <= 0) return 'Introduce el plazo en años.';
    if (cfg.euribor == null) return 'No hay valor de Euríbor. Introdúcelo o configúralo en Ajustes.';
  } else if (cfg.tipo === 'mixta') {
    if (!cfg.anosMixtaFija || cfg.anosMixtaFija <= 0) return 'Introduce los años del tramo fijo.';
    if (!cfg.anosMixtaVariable || cfg.anosMixtaVariable <= 0) return 'Introduce los años del tramo variable.';
    if (cfg.euribor == null) return 'No hay valor de Euríbor. Introdúcelo o configúralo en Ajustes.';
  }
  // Validación del tramo inicial promocional (fija / variable).
  if (cfg.promoActiva) {
    const totalMeses = Math.round(((cfg.tipo === 'fija' ? cfg.anosFija : cfg.anosVariable) || 0) * 12);
    if (!cfg.promoMeses || cfg.promoMeses <= 0) return 'Indica los meses del tramo inicial.';
    if (cfg.promoMeses >= totalMeses) return 'Los meses del tramo inicial deben ser menores que el plazo total.';
  }
  return null;
}

function construirResumen(res, imp) {
  const variable = res.tramos.find((t) => t.nombre === 'variable');
  const ultimo = res.tramos[res.tramos.length - 1];
  return {
    tipo: res.tipo,
    capital: res.capital,
    anosTotal: res.anosTotal,
    cuotaPrimera: res.cuotaPrimera,
    numTramos: res.tramos.length,
    cuotaSegunda: ultimo ? ultimo.cuota : res.cuotaPrimera,
    cuotaVariable: variable ? variable.cuota : res.cuotaPrimera,
    totalIntereses: res.totalIntereses,
    importeTotal: res.importeTotal,
    importeFinal: res.importeFinal,
    comisionApertura: res.comisionApertura,
    tae: res.tae,
    ahorroNecesario: imp ? imp.ahorroNecesario : null,
    impuestosTotales: imp ? imp.impuestosTotales : null,
  };
}

function calcularYMostrar() {
  const { cfg, datosVivienda, amort } = leerFormulario();
  const error = validarConfig(cfg);
  if (error) { toast(error); return; }

  const res = calcularHipoteca(cfg);
  const escenarios = calcularEscenarios(cfg);
  let imp = null;
  if (datosVivienda) {
    imp = calcularImpuestos({
      valorInmueble: datosVivienda.valorInmueble,
      capital: cfg.capital,
      comisionApertura: res.comisionApertura,
      ccaaId: datosVivienda.ccaaId,
      obraNueva: datosVivienda.obraNueva,
      viviendaHabitual: datosVivienda.viviendaHabitual,
    });
  }
  const bonificacion = cfg.bonifActiva ? calcularBonificacion(cfg) : null;
  const amortizacion = amort && amort.importe > 0 ? simularAmortizacionAnticipada(cfg, amort) : null;
  const costeProductos = cfg.taeActiva && cfg.taeObjetivo > 0 ? deducirCosteProductos(cfg, cfg.taeObjetivo) : null;

  estado.ultimoResultado = { cfg, datosVivienda, amort, res, imp, escenarios, bonificacion, amortizacion, costeProductos };

  const cont = $('#resultados');
  cont.innerHTML = renderResultados({ res, imp, escenarios, bonificacion, amortizacion, costeProductos }, { conGuardar: true });
  // Eventos de los botones y controles recién renderizados.
  $('#btnGuardar')?.addEventListener('click', abrirModalGuardar);
  $('#btnNuevoCalculo')?.addEventListener('click', nuevoCalculo);
  $('#btnUsarCoste')?.addEventListener('click', usarCosteEnGastosVinculados);
  bindControlesCuadro(cont);
  cont.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Copia el coste de productos deducido del TAE al campo «Gastos vinculados» y recalcula.
function usarCosteEnGastosVinculados() {
  const cp = estado.ultimoResultado?.costeProductos;
  if (!cp || !cp.hayProductos) return;
  const el = document.getElementById('gastosVinculados');
  if (el) el.value = String(Math.round(cp.costeAnual));
  toast('Coste aplicado a gastos vinculados');
  calcularYMostrar();
}

function nuevoCalculo() {
  estado.editandoId = null;
  estado.ultimoResultado = null;
  $('#formHipoteca').reset();
  $('#resultados').innerHTML = '';
  // Restablece el tipo a fija.
  cambiarTipo('fija');
  sincronizarPromoUI();
  sincronizarOpcionalesUI();
  // Restablece los segmented de la amortización a sus valores por defecto.
  $$('#amortPeriodicidad .seg').forEach((s) => s.classList.toggle('activa', s.dataset.period === 'unica'));
  $$('#amortModo .seg').forEach((s) => s.classList.toggle('activa', s.dataset.modo === 'plazo'));
  actualizarLabelMes('unica');
  prellenarEuriborEnFormulario();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------------------------------------------------------------------------
//  Tipo de hipoteca (segmented control)
// ---------------------------------------------------------------------------
function cambiarTipo(tipo) {
  estado.tipo = tipo;
  $$('.segmented .seg[data-tipo]').forEach((b) => b.classList.toggle('activa', b.dataset.tipo === tipo));
  $$('.grupo-tipo').forEach((g) => g.classList.toggle('oculto', g.dataset.grupo !== tipo));
}

// Muestra u oculta los campos del tramo inicial según el estado de su toggle.
function sincronizarPromoUI() {
  const f = $('#promoFijaActiva');
  const v = $('#promoVariableActiva');
  $('#promoFijaCampos').classList.toggle('oculto', !(f && f.checked));
  $('#promoVariableCampos').classList.toggle('oculto', !(v && v.checked));
}

// Muestra u oculta las secciones opcionales (bonificación, amortización, TAE).
function sincronizarOpcionalesUI() {
  $('#bonifCampos').classList.toggle('oculto', !$('#bonifActiva').checked);
  $('#amortCampos').classList.toggle('oculto', !$('#amortActiva').checked);
  $('#taeCampos').classList.toggle('oculto', !$('#taeActiva').checked);
}

// Etiqueta del campo "mes" según la periodicidad de la amortización.
function actualizarLabelMes(period) {
  const label = $('#amortMesLabel');
  if (label) label.textContent = period === 'unica' ? 'Mes de la aportación' : 'A partir del mes';
}

// Descarga un contenido como archivo (CSV, JSON…).
function descargarArchivo(contenido, nombre, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Conmutador anual/mensual del cuadro y exportación a CSV.
function bindControlesCuadro(cont) {
  $$('#cuadroVista .seg', cont).forEach((b) => b.addEventListener('click', () => {
    $$('#cuadroVista .seg', cont).forEach((s) => s.classList.toggle('activa', s === b));
    const mensual = b.dataset.cuadro === 'mensual';
    const anualEl = $('#cuadroAnual', cont);
    const mensualEl = $('#cuadroMensual', cont);
    if (anualEl) anualEl.hidden = mensual;
    if (mensualEl) mensualEl.hidden = !mensual;
  }));
  $('#btnExportCuadro', cont)?.addEventListener('click', exportarCuadroCSV);
}

function exportarCuadroCSV() {
  const r = estado.ultimoResultado;
  if (!r) return;
  const filas = r.amortizacion ? r.amortizacion.filas : r.res.filasAmortizacion;
  const lineas = ['Mes;Cuota;Intereses;Amortizado;Pendiente'];
  for (const f of filas) {
    // Formato español: coma decimal y punto y coma como separador.
    lineas.push([f.mes, f.cuota.toFixed(2), f.interes.toFixed(2), f.amortizado.toFixed(2), f.pendiente.toFixed(2)].join(';').replace(/\./g, ','));
  }
  descargarArchivo('﻿' + lineas.join('\n'), 'amortizacion.csv', 'text/csv;charset=utf-8;');
  toast('Cuadro exportado (CSV)');
}

// ---------------------------------------------------------------------------
//  Guardar / editar hipoteca
// ---------------------------------------------------------------------------
function pedirTexto(titulo, valorInicial = '') {
  return new Promise((resolve) => {
    const fondo = document.createElement('div');
    fondo.className = 'modal-fondo';
    fondo.innerHTML = `
      <div class="modal">
        <h3>${esc(titulo)}</h3>
        <input type="text" id="modalInput" placeholder="Ej: BBVA fija 30 años" value="${esc(valorInicial)}" />
        <div class="btn-fila" style="margin-top:0">
          <button type="button" class="btn-secundario" id="modalCancelar">Cancelar</button>
          <button type="button" class="btn-principal" id="modalAceptar" style="margin:0">Guardar</button>
        </div>
      </div>`;
    document.body.appendChild(fondo);
    requestAnimationFrame(() => fondo.classList.add('show'));
    const input = $('#modalInput', fondo);
    input.focus();
    input.select();

    const cerrar = (valor) => {
      fondo.classList.remove('show');
      setTimeout(() => fondo.remove(), 200);
      resolve(valor);
    };
    $('#modalCancelar', fondo).addEventListener('click', () => cerrar(null));
    $('#modalAceptar', fondo).addEventListener('click', () => cerrar(input.value.trim() || titulo));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') cerrar(input.value.trim() || titulo); });
    fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(null); });
  });
}

async function abrirModalGuardar() {
  if (!estado.ultimoResultado) return;
  const { cfg, datosVivienda, res, imp } = estado.ultimoResultado;
  const nombreSugerido = `Hipoteca ${nombreTipo(cfg.tipo).toLowerCase()} ${num(res.anosTotal)} años`;
  const nombre = await pedirTexto(estado.editandoId ? 'Actualizar hipoteca' : 'Guardar hipoteca', nombreSugerido);
  if (nombre == null) return;

  const registro = {
    nombre,
    config: cfg,
    datosVivienda,
    amort: estado.ultimoResultado.amort || null,
    resumen: construirResumen(res, imp),
    creada: Date.now(),
  };

  try {
    if (estado.editandoId) {
      registro.id = estado.editandoId;
      const prev = await obtenerHipoteca(estado.editandoId);
      if (prev) registro.creada = prev.creada;
      await actualizarHipoteca(registro);
      toast('Hipoteca actualizada');
    } else {
      await guardarHipoteca(registro);
      toast('Hipoteca guardada');
    }
    estado.editandoId = null;
  } catch (e) {
    toast('No se pudo guardar');
  }
}

// ---------------------------------------------------------------------------
//  Vista: Guardadas
// ---------------------------------------------------------------------------
const SVG_VACIO_GUARDADAS = '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';

async function pintarGuardadas() {
  const cont = $('#listaGuardadas');
  let lista;
  try { lista = await listarHipotecas(); } catch { lista = []; }
  if (!lista.length) {
    cont.innerHTML = estadoVacio('No tienes hipotecas guardadas todavía. Calcula una y pulsa «Guardar».', SVG_VACIO_GUARDADAS);
    return;
  }
  cont.innerHTML = lista.map(renderTarjetaGuardada).join('');
  $$('.tarjeta-hipo', cont).forEach((tarjeta) => {
    const id = Number(tarjeta.dataset.id);
    $('[data-accion="ver"]', tarjeta)?.addEventListener('click', () => verGuardada(id));
    $('[data-accion="borrar"]', tarjeta)?.addEventListener('click', () => confirmarBorrado(id, tarjeta));
  });
}

async function verGuardada(id) {
  const h = await obtenerHipoteca(id);
  if (!h) return;
  aplicarConfigAlFormulario(h.config, h.datosVivienda, h.amort);
  estado.editandoId = id;
  navegar('calcular');
  calcularYMostrar();
  toast(`Editando «${h.nombre}»`);
}

async function confirmarBorrado(id, tarjeta) {
  const h = await obtenerHipoteca(id);
  const ok = confirm(`¿Borrar «${h?.nombre || 'esta hipoteca'}»?`);
  if (!ok) return;
  await borrarHipoteca(id);
  estado.seleccionComparar.delete(id);
  tarjeta.remove();
  toast('Hipoteca borrada');
  if (!$$('.tarjeta-hipo').length) pintarGuardadas();
}

function aplicarConfigAlFormulario(cfg, datosVivienda, amort) {
  cambiarTipo(cfg.tipo);
  // Los <input type="number"> exigen punto como separador decimal en su .value
  // (con coma lo rechazan y el campo queda vacío).
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = (val ?? '') === '' ? '' : String(val); };

  // Limpia los toggles de tramo inicial; la rama del tipo cargado los reactiva.
  $('#promoFijaActiva').checked = false;
  $('#promoVariableActiva').checked = false;

  set('capital', cfg.capital);
  set('comisionApertura', cfg.comisionAperturaPct);
  set('gastosVinculados', cfg.gastosVinculadosAnuales);

  if (cfg.tipo === 'fija') {
    set('tinFija', cfg.tinFija); set('anosFija', cfg.anosFija);
    $('#promoFijaActiva').checked = !!cfg.promoActiva;
    set('promoFijaMeses', cfg.promoActiva ? cfg.promoMeses : '');
    set('promoFijaTin', cfg.promoActiva ? cfg.promoTin : '');
  } else if (cfg.tipo === 'variable') {
    set('diferencialVariable', cfg.diferencialVariable);
    set('euriborVariable', cfg.euribor);
    set('anosVariable', cfg.anosVariable);
    $('#promoVariableActiva').checked = !!cfg.promoActiva;
    set('promoVariableMeses', cfg.promoActiva ? cfg.promoMeses : '');
    set('promoVariableTin', cfg.promoActiva ? cfg.promoTin : '');
  } else if (cfg.tipo === 'mixta') {
    set('tinMixtaFija', cfg.tinMixtaFija); set('anosMixtaFija', cfg.anosMixtaFija);
    set('diferencialMixtaVariable', cfg.diferencialMixtaVariable);
    set('euriborMixta', cfg.euribor); set('anosMixtaVariable', cfg.anosMixtaVariable);
  }

  const detalles = $('#detallesVivienda');
  if (datosVivienda) {
    set('valorInmueble', datosVivienda.valorInmueble);
    $('#ccaa').value = String(datosVivienda.ccaaId);
    $('#obraNueva').checked = !!datosVivienda.obraNueva;
    $('#viviendaHabitual').checked = !!datosVivienda.viviendaHabitual;
    detalles.open = true;
  } else {
    set('valorInmueble', '');
    detalles.open = false;
  }

  // Bonificación.
  $('#bonifActiva').checked = !!cfg.bonifActiva;
  set('bonifIncremento', cfg.bonifActiva ? cfg.bonifIncremento : '');
  $('#detallesBonif').open = !!cfg.bonifActiva;

  // TAE del banco.
  $('#taeActiva').checked = !!cfg.taeActiva;
  set('taeObjetivo', cfg.taeActiva ? cfg.taeObjetivo : '');
  $('#detallesTae').open = !!cfg.taeActiva;

  // Amortización anticipada.
  $('#amortActiva').checked = !!amort;
  if (amort) {
    const period = amort.periodicidad || 'unica';
    set('amortImporte', amort.importe);
    set('amortComision', amort.comisionPct);
    set('amortMes', period === 'unica' ? amort.mes : amort.desde);
    $$('#amortPeriodicidad .seg').forEach((s) => s.classList.toggle('activa', s.dataset.period === period));
    $$('#amortModo .seg').forEach((s) => s.classList.toggle('activa', s.dataset.modo === (amort.modo || 'plazo')));
    actualizarLabelMes(period);
    $('#detallesAmort').open = true;
  } else {
    set('amortImporte', ''); set('amortComision', ''); set('amortMes', '');
    $$('#amortPeriodicidad .seg').forEach((s) => s.classList.toggle('activa', s.dataset.period === 'unica'));
    $$('#amortModo .seg').forEach((s) => s.classList.toggle('activa', s.dataset.modo === 'plazo'));
    actualizarLabelMes('unica');
  }

  sincronizarPromoUI();
  sincronizarOpcionalesUI();
}

// ---------------------------------------------------------------------------
//  Vista: Comparar
// ---------------------------------------------------------------------------
async function pintarComparador() {
  const cont = $('#comparador');
  let lista;
  try { lista = await listarHipotecas(); } catch { lista = []; }

  if (!lista.length) {
    cont.innerHTML = estadoVacio('Guarda al menos dos hipotecas para compararlas.');
    return;
  }

  // Limpia selección de ids que ya no existen.
  const idsExistentes = new Set(lista.map((h) => h.id));
  estado.seleccionComparar.forEach((id) => { if (!idsExistentes.has(id)) estado.seleccionComparar.delete(id); });
  // Por defecto selecciona las dos primeras si no hay nada elegido.
  if (estado.seleccionComparar.size === 0) {
    lista.slice(0, Math.min(2, lista.length)).forEach((h) => estado.seleccionComparar.add(h.id));
  }

  const pildoras = lista.map((h) => `
    <button type="button" class="pildora-sel ${estado.seleccionComparar.has(h.id) ? 'sel' : ''}" data-id="${h.id}">
      ${esc(h.nombre)}
    </button>`).join('');

  const seleccionadas = lista.filter((h) => estado.seleccionComparar.has(h.id));
  const tabla = seleccionadas.length >= 1 ? tablaComparativa(seleccionadas) : estadoVacio('Selecciona hipotecas para comparar.');

  cont.innerHTML = `
    <div class="comparador-acciones">${pildoras}</div>
    ${tabla}`;

  $$('.pildora-sel', cont).forEach((p) => p.addEventListener('click', () => {
    const id = Number(p.dataset.id);
    if (estado.seleccionComparar.has(id)) estado.seleccionComparar.delete(id);
    else estado.seleccionComparar.add(id);
    pintarComparador();
  }));
}

function tablaComparativa(hipos) {
  const r = hipos.map((h) => h.resumen || {});

  // Determina el mejor (mínimo) por fila para resaltar.
  const minIdx = (vals) => {
    let mi = -1, mv = Infinity;
    vals.forEach((v, i) => { if (Number.isFinite(v) && v < mv) { mv = v; mi = i; } });
    return mi;
  };

  const filaTexto = (etq, fmt, getter, resaltarMin = false) => {
    const vals = r.map(getter);
    const mejor = resaltarMin ? minIdx(vals) : -1;
    const celdas = vals.map((v, i) => `<td class="${i === mejor ? 'mejor' : ''}">${v == null ? '—' : fmt(v)}</td>`).join('');
    return `<tr><td>${etq}</td>${celdas}</tr>`;
  };

  const cabecera = hipos.map((h) => `<th>${esc(h.nombre)}</th>`).join('');

  const datosGrafico = hipos.map((h) => ({ nombre: h.nombre, capital: (h.resumen || {}).capital || 0, totalIntereses: (h.resumen || {}).totalIntereses || 0 }));

  return `
    <div class="card card-grafico" style="margin-bottom:14px">
      <h3>Coste total (capital + intereses)</h3>
      ${graficoComparador(datosGrafico)}
    </div>
    <div class="tabla-scroll">
      <table class="tabla tabla-comparar">
        <thead><tr><th>Concepto</th>${cabecera}</tr></thead>
        <tbody>
          <tr class="fila-tipo"><td>Tipo</td>${r.map((x) => `<td>${nombreTipo(x.tipo)}</td>`).join('')}</tr>
          ${filaTexto('Capital', euro0, (x) => x.capital)}
          ${filaTexto('Plazo', (v) => `${num(v)} años`, (x) => x.anosTotal)}
          ${filaTexto('Cuota inicial', euro0, (x) => x.cuotaPrimera, true)}
          ${filaTexto('Intereses', euro0, (x) => x.totalIntereses, true)}
          ${filaTexto('Total a pagar', euro0, (x) => x.importeTotal, true)}
          ${filaTexto('Coste total', euro0, (x) => x.importeFinal, true)}
          ${filaTexto('TAE', (v) => pct(v), (x) => x.tae, true)}
          ${r.some((x) => x.ahorroNecesario != null) ? filaTexto('Ahorro necesario', euro0, (x) => x.ahorroNecesario, true) : ''}
        </tbody>
      </table>
    </div>
    <p class="muted" style="margin-top:12px">En verde, el valor más bajo de cada fila.</p>`;
}

// ---------------------------------------------------------------------------
//  Changelog / novedades
// ---------------------------------------------------------------------------
function mostrarChangelog() {
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  const versiones = CAMBIOS.map((v) => `
    <div class="cl-version">
      <div class="cl-cab"><span class="cl-num">v${esc(v.version)}</span><span class="cl-fecha">${esc(v.fecha)}</span></div>
      ${v.titulo ? `<div class="cl-titulo">${esc(v.titulo)}</div>` : ''}
      <ul class="cl-lista">${v.cambios.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    </div>`).join('');
  fondo.innerHTML = `
    <div class="modal modal-cl">
      <h3>Novedades</h3>
      <div class="cl-cuerpo">${versiones}</div>
      <button type="button" class="btn-principal" id="clCerrar" style="margin-top:4px">Cerrar</button>
    </div>`;
  document.body.appendChild(fondo);
  requestAnimationFrame(() => fondo.classList.add('show'));
  const cerrar = () => { fondo.classList.remove('show'); setTimeout(() => fondo.remove(), 200); };
  $('#clCerrar', fondo).addEventListener('click', cerrar);
  fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(); });
}

// ---------------------------------------------------------------------------
//  Vista: Ajustes
// ---------------------------------------------------------------------------
function pintarAcentos() {
  const cont = $('#acentos');
  cont.innerHTML = ACENTOS.map((c) => `<div class="acento-opt" data-color="${c}" style="background:${c}"></div>`).join('');
  $$('.acento-opt', cont).forEach((o) => o.addEventListener('click', async () => {
    estado.ajustes.acento = o.dataset.color;
    aplicarAcento();
    await persistirAjustes();
  }));
}

async function refrescarAlmacenamiento() {
  const el = $('#infoAlmacenamiento');
  const info = await infoAlmacenamiento();
  if (!info) { el.textContent = 'Información no disponible en este navegador.'; return; }
  const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;
  el.innerHTML = `Almacenamiento ${info.persistente ? '<strong style="color:var(--positivo)">persistente</strong>' : 'no persistente'} · usado ${mb(info.uso)}${info.cuota ? ` de ${mb(info.cuota)}` : ''}.`;
}

function bindAjustes() {
  // Tema
  $$('#segTema .seg').forEach((b) => b.addEventListener('click', async () => {
    estado.ajustes.tema = b.dataset.tema;
    aplicarTema();
    await persistirAjustes();
  }));

  // Euríbor manual
  const toggleManual = $('#usarEuriborManual');
  const campoManual = $('#campoEuriborManual');
  const inputManual = $('#euriborManual');

  const sincManualUI = () => {
    toggleManual.checked = estado.ajustes.usarEuriborManual;
    campoManual.classList.toggle('oculto', !estado.ajustes.usarEuriborManual);
    if (estado.ajustes.euriborManual != null) inputManual.value = String(estado.ajustes.euriborManual);
  };
  sincManualUI();

  toggleManual.addEventListener('change', async () => {
    estado.ajustes.usarEuriborManual = toggleManual.checked;
    campoManual.classList.toggle('oculto', !toggleManual.checked);
    await persistirAjustes();
    if (toggleManual.checked) {
      const v = leerNum('euriborManual');
      if (v != null) { estado.ajustes.euriborManual = v; await persistirAjustes(); fijarEuribor(v, { fuente: 'manual', periodo: '' }); }
    } else {
      await inicializarEuribor();
    }
  });

  inputManual.addEventListener('change', async () => {
    const v = leerNum('euriborManual');
    estado.ajustes.euriborManual = v;
    await persistirAjustes();
    if (estado.ajustes.usarEuriborManual && v != null) fijarEuribor(v, { fuente: 'manual', periodo: '' });
  });

  // Versión y novedades
  const ver = $('#appVersion');
  if (ver) ver.textContent = `v${VERSION}`;
  $('#btnNovedades')?.addEventListener('click', mostrarChangelog);

  // Exportar / importar copia de seguridad
  $('#btnExportarDatos')?.addEventListener('click', async () => {
    try {
      const datos = await exportarTodo();
      if (!datos.hipotecas.length) { toast('No hay hipotecas que exportar'); return; }
      const fecha = new Date(datos.exportado).toISOString().slice(0, 10);
      descargarArchivo(JSON.stringify(datos, null, 2), `hipotecas-${fecha}.json`, 'application/json');
      toast(`${datos.hipotecas.length} hipotecas exportadas`);
    } catch { toast('No se pudo exportar'); }
  });
  $('#btnImportarDatos')?.addEventListener('click', () => $('#inputImportar').click());
  $('#inputImportar')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const datos = JSON.parse(await file.text());
      const lista = Array.isArray(datos) ? datos : datos.hipotecas;
      const n = await importarHipotecas(lista);
      toast(n > 0 ? `${n} hipotecas importadas` : 'No había hipotecas válidas');
    } catch {
      toast('Archivo no válido');
    } finally {
      e.target.value = ''; // permite reimportar el mismo archivo
    }
  });

  // Actualizar Euríbor desde el BCE
  $('#btnActualizarEuribor').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.textContent = 'Actualizando…';
    btn.disabled = true;
    try {
      const bce = await fetchEuriborBCE();
      if (!estado.ajustes.usarEuriborManual) fijarEuribor(bce.valor, { fuente: 'BCE', periodo: bce.periodo });
      else {
        const auto = $('#ajusteEuriborAuto');
        if (auto) auto.textContent = `${pct(bce.valor)}${bce.periodo ? ` · ${formatearPeriodo(bce.periodo)}` : ''}`;
      }
      toast(`Euríbor actualizado: ${pct(bce.valor)}`);
      cargarGraficoEuribor(true);
    } catch {
      toast('No se pudo conectar con el BCE');
    } finally {
      btn.textContent = 'Actualizar desde el BCE';
      btn.disabled = false;
    }
  });
}

// ---------------------------------------------------------------------------
//  Inicialización
// ---------------------------------------------------------------------------
function poblarCCAA() {
  const sel = $('#ccaa');
  sel.innerHTML = CCAA.map((c) => `<option value="${c.id}" ${c.id === CCAA_MADRID ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('');
}

function bindEventos() {
  // Navegación inferior
  $$('.nav-item').forEach((n) => n.addEventListener('click', () => navegar(n.dataset.vista)));
  // Chip Euríbor → ajustes
  $('#chipEuribor').addEventListener('click', () => navegar('ajustes'));
  // Selector de tipo
  $$('.segmented .seg[data-tipo]').forEach((b) => b.addEventListener('click', () => cambiarTipo(b.dataset.tipo)));
  // Toggles del tramo inicial promocional (fija / variable)
  $('#promoFijaActiva').addEventListener('change', sincronizarPromoUI);
  $('#promoVariableActiva').addEventListener('change', sincronizarPromoUI);
  // Toggles de secciones opcionales (bonificación, amortización, TAE)
  $('#bonifActiva').addEventListener('change', sincronizarOpcionalesUI);
  $('#amortActiva').addEventListener('change', sincronizarOpcionalesUI);
  $('#taeActiva').addEventListener('change', sincronizarOpcionalesUI);
  // Segmented de opciones (periodicidad y modo de amortización)
  $$('.seg-opciones .seg').forEach((b) => b.addEventListener('click', () => {
    b.parentElement.querySelectorAll('.seg').forEach((s) => s.classList.toggle('activa', s === b));
    if (b.dataset.period) actualizarLabelMes(b.dataset.period);
  }));
  // Envío del formulario
  $('#formHipoteca').addEventListener('submit', (e) => { e.preventDefault(); calcularYMostrar(); });
}

async function registrarSW() {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch { /* ignorar */ }
  }
}

async function init() {
  // Ajustes (tema/acento) cuanto antes para evitar parpadeos.
  try { estado.ajustes = await cargarAjustes(); } catch { estado.ajustes = { ...AJUSTES_DEFAULT }; }
  pintarAcentos();
  aplicarTema();
  aplicarAcento();

  poblarCCAA();
  bindEventos();
  bindAjustes();
  cambiarTipo('fija');

  await inicializarEuribor();

  solicitarPersistencia();
  registrarSW();
}

document.addEventListener('DOMContentLoaded', init);
