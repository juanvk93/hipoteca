// Tests de impuestos y gastos de compra por CCAA.
import { seccion, ok, aprox } from './harness.mjs';
import { calcularImpuestos } from '../js/impuestos.js';

const EPS = 0.01;

seccion('Impuestos por CCAA');
{
  const imp = calcularImpuestos({ valorInmueble: 200000, capital: 150000, comisionApertura: 1000, ccaaId: 13, obraNueva: false, viviendaHabitual: true });
  aprox(imp.valorITP, 200000 * 0.06, EPS, 'ITP Madrid 6%');
  aprox(imp.valorIVA, 0, EPS, 'sin IVA en 2ª mano');
  aprox(imp.valorAJD, 200000 * 0.0075, EPS, 'AJD Madrid 0,75%');
  aprox(imp.gastosFijos, 200000 * 0.005 + 200000 * 0.0025 + 300, EPS, 'gastos fijos');
  aprox(imp.impuestosTotales, imp.valorITP + imp.valorAJD + imp.gastosFijos, EPS, 'total impuestos');
  aprox(imp.entrada, 50000, EPS, 'entrada = precio - hipoteca');
  aprox(imp.ahorroNecesario, imp.entrada + imp.impuestosTotales + 1000, EPS, 'ahorro = entrada + impuestos + comisión');

  const on = calcularImpuestos({ valorInmueble: 300000, capital: 240000, comisionApertura: 0, ccaaId: 13, obraNueva: true, viviendaHabitual: true });
  aprox(on.valorIVA, 30000, EPS, 'IVA 10% obra nueva');
  aprox(on.valorITP, 0, EPS, 'sin ITP en obra nueva');
  const can = calcularImpuestos({ valorInmueble: 300000, capital: 240000, comisionApertura: 0, ccaaId: 5, obraNueva: true, viviendaHabitual: true });
  aprox(can.valorIVA, 300000 * 0.065, EPS, 'IGIC 6,5% Canarias');
}
