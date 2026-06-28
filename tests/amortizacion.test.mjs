// Tests de la amortización anticipada.
import { seccion, ok, aprox } from './harness.mjs';
import { simularAmortizacionAnticipada, calcularHipoteca } from '../js/calculos.js';

const EPS = 0.01;
const cfgBase = { tipo: 'fija', capital: 200000, tinFija: 3, anosFija: 30, comisionAperturaPct: 0, gastosVinculadosAnuales: 0 };

seccion('Amortización: sin aportación = base');
{
  const r = simularAmortizacionAnticipada(cfgBase, { importe: 0 });
  const base = calcularHipoteca(cfgBase);
  aprox(r.totalIntereses, base.totalIntereses, EPS, 'sin extra: mismos intereses');
  ok(r.mesesReales === base.mesesTotal, 'sin extra: mismo plazo');
  aprox(r.ahorroIntereses, 0, EPS, 'sin extra: ahorro 0');
}

seccion('Amortización: invariante de capital (Σ amortizado = capital)');
{
  for (const opts of [
    { importe: 20000, periodicidad: 'unica', mes: 12, modo: 'plazo' },
    { importe: 20000, periodicidad: 'unica', mes: 12, modo: 'cuota' },
    { importe: 200, periodicidad: 'mensual', desde: 1, modo: 'plazo' },
    { importe: 3000, periodicidad: 'anual', desde: 12, modo: 'cuota' },
  ]) {
    const r = simularAmortizacionAnticipada(cfgBase, opts);
    const sumCapital = r.filas.reduce((s, f) => s + f.amortizado, 0); // amortizado incluye extra
    aprox(sumCapital, 200000, 0.1, `Σ capital amortizado = capital (${opts.periodicidad}/${opts.modo})`);
    aprox(r.filas.at(-1).pendiente, 0, EPS, `pendiente final = 0 (${opts.periodicidad}/${opts.modo})`);
  }
}

seccion('Amortización: modo plazo acorta el plazo y ahorra intereses');
{
  const r = simularAmortizacionAnticipada(cfgBase, { importe: 30000, periodicidad: 'unica', mes: 12, modo: 'plazo' });
  ok(r.mesesReales < 360, `plazo acortado: ${r.mesesReales} < 360 meses`);
  ok(r.mesesAhorrados > 0, `meses ahorrados > 0 (${r.mesesAhorrados})`);
  ok(r.ahorroIntereses > 0, `ahorro de intereses > 0 (${r.ahorroIntereses.toFixed(0)} €)`);
  // En modo plazo la cuota se mantiene constante (un solo tramo fijo), salvo la
  // última cuota, que se ajusta para saldar el residuo. Comparamos una intermedia.
  aprox(r.filas[100].cuota, r.cuotaInicial, 1, 'modo plazo: cuota intermedia = inicial');
  ok(r.filas.at(-1).cuota <= r.cuotaInicial + 0.01, 'modo plazo: última cuota ≤ resto (ajuste de residuo)');
  console.log(`     → modo plazo: -${r.mesesAhorrados} meses, ahorro ${r.ahorroIntereses.toFixed(0)} €`);
}

seccion('Amortización: modo cuota mantiene plazo y baja la cuota');
{
  const r = simularAmortizacionAnticipada(cfgBase, { importe: 30000, periodicidad: 'unica', mes: 12, modo: 'cuota' });
  ok(r.mesesReales === 360, 'modo cuota: mismo plazo (360 meses)');
  ok(r.mesesAhorrados === 0, 'modo cuota: 0 meses ahorrados');
  ok(r.cuotaFinal < r.cuotaInicial, `cuota baja (${r.cuotaInicial.toFixed(0)} → ${r.cuotaFinal.toFixed(0)})`);
  ok(r.ahorroIntereses > 0, `ahorro de intereses > 0 (${r.ahorroIntereses.toFixed(0)} €)`);
  console.log(`     → modo cuota: cuota ${r.cuotaInicial.toFixed(0)} → ${r.cuotaFinal.toFixed(0)} €, ahorro ${r.ahorroIntereses.toFixed(0)} €`);
}

seccion('Amortización: comisión y comparación de modos');
{
  const com = simularAmortizacionAnticipada(cfgBase, { importe: 30000, periodicidad: 'unica', mes: 12, modo: 'plazo', comisionPct: 0.5 });
  aprox(com.totalComisiones, 30000 * 0.005, EPS, 'comisión = importe × 0,5%');
  // Aportación mensual ahorra más que una única del mismo total anual.
  const mensual = simularAmortizacionAnticipada(cfgBase, { importe: 300, periodicidad: 'mensual', desde: 1, modo: 'plazo' });
  ok(mensual.ahorroIntereses > 0 && mensual.mesesAhorrados > 0, 'aportación mensual ahorra');
  console.log(`     → mensual 300€: -${mensual.mesesAhorrados} meses, ahorro ${mensual.ahorroIntereses.toFixed(0)} €`);
}

seccion('Amortización sobre mixta (con tramos)');
{
  const cfgMixta = { tipo: 'mixta', capital: 200000, tinMixtaFija: 2.5, anosMixtaFija: 5, diferencialMixtaVariable: 0.6, euribor: 2.8, anosMixtaVariable: 20, comisionAperturaPct: 0, gastosVinculadosAnuales: 0 };
  const r = simularAmortizacionAnticipada(cfgMixta, { importe: 15000, periodicidad: 'unica', mes: 24, modo: 'plazo' });
  aprox(r.filas.reduce((s, f) => s + f.amortizado, 0), 200000, 0.5, 'mixta: Σ capital = capital');
  aprox(r.filas.at(-1).pendiente, 0, EPS, 'mixta: pendiente final = 0');
  ok(r.ahorroIntereses > 0, 'mixta: ahorro de intereses > 0');
}
