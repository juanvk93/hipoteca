// Tests del motor de cálculo: modelo francés, TAE, tipos, tramo inicial promocional.
import { seccion, ok, aprox } from './harness.mjs';
import {
  calcularHipoteca, calcularEscenarios, cuotaFrancesa, calcularTAE,
  tinAtae, taeAtin, saldoPendiente,
} from '../js/calculos.js';

const EPS = 0.01;

seccion('Modelo francés: invariantes (fija)');
for (const c of [
  { capital: 150000, tin: 3, anos: 30 },
  { capital: 150000, tin: 1.35, anos: 20 },
  { capital: 250000, tin: 2.9, anos: 25 },
  { capital: 80000, tin: 4.5, anos: 15 },
]) {
  const r = calcularHipoteca({ tipo: 'fija', capital: c.capital, tinFija: c.tin, anosFija: c.anos, comisionAperturaPct: 0, gastosVinculadosAnuales: 0 });
  aprox(r.filasAmortizacion.reduce((s, f) => s + f.amortizado, 0), c.capital, EPS, `[${c.capital}@${c.tin}/${c.anos}] Σ amortización = capital`);
  aprox(r.filasAmortizacion.at(-1).pendiente, 0, EPS, 'pendiente final = 0');
  aprox(r.filasAmortizacion.reduce((s, f) => s + f.cuota, 0), r.importeTotal, EPS, 'Σ cuotas = importeTotal');
  aprox(r.totalIntereses, r.importeTotal - c.capital, EPS, 'intereses = total - capital');
  ok(r.filasAmortizacion.length === c.anos * 12, `nº filas = ${c.anos * 12}`);
}

seccion('Cuota francesa y TIN 0');
{
  const P = 200000, tin = 3.5, n = 300, i = tin / 100 / 12;
  aprox(cuotaFrancesa(P, tin, n), P * i / (1 - Math.pow(1 + i, -n)), 1e-6, 'cuotaFrancesa = fórmula');
  aprox(cuotaFrancesa(120000, 0, 240), 500, 1e-9, 'TIN 0 → P/n');
  const r = calcularHipoteca({ tipo: 'fija', capital: 100000, tinFija: 0, anosFija: 10, comisionAperturaPct: 0, gastosVinculadosAnuales: 0 });
  aprox(r.totalIntereses, 0, EPS, 'TIN 0 → intereses 0');
  aprox(r.importeTotal, 100000, EPS, 'TIN 0 → total = capital');
}

seccion('TAE y conversiones');
{
  const r = calcularHipoteca({ tipo: 'fija', capital: 150000, tinFija: 3, anosFija: 30, comisionAperturaPct: 0, gastosVinculadosAnuales: 0 });
  aprox(r.tae, tinAtae(3), 0.01, 'TAE sin comisión ≈ TIE');
  const r2 = calcularHipoteca({ tipo: 'fija', capital: 150000, tinFija: 3, anosFija: 30, comisionAperturaPct: 1, gastosVinculadosAnuales: 0 });
  ok(r2.tae > r.tae, 'TAE con comisión > sin comisión');
  const iMes = Math.pow(1 + r2.tae / 100, 1 / 12) - 1;
  const vp = r2.filasAmortizacion.reduce((s, f, idx) => s + f.cuota / Math.pow(1 + iMes, idx + 1), 0);
  aprox(vp, 150000 - r2.comisionApertura, 1, 'VP(cuotas a TAE) = capital - comisión');
  for (const tin of [1, 2.5, 3.75, 5]) aprox(taeAtin(tinAtae(tin)), tin, 1e-6, `inversa tin↔tae (${tin})`);
}

