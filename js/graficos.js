// ============================================================================
//  graficos.js · Gráficos en SVG inline, sin dependencias externas.
//  Heredan los colores del tema mediante variables CSS (var(--acento), etc.).
// ============================================================================

const fmtK = (n) => {
  const v = Math.abs(n);
  if (v >= 1000) return `${Math.round(n / 1000)} k€`;
  return `${Math.round(n)} €`;
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/**
 * Gráfico de área de la evolución del capital pendiente a lo largo de los años.
 * @param {Array} resumenAnual  Filas con { ano, pendiente }.
 * @param {number} capitalInicial  Capital al inicio (año 0).
 * @returns {string} SVG.
 */
export function graficoCapitalPendiente(resumenAnual, capitalInicial) {
  const W = 320, H = 170;
  const mIzq = 8, mDer = 8, mSup = 12, mInf = 22;
  const innerW = W - mIzq - mDer;
  const innerH = H - mSup - mInf;

  // Serie: año 0 = capital inicial; resto = pendiente al final de cada año.
  const valores = [capitalInicial, ...resumenAnual.map((a) => a.pendiente)];
  const n = valores.length;
  const maxY = capitalInicial || 1;
  const px = (i) => mIzq + (n === 1 ? 0 : (i / (n - 1)) * innerW);
  const py = (v) => mSup + innerH - (v / maxY) * innerH;

  const puntos = valores.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);
  const linea = `M ${puntos.join(' L ')}`;
  const area = `${linea} L ${px(n - 1).toFixed(1)},${(mSup + innerH).toFixed(1)} L ${px(0).toFixed(1)},${(mSup + innerH).toFixed(1)} Z`;
  const anosTotal = resumenAnual.length;

  return `
    <svg class="grafico" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Evolución del capital pendiente">
      <defs>
        <linearGradient id="gradCap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--acento)" stop-opacity="0.45"/>
          <stop offset="1" stop-color="var(--acento)" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <line x1="${mIzq}" y1="${mSup + innerH}" x2="${W - mDer}" y2="${mSup + innerH}" stroke="var(--borde)" stroke-width="1"/>
      <path d="${area}" fill="url(#gradCap)"/>
      <path d="${linea}" fill="none" stroke="var(--acento)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <text x="${mIzq}" y="${H - 6}" fill="var(--texto-3)" font-size="10">año 0</text>
      <text x="${W - mDer}" y="${H - 6}" fill="var(--texto-3)" font-size="10" text-anchor="end">año ${anosTotal}</text>
      <text x="${mIzq}" y="${mSup + 4}" fill="var(--texto-3)" font-size="10">${fmtK(maxY)}</text>
    </svg>`;
}

const MESES_ABREV = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function periodoCorto(p) {
  if (!/^\d{4}-\d{2}$/.test(p || '')) return p || '';
  const [a, m] = p.split('-');
  return `${MESES_ABREV[parseInt(m, 10) - 1]} ${a.slice(2)}`;
}

/**
 * Gráfico de línea del histórico del Euríbor.
 * @param {Array<{periodo:string, valor:number}>} puntos  Ordenados por fecha.
 * @returns {string} SVG.
 */
export function graficoHistoricoEuribor(puntos) {
  if (!puntos || puntos.length < 2) return '<p class="muted">Histórico no disponible.</p>';
  const W = 320, H = 160;
  const mIzq = 8, mDer = 8, mSup = 14, mInf = 22;
  const innerW = W - mIzq - mDer;
  const innerH = H - mSup - mInf;

  const vals = puntos.map((p) => p.valor);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (max - min < 0.2) { max += 0.1; min -= 0.1; } // rango mínimo legible
  const rango = max - min;
  const n = puntos.length;
  const px = (i) => mIzq + (i / (n - 1)) * innerW;
  const py = (v) => mSup + innerH - ((v - min) / rango) * innerH;

  const coords = puntos.map((p, i) => `${px(i).toFixed(1)},${py(p.valor).toFixed(1)}`);
  const ultimo = puntos[n - 1];

  return `
    <svg class="grafico" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Histórico del Euríbor">
      <line x1="${mIzq}" y1="${mSup + innerH}" x2="${W - mDer}" y2="${mSup + innerH}" stroke="var(--borde)" stroke-width="1"/>
      <polyline points="${coords.join(' ')}" fill="none" stroke="var(--acento)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${px(n - 1).toFixed(1)}" cy="${py(ultimo.valor).toFixed(1)}" r="3.5" fill="var(--acento)"/>
      <text x="${mIzq}" y="${mSup + 2}" fill="var(--texto-3)" font-size="10">${max.toFixed(2).replace('.', ',')} %</text>
      <text x="${mIzq}" y="${mSup + innerH}" fill="var(--texto-3)" font-size="10">${min.toFixed(2).replace('.', ',')} %</text>
      <text x="${mIzq}" y="${H - 6}" fill="var(--texto-3)" font-size="10">${periodoCorto(puntos[0].periodo)}</text>
      <text x="${W - mDer}" y="${H - 6}" fill="var(--texto-3)" font-size="10" text-anchor="end">${periodoCorto(ultimo.periodo)}</text>
    </svg>`;
}

