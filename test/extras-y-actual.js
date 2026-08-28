/* Puntos 1 y 2 de las notas de Willy.
   ---------------------------------------------------------------------------
   1) "Ver cómo integrar el cálculo de horas extras al 100%, 200% y 300%."
      No es un recargo único: se liquida por TRAMOS y cada uno vale más que el
      anterior. Lo importante es que el default NO cambie solo: los topes
      cambian de un convenio a otro, y poner una escala que no es la de ellos
      daría números equivocados con total seguridad.

   2) "Tendría la columna de Estimado y Actual."                             */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
const casi = (a, b, tol = 1) => Math.abs(a - b) < tol;

console.log('--- 1. EL DEFAULT NO CAMBIA SOLO ---');
ok('viene un solo tramo', TRAMOS_HE_DEFAULT.length === 1);
ok('al 50%, como siempre', TRAMOS_HE_DEFAULT[0].recargo === 50);
ok('y abierto', TRAMOS_HE_DEFAULT[0].hasta === null);
ok('la escala de publicidad está como preset', TRAMOS_HE_ESCALADO.length === 4);
ok('y va 50/100/200/300',
  TRAMOS_HE_ESCALADO.map(t => t.recargo).join('/') === '50/100/200/300');

console.log('\n--- 2. EL REPARTO POR TRAMOS ---');
const E = TRAMOS_HE_ESCALADO;
const r0 = repartirHE(0, E);
ok('sin extras no reparte nada', r0.length === 0);
const r1 = repartirHE(1.5, E);
ok('1,5 h caen todas al 50%', r1.length === 1 && r1[0].recargo === 50 && casi(r1[0].horas, 1.5));
const r3 = repartirHE(3, E);
ok('3 h se parten 2 al 50 y 1 al 100',
  r3.length === 2 && casi(r3[0].horas, 2) && r3[0].recargo === 50
  && casi(r3[1].horas, 1) && r3[1].recargo === 100, textoHE(r3));
const r5 = repartirHE(5, E);
ok('5 h: 2 al 50, 2 al 100, 1 al 200',
  r5.map(t => Math.round(t.horas) + '@' + t.recargo).join(' ') === '2@50 2@100 1@200', textoHE(r5));
const r9 = repartirHE(9, E);
ok('9 h llegan al 300%', r9[r9.length - 1].recargo === 300, textoHE(r9));
ok('y el total de horas se conserva',
  casi(r9.reduce((s, t) => s + t.horas, 0), 9), r9.reduce((s, t) => s + t.horas, 0) + '');

console.log('\n--- 3. Y CUANTO CUESTA ---');
const vh = 10000;   /* valor hora */
ok('1 h al 50% cuesta 15.000', casi(costoHEDe(1, vh, E), 15000), fmt(costoHEDe(1, vh, E)));
ok('3 h cuestan 2×15.000 + 1×20.000 = 50.000',
  casi(costoHEDe(3, vh, E), 50000), fmt(costoHEDe(3, vh, E)));
ok('5 h cuestan 30.000 + 40.000 + 30.000 = 100.000',
  casi(costoHEDe(5, vh, E), 100000), fmt(costoHEDe(5, vh, E)));
ok('la escala escalonada cuesta MAS que el 50% plano',
  costoHEDe(5, vh, E) > costoHEDe(5, vh, TRAMOS_HE_DEFAULT),
  fmt(costoHEDe(5, vh, E)) + ' vs ' + fmt(costoHEDe(5, vh, TRAMOS_HE_DEFAULT)));
ok('el texto se lee como un recibo', textoHE(r5) === '2:00 al 50% + 2:00 al 100% + 1:00 al 200%',
  textoHE(r5));

console.log('\n--- 4. LOS DOS CAMPOS CONVIVEN ---');
const cfgPlano = nuevaConfigRodaje({recargoHE: 100});
ok('con un solo tramo manda recargoHE', escalaDe(cfgPlano)[0].recargo === 100);
ok('así el campo simple de siempre sigue sirviendo',
  casi(costoHEDe(1, vh, escalaDe(cfgPlano)), 20000));
const cfgEsc = nuevaConfigRodaje({tramosHE: TRAMOS_HE_ESCALADO.map(t => ({...t})), recargoHE: 100});
ok('con tramos de verdad mandan los tramos', escalaDe(cfgEsc).length === 4);
ok('y recargoHE deja de pisar', escalaDe(cfgEsc)[0].recargo === 50);
ok('el texto de la escala se lee', escalaTexto(cfgEsc) === '+50% / +100% / +200% / +300%',
  escalaTexto(cfgEsc));

