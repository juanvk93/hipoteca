// Mini-framework de tests sin dependencias. Estado compartido entre archivos.
export const estado = { pasados: 0, fallos: 0, seccionActual: '' };

export function seccion(nombre) {
  estado.seccionActual = nombre;
  console.log(`\n• ${nombre}`);
}

export function ok(cond, msg) {
  if (cond) { estado.pasados++; }
  else { estado.fallos++; console.log(`   ❌ ${msg}`); }
}

export function aprox(a, b, eps, msg) {
  ok(Math.abs(a - b) <= eps, `${msg} (a=${a}, b=${b}, dif=${Math.abs(a - b)})`);
}

export function resumen() {
  console.log(`\n=================  ${estado.pasados} OK · ${estado.fallos} FALLOS  =================`);
  return estado.fallos;
}
