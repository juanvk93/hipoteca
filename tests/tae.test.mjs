// Tests de la deducción del coste de productos vinculados desde una TAE objetivo.
import { seccion, ok, aprox } from './harness.mjs';
import { deducirCosteProductos, calcularHipoteca } from '../js/calculos.js';

const cfg = { tipo: 'fija', capital: 200000, tinFija: 2.5, anosFija: 30, comisionAperturaPct: 0.5, gastosVinculadosAnuales: 0 };

// TAE que producirían unos productos de coste anual P (pagados mensualmente),
// resolviendo la TIR de los flujos cuota + P/12 frente al capital - comisión.
function taeConProductos(res, costeAnual) {
  const cuotas = res.filasAmortizacion.map((f) => f.cuota);
  const comision = res.comisionApertura;
  const prima = costeAnual / 12;
  const vp = (i) => cuotas.reduce((s, c, idx) => s + (c + prima) / Math.pow(1 + i, idx + 1), 0);
  let lo = 0, hi = 1;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (vp(mid) > res.capital - comision) lo = mid; else hi = mid;
  }
  const i = (lo + hi) / 2;
  return (Math.pow(1 + i, 12) - 1) * 100;
}

seccion('TAE: deducción del coste de productos');
{
  const res = calcularHipoteca(cfg);

  // TAE objetivo = TAE base → no hay productos.
  const igual = deducirCosteProductos(cfg, res.tae);
  aprox(igual.costeAnual, 0, 1, 'TAE = TAE base → coste ≈ 0');
  ok(!igual.hayProductos, 'TAE = TAE base → hayProductos false');

  // TAE objetivo menor que la base → coste 0 (clamp), no negativo.
  const menor = deducirCosteProductos(cfg, res.tae - 0.5);
  ok(menor.costeAnual === 0, 'TAE menor que la base → coste 0 (no negativo)');

  // Ida y vuelta: para varios costes conocidos, la TAE que producen debe
  // devolver ese mismo coste al deducirlo.
  for (const P of [300, 600, 1200]) {
    const taeObj = taeConProductos(res, P);
    const ded = deducirCosteProductos(cfg, taeObj);
    aprox(ded.costeAnual, P, 1, `ida y vuelta coste ${P} €/año (TAE ${taeObj.toFixed(2)}%)`);
    ok(taeObj > res.tae, `coste ${P} → TAE objetivo (${taeObj.toFixed(2)}) > TAE base (${res.tae.toFixed(2)})`);
  }
  console.log(`     → TAE base ${res.tae.toFixed(2)}% · 600€/año ⇒ TAE ${taeConProductos(res, 600).toFixed(2)}%`);
}

seccion('TAE: coherencia card ↔ cálculo (aplicar el coste sube la TAE)');
{
  // Reproduce el caso del usuario: TIN 3,85 %, TAE base ~3,92 %, TAE banco 4,317 %.
  const cfgU = { tipo: 'fija', capital: 200000, tinFija: 3.85, anosFija: 30, comisionAperturaPct: 0, gastosVinculadosAnuales: 0 };
  const base = calcularHipoteca(cfgU);
  const taeBanco = 4.317;
  const ded = deducirCosteProductos(cfgU, taeBanco);
  ok(ded.costeAnual > 0, `coste deducido > 0 (${ded.costeAnual.toFixed(0)} €/año)`);

  // Al aplicar ese coste a gastos vinculados, la TAE calculada debe subir al objetivo.
  const resConProductos = calcularHipoteca({ ...cfgU, gastosVinculadosAnuales: ded.costeAnual });
  aprox(resConProductos.tae, taeBanco, 0.02, 'aplicar el coste deducido sube la TAE ≈ al TAE del banco');
  ok(resConProductos.tae > base.tae + 0.2, `la TAE sube respecto a la base (${base.tae.toFixed(2)} → ${resConProductos.tae.toFixed(2)})`);

  // El redondeo a euros del botón mantiene la TAE muy cerca del objetivo.
  const resRedondeado = calcularHipoteca({ ...cfgU, gastosVinculadosAnuales: Math.round(ded.costeAnual) });
  aprox(resRedondeado.tae, taeBanco, 0.03, 'con coste redondeado, TAE ≈ objetivo');
  console.log(`     → TIN 3,85% · TAE base ${base.tae.toFixed(2)}% · banco ${taeBanco}% ⇒ coste ${ded.costeAnual.toFixed(0)}€/año ⇒ TAE recalc ${resConProductos.tae.toFixed(2)}%`);
}