/**
 * Gráfico de barras apiladas (capital + intereses + extras) para comparar el
 * coste total de varias hipotecas. La de menor coste total se resalta en verde.
 * @param {Array} hipos  [{ nombre, capital, totalIntereses, extras, costeTotal }]
 * @returns {string} SVG.
 */
export function graficoComparador(hipos) {
  if (!hipos.length) return '';
  const W = 320, H = 200;
  const mInf = 40, mSup = 16, mLat = 10;
  const innerH = H - mInf - mSup;
  const costes = hipos.map((h) => h.costeTotal);
  const maxTotal = Math.max(...costes, 1);
  const idxGanador = costes.indexOf(Math.min(...costes));
  const n = hipos.length;
  const slot = (W - 2 * mLat) / n;
  const bw = Math.min(56, slot * 0.62);

  const barras = hipos.map((h, i) => {
    const cx = mLat + slot * i + slot / 2;
    const x = cx - bw / 2;
    const ganador = i === idxGanador && n > 1;
    const colorInt = ganador ? 'var(--positivo)' : 'var(--acento)';
    const hCap = (h.capital / maxTotal) * innerH;
    const hInt = (h.totalIntereses / maxTotal) * innerH;
    const hExt = ((h.extras || 0) / maxTotal) * innerH;
    const yExt = mSup + (innerH - hCap - hInt - hExt);
    const yInt = mSup + (innerH - hCap - hInt);
    const yCap = mSup + (innerH - hCap);
    const nombre = h.nombre.length > 11 ? h.nombre.slice(0, 10) + '…' : h.nombre;
    return `
      ${hExt > 0.5 ? `<rect x="${x.toFixed(1)}" y="${yExt.toFixed(1)}" width="${bw.toFixed(1)}" height="${hExt.toFixed(1)}" rx="3" fill="var(--aviso)"/>` : ''}
      <rect x="${x.toFixed(1)}" y="${yInt.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, hInt).toFixed(1)}" rx="3" fill="${colorInt}"/>
      <rect x="${x.toFixed(1)}" y="${yCap.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, hCap).toFixed(1)}" rx="3" fill="var(--surface-2)" stroke="var(--borde)" stroke-width="1"/>
      <text x="${cx.toFixed(1)}" y="${(yExt - 4).toFixed(1)}" fill="${ganador ? 'var(--positivo)' : 'var(--texto-2)'}" font-size="9.5" font-weight="${ganador ? '700' : '400'}" text-anchor="middle">${fmtK(h.costeTotal)}</text>
      <text x="${cx.toFixed(1)}" y="${H - 24}" fill="${ganador ? 'var(--positivo)' : 'var(--texto-2)'}" font-size="10" font-weight="${ganador ? '700' : '400'}" text-anchor="middle">${esc(nombre)}</text>
    `;
  }).join('');

  return `
    <svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Comparación de coste total">
      ${barras}
      <g font-size="9.5">
        <rect x="${mLat}" y="${H - 11}" width="9" height="9" rx="2" fill="var(--surface-2)" stroke="var(--borde)"/>
        <text x="${mLat + 13}" y="${H - 3}" fill="var(--texto-3)">Capital</text>
        <rect x="${mLat + 62}" y="${H - 11}" width="9" height="9" rx="2" fill="var(--acento)"/>
        <text x="${mLat + 75}" y="${H - 3}" fill="var(--texto-3)">Intereses</text>
        <rect x="${mLat + 135}" y="${H - 11}" width="9" height="9" rx="2" fill="var(--aviso)"/>
        <text x="${mLat + 148}" y="${H - 3}" fill="var(--texto-3)">Comis.+prod.</text>
      </g>
    </svg>`;
}