console.log('\n--- 5. EN LA LIQUIDACION DE UNA JORNADA ---');
DB = dbVacia(); sembrar();
const py = getPy(), v = getV();
const cfg = py.configRodaje = nuevaConfigRodaje({horasJornada: 8, tramosHE: TRAMOS_HE_ESCALADO.map(t => ({...t}))});
const j = {numero: 1, parte: {fichadas: {'l:x': {entrada: '08:00', salida: '21:00'}}, comidaIn: '', comidaOut: ''}};
const h = horasDe('l:x', j, cfg, 80000, 'ARS');   /* jornada 80.000 -> hora 10.000 */
ok('13 h trabajadas', h.netos === 13 * 60, fmtHoras(h.netos));
ok('5 h de extra', h.extra === 5 * 60, fmtHoras(h.extra));
ok('con el detalle del reparto', h.detalleHE === '2:00 al 50% + 2:00 al 100% + 1:00 al 200%',
  h.detalleHE);
ok('y el costo escalonado', casi(h.costoHE, 100000), fmt(h.costoHE));
cfg.tramosHE = [{hasta: null, recargo: 50}]; cfg.recargoHE = 50;
const h2 = horasDe('l:x', j, cfg, 80000, 'ARS');
ok('con 50% plano cuesta menos', casi(h2.costoHE, 75000), fmt(h2.costoHE));

console.log('\n--- 6. LA JORNADA DE SCOUTING ---');
ok('existe y arranca en 8 h', nuevaConfigRodaje().horasScouting === 8);
ok('se puede poner distinta', nuevaConfigRodaje({horasScouting: 6}).horasScouting === 6);

console.log('\n--- 7. ESTIMADO VS ACTUAL ---');
DB = dbVacia(); sembrar();
const py7 = getPy(), v7 = getV();
const rb = c => v7.rubros.find(r => r.codigo === c);
const linea = rb('04').lineas[0];
ok('hay una línea para comparar', !!linea, linea && linea.concepto);
const est = totalLinea(linea, v7);

py7.comprobantes = [
  nuevoComprobante({rubro:'04', lineaId:linea.id, importe: est * 1.2, concepto:'Factura del DF', estado:'aprobado'}),
  nuevoComprobante({rubro:'11', importe: 100000, concepto:'Sin línea', estado:'cargado'}),
  nuevoComprobante({rubro:'04', lineaId:linea.id, importe: 999999, concepto:'Rechazado', estado:'rechazado'}),
];
const RL = realPorLinea(py7, v7);
ok('el real se cuelga de la línea', casi(RL.porLinea[linea.id], est * 1.2), fmt(RL.porLinea[linea.id]));
ok('EL RECHAZADO NO CUENTA', RL.porLinea[linea.id] < 999999);
ok('el que no tiene línea suma al rubro', casi(RL.porRubro['11'], 100000));
ok('y queda marcado como suelto', casi(RL.sueltoRubro['11'], 100000));
ok('la línea con comprobante no figura como suelta', !RL.sueltoRubro['04']);

DB.ui.tab = 'presu'; DB.ui.vista = 'interna'; rb('04').abierto = true; render();
const hh = app.innerHTML;
ok('la grilla tiene columna Estimado', /<span class="num">Estimado<\/span>/.test(hh));
ok('y columna Actual', /<span class="num">Actual<\/span>/.test(hh));
ok('la línea muestra su real', /class="lreal/.test(hh));
ok('marcado en rojo porque se pasó', /class="pasado"/.test(hh));
ok('el rubro muestra su real', /class="rreal/.test(hh));

/* y si gasta menos, va en verde */
py7.comprobantes = [nuevoComprobante({rubro:'04', lineaId:linea.id, importe: est * 0.5, estado:'aprobado'})];
render();
ok('si gastó menos va en verde', /class="dentro"/.test(app.innerHTML));

/* sin comprobantes, no inventa nada */
py7.comprobantes = []; render();
ok('sin gastos muestra un guión', /class="vacio"/.test(app.innerHTML));

console.log('\n--- 8. LA MIGRACION ---');
DB = dbVacia(); sembrar();
const cr = getPy().configRodaje; delete cr.tramosHE; cr.recargoHE = 75;
migrar();
ok('a los proyectos viejos les arma un tramo con SU recargo',
  getPy().configRodaje.tramosHE.length === 1 && getPy().configRodaje.tramosHE[0].recargo === 75,
  JSON.stringify(getPy().configRodaje.tramosHE));
ok('y les pone jornada de scouting', getPy().configRodaje.horasScouting === 8);
ok('el número de horas extra no cambia',
  casi(costoHEDe(2, 10000, escalaDe(getPy().configRodaje)), 2 * 10000 * 1.75),
  fmt(costoHEDe(2, 10000, escalaDe(getPy().configRodaje))));

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
