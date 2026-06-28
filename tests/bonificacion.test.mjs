// Tests de la bonificación de tipo (¿compensa bonificar?).
import { seccion, ok, aprox } from './harness.mjs';
import { calcularBonificacion, calcularHipoteca } from '../js/calculos.js';

const EPS = 0.5;

seccion('Bonificación: estructura y coherencia');
{
  const cfg = { tipo: 'fija', capital: 200000, tinFija: 2.5, anosFija: 30, bonifIncremento: 1, comisionAperturaPct: 0, gastosVinculadosAnuales: 600 };
  const b = calcularBonificacion(cfg);
  // El bonificado coincide con calcular la cfg tal cual.
  aprox(b.bonificado.importeFinal, calcularHipoteca(cfg).importeFinal, EPS, 'bonificado = cfg tal cual');
  // El sin bonificar usa TIN +1 y sin gastos vinculados.
  ok(b.sinBonificar.tramos[0].tinAnual === 3.5, 'sin bonificar: TIN 2,5 + 1 = 3,5');
  ok(b.sinBonificar.gastosVinculados === 0, 'sin bonificar: sin coste de productos');
  // El bonificado paga menos intereses (TIN menor) pero suma el coste de productos.
  ok(b.bonificado.totalIntereses < b.sinBonificar.totalIntereses, 'bonificado paga menos intereses');
}

seccion('Bonificación: decisión compensa / no compensa');
{
  // Coste de productos bajo (120 €/año) → debería compensar bonificar.
  const barato = calcularBonificacion({ tipo: 'fija', capital: 200000, tinFija: 2.5, anosFija: 30, bonifIncremento: 1, comisionAperturaPct: 0, gastosVinculadosAnuales: 120 });
  ok(barato.compensa === true, 'productos baratos → compensa bonificar');

  // Coste de productos altísimo (5000 €/año) → no compensa.
  const caro = calcularBonificacion({ tipo: 'fija', capital: 200000, tinFija: 2.5, anosFija: 30, bonifIncremento: 1, comisionAperturaPct: 0, gastosVinculadosAnuales: 5000 });
  ok(caro.compensa === false, 'productos muy caros → no compensa');

  // La diferencia debe ser el valor absoluto de la resta de costes finales.
  aprox(barato.diferencia, Math.abs(barato.sinBonificar.importeFinal - barato.bonificado.importeFinal), 0.001, 'diferencia coherente');
}

seccion('Bonificación: variable (incremento sobre el diferencial)');
{
  const b = calcularBonificacion({ tipo: 'variable', capital: 180000, diferencialVariable: 0.5, euribor: 2.8, anosVariable: 25, bonifIncremento: 0.8, comisionAperturaPct: 0, gastosVinculadosAnuales: 300 });
  aprox(b.sinBonificar.tramos[0].tinAnual, 0.5 + 0.8 + 2.8, 1e-9, 'sin bonificar: (dif+inc) + euríbor');
}
