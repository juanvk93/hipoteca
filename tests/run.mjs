// Runner de tests. Ejecuta: `npm test`  o  `node tests/run.mjs`
import { resumen } from './harness.mjs';

// Importar cada archivo de test ejecuta sus aserciones (efecto de import).
await import('./calculos.test.mjs');
await import('./impuestos.test.mjs');
await import('./bonificacion.test.mjs');
await import('./amortizacion.test.mjs');

process.exit(resumen() > 0 ? 1 : 0);