seccion('Variable y mixta');
{
  const rv = calcularHipoteca({ tipo: 'variable', capital: 150000, diferencialVariable: 0.99, euribor: 2.8, anosVariable: 25, comisionAperturaPct: 0, gastosVinculadosAnuales: 0 });
  aprox(rv.tramos[0].tinAnual, 3.79, 1e-9, 'TIN variable = dif + euríbor');

  const cfg = { tipo: 'mixta', capital: 200000, tinMixtaFija: 2.5, anosMixtaFija: 5, diferencialMixtaVariable: 0.6, euribor: 2.8, anosMixtaVariable: 20, comisionAperturaPct: 0, gastosVinculadosAnuales: 0 };
  const r = calcularHipoteca(cfg);
  const variable = r.tramos.find((t) => t.nombre === 'variable');
  aprox(r.filasAmortizacion[59].pendiente, variable.capitalInicio, EPS, 'continuidad capital fijo→variable');
  const cuotaFijaEsp = cuotaFrancesa(200000, 2.5, 300);
  aprox(r.tramos[0].cuota, cuotaFijaEsp, EPS, 'cuota fija = amortizar total en plazo total');
  aprox(r.filasAmortizacion[59].pendiente, saldoPendiente(200000, 2.5, cuotaFijaEsp, 60), EPS, 'saldo 60m = fórmula');
  aprox(r.filasAmortizacion.reduce((s, f) => s + f.amortizado, 0), 200000, EPS, 'Σ amortización mixta = capital');
  aprox(r.filasAmortizacion.at(-1).pendiente, 0, EPS, 'pendiente final mixta = 0');
}

seccion('Escenarios de Euríbor');
{
  const cfg = { tipo: 'variable', capital: 150000, diferencialVariable: 0.99, euribor: 2.8, anosVariable: 25, comisionAperturaPct: 0, gastosVinculadosAnuales: 0 };
  const esc = calcularEscenarios(cfg);
  for (let k = 1; k < esc.length; k++) {
    ok(esc[k].cuotaVariable > esc[k - 1].cuotaVariable, `cuota crece (${esc[k - 1].delta}→${esc[k].delta})`);
    ok(esc[k].totalIntereses > esc[k - 1].totalIntereses, `intereses crecen (${esc[k - 1].delta}→${esc[k].delta})`);
  }
  aprox(esc.find((e) => e.delta === 0).cuotaVariable, calcularHipoteca(cfg).cuotaPrimera, EPS, 'delta 0 = base');
  ok(calcularEscenarios({ tipo: 'fija', capital: 100000, tinFija: 3, anosFija: 20 }) === null, 'escenarios null para fija');
}

seccion('Tramo inicial promocional (tipo de entrada)');
{
  // Caso de la imagen real: 249608.75 €, 30 años, 6 meses al 3.48%, resto 4.48%
  const r = calcularHipoteca({ tipo: 'fija', capital: 249608.75, tinFija: 4.48, anosFija: 30, promoActiva: true, promoMeses: 6, promoTin: 3.48, comisionAperturaPct: 0, gastosVinculadosAnuales: 0 });
  ok(r.tramos.length === 2 && r.tramos[0].nombre === 'inicial' && r.tramos[1].nombre === 'fijo', 'fija: inicial + fijo');
  aprox(r.tramos[0].cuota, 1118.07, 0.02, 'cuota primeros 6 meses = 1118,07');
  aprox(r.tramos[1].cuota, 1259.80, 0.02, 'cuota resto = 1259,80');
  aprox(r.filasAmortizacion.at(-1).pendiente, 0, EPS, 'pendiente final = 0');

  const v = calcularHipoteca({ tipo: 'variable', capital: 200000, diferencialVariable: 0.8, euribor: 2.8, anosVariable: 25, promoActiva: true, promoMeses: 12, promoTin: 2.5, comisionAperturaPct: 0, gastosVinculadosAnuales: 0 });
  ok(v.tramos.length === 2 && v.tramos[1].nombre === 'variable', 'variable: inicial + variable');
  aprox(v.tramos[0].tinAnual, 2.5, 1e-9, 'tramo inicial fijo 2,5%');

  const escV = calcularEscenarios({ tipo: 'variable', capital: 200000, diferencialVariable: 0.8, euribor: 2.8, anosVariable: 25, promoActiva: true, promoMeses: 12, promoTin: 2.5 });
  ok(escV.every((e) => Math.abs(e.cuotaPrimera - escV[0].cuotaPrimera) < EPS), 'cuota inicial fija constante en escenarios');

  // Promo que no cabe → ignorada
  ok(calcularHipoteca({ tipo: 'fija', capital: 100000, tinFija: 3, anosFija: 2, promoActiva: true, promoMeses: 30, promoTin: 1 }).tramos.length === 1, 'promo que no cabe se ignora');
  ok(calcularHipoteca({ tipo: 'fija', capital: 100000, tinFija: 3, anosFija: 30, promoActiva: false, promoMeses: 6, promoTin: 1 }).tramos.length === 1, 'promoActiva=false → 1 tramo');
}
