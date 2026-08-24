/* Parte de rodaje: citaciones, fichadas y horas extra.
   El cálculo de horas toca plata, así que va probado a fondo. */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

const pr = getPr(), py = getPy(), v = getV();

/* --- 1. aritmética de horas --------------------------------------------- */
console.log('--- 1. ARITMETICA ---');
ok('lapso normal', lapso('07:00', '19:00') === 720, lapso('07:00', '19:00') + ' min');
ok('lapso cruzando medianoche', lapso('20:00', '02:00') === 360, lapso('20:00', '02:00') + ' min');
ok('lapso con hora sin cargar', lapso('07:00', '') === null);
ok('acepta sin dos puntos', lapso('0700', '1900') === 720);
ok('formato de horas', fmtHoras(750) === '12:30', fmtHoras(750));
ok('formato de cero', fmtHoras(0) === '0:00', fmtHoras(0));
ok('formato de nulo', fmtHoras(null) === '—');

/* --- 2. horas trabajadas y extras --------------------------------------- */
console.log('\n--- 2. HORAS Y EXTRAS ---');
guionEjemplo(); autoAgrupar();
const d = getD(); DB.ui.jornada = 1;
const j = normalizarJornada(d.jornadas[0]);
j.citacion = '07:00';
j.parte.comidaIn = '13:00'; j.parte.comidaOut = '14:00'; j.parte.wrap = '21:00';
const cfg = cfgActual();
ok('jornada base por defecto 10 h', cfg.horasJornada === 10, cfg.horasJornada);
ok('recargo por defecto 50%', cfg.recargoHE === 50, cfg.recargoHE);

upFichada('l:test', 'entrada', '07:00');
upFichada('l:test', 'salida', '21:00');
let h = horasDe('l:test', j, cfg, 500000, 'ARS');
ok('brutas 14 h', h.brutos === 840, fmtHoras(h.brutos));
ok('descuenta la comida', h.comida === 60, fmtHoras(h.comida));
ok('netas 13 h', h.netos === 780, fmtHoras(h.netos));
ok('extras 3 h sobre las 10 de base', h.extra === 180, fmtHoras(h.extra));
ok('valor hora = jornada / 10', h.valorHora === 50000, h.valorHora);
ok('costo extras = 3 h × 50.000 × 1,5', Math.round(h.costoHE) === 225000, Math.round(h.costoHE));

/* sin extras */
upFichada('l:corto', 'entrada', '08:00'); upFichada('l:corto', 'salida', '17:00');
h = horasDe('l:corto', j, cfg, 500000, 'ARS');
ok('8 h netas no generan extras', h.netos === 480 && h.extra === 0, fmtHoras(h.netos) + ' / ' + fmtHoras(h.extra));
ok('sin extras el costo es cero', h.costoHE === 0);

/* cruzando medianoche */
upFichada('l:noche', 'entrada', '18:00'); upFichada('l:noche', 'salida', '06:00');
h = horasDe('l:noche', j, cfg, 400000, 'ARS');
ok('rodaje nocturno cruza medianoche', h.brutos === 720, fmtHoras(h.brutos));
ok('nocturno: 1 h extra tras descontar comida', h.extra === 60, fmtHoras(h.extra));

/* sin fichar */
ok('sin fichar avisa que no hay datos', horasDe('l:nadie', j, cfg, 100, 'ARS').sinDatos);

/* config distinta */
cfg.horasJornada = 12; cfg.recargoHE = 100;
h = horasDe('l:test', j, cfg, 600000, 'ARS');
ok('con 12 h de base quedan 1 h de extra', h.extra === 60, fmtHoras(h.extra));
ok('valor hora se recalcula con la base nueva', h.valorHora === 50000, h.valorHora);
ok('recargo 100% duplica la hora', Math.round(h.costoHE) === 100000, Math.round(h.costoHE));
cfg.descontarComida = false;
h = horasDe('l:test', j, cfg, 600000, 'ARS');
ok('sin descontar comida suma 1 h más', h.netos === 840 && h.extra === 120, fmtHoras(h.netos) + ' / ' + fmtHoras(h.extra));
cfg.horasJornada = 10; cfg.recargoHE = 50; cfg.descontarComida = true;

/* --- 3. la gente de la jornada sale del presupuesto ---------------------- */
console.log('\n--- 3. QUIENES PARTICIPAN ---');
const { gente } = gentePorJornada(py, v, 1);
console.log(gente.slice(0, 6).map(g => `  ${g.tipo.padEnd(7)} ${g.rol.padEnd(28)} ${fmt(g.valorJornada, g.moneda)}`).join('\n'));
ok('junta elenco y técnicos', gente.some(g => g.tipo === 'elenco') && gente.some(g => g.tipo === 'tecnico'),
  gente.filter(g => g.tipo === 'elenco').length + ' elenco / ' + gente.filter(g => g.tipo === 'tecnico').length + ' técnicos');
ok('cada uno trae su valor de jornada', gente.filter(g => g.tipo === 'tecnico').some(g => g.valorJornada > 0),
  gente.filter(g => g.valorJornada > 0).length + ' con valor');
/* El elenco liga con el presupuesto por el nombre del personaje. En la semilla
   las líneas se llaman "Actor Principal", así que no matchean — y está bien.
   El camino real es el puente desglose → presupuesto, que crea una línea POR
   PERSONAJE. Eso es lo que hay que probar. */
ok('sin línea que matchee, el elenco queda en cero (y no rompe)',
  gente.filter(g => g.tipo === 'elenco').every(g => g.valorJornada === 0));
const r9 = v.rubros.find(r => r.codigo === '09');
r9.lineas.push(nuevaLinea({ concepto: 'LUCÍA', valorUnit: 1200, moneda: 'USD', dias: 1 }));
r9.lineas.push(nuevaLinea({ concepto: 'VECINO', valorUnit: 300000, moneda: 'ARS', dias: 1 }));
const g2 = gentePorJornada(py, v, 1).gente;
const lucia = g2.find(g => g.rol === 'LUCÍA'), vecino = g2.find(g => g.rol === 'VECINO');
ok('el personaje liga con su línea del presupuesto', lucia && lucia.valorJornada === 1200,
  lucia && lucia.valorJornada);
ok('y conserva la moneda de esa línea', lucia.moneda === 'USD' && vecino.moneda === 'ARS',
  lucia.moneda + ' / ' + vecino.moneda);
ok('el matcheo ignora acentos y mayúsculas', (() => {
  r9.lineas.push(nuevaLinea({ concepto: 'lucia', valorUnit: 999, moneda: 'ARS' }));
  const x = gentePorJornada(py, v, 1).gente.find(g => g.rol === 'LUCÍA');
  r9.lineas.pop();
  return x.valorJornada === 1200;   /* gana la primera coincidencia */
})());
/* las horas extra del elenco se calculan en SU moneda */
upFichada(lucia.clave, 'entrada', '07:00'); upFichada(lucia.clave, 'salida', '21:00');
const hL = horasDe(lucia.clave, j, cfg, lucia.valorJornada, lucia.moneda);
ok('extras del elenco en USD', hL.moneda === 'USD' && Math.round(hL.costoHE) === 540,
  fmtHoras(hL.extra) + ' extras = ' + Math.round(hL.costoHE) + ' USD');

/* --- 4. citaciones ------------------------------------------------------- */
console.log('\n--- 4. CITACIONES ---');
const C = armarCallsheet(py, v, 1);
j.direcciones['COCINA DEPARTAMENTO'] = { direccion: 'Av. Corrientes 1234' };
j.hospital = { nombre: 'Hospital Fernández', tel: '011 4808-2600', direccion: '' };
j.wrap = '21:00';
const alguien = gente.find(g => g.tipo === 'tecnico');
upCitacion(alguien.clave, 'citacion', '06:30');
const txt = textoCitacion(pr, py, j, C, alguien, cfg);
console.log('  ---\n' + txt.split('\n').map(l => '  ' + l).join('\n') + '\n  ---');
ok('trae el proyecto', txt.includes(py.nombre));
ok('trae la jornada', /Jornada 1/.test(txt));
ok('trae la citación individual, no la general', txt.includes('06:30'), '06:30 vs general ' + j.citacion);
ok('trae la locación con dirección', txt.includes('Av. Corrientes 1234'));
ok('trae el hospital', txt.includes('Hospital Fernández'));
ok('trae el wrap', txt.includes('21:00'));
ok('firma con la productora', txt.includes(pr.nombre));

/* teléfonos argentinos → WhatsApp */
console.log('\n  teléfonos:');
[['11 5555-1234', '5491155551234'], ['011 15 5555-1234', '5491155551234'],
['+54 9 11 5555-1234', '5491155551234'], ['1155551234', '5491155551234'],
['0351 15 555-5555', '5493515555555'], ['', ''], ['123', '']].forEach(([e, esp]) => {
  const got = telWhatsapp(e);
  console.log(`    ${JSON.stringify(e).padEnd(20)} -> ${got || '(descarta)'}`);
  ok('teléfono ' + (e || 'vacío'), got === esp, got + ' esperado ' + esp);
});

/* marcar como citado */
marcarCitado(alguien.clave);
ok('marca como citado', j.parte.citados[alguien.clave] === true);
marcarCitado(alguien.clave, false);
ok('se puede desmarcar', j.parte.citados[alguien.clave] === false);
marcarTodos(true);
ok('marcar todos', Object.values(j.parte.citados).filter(Boolean).length === gente.length,
  Object.values(j.parte.citados).filter(Boolean).length + ' de ' + gente.length);
marcarTodos(false);
ok('limpiar marcas', Object.values(j.parte.citados).filter(Boolean).length === 0);

/* --- 5. fichar de una --------------------------------------------------- */
console.log('\n--- 5. FICHAR ---');
j.parte.fichadas = {};
ficharTodos('entrada');
const conEntrada = gente.filter(g => (j.parte.fichadas[g.clave] || {}).entrada).length;
ok('entrada = citación de cada uno', conEntrada === gente.length, conEntrada + ' de ' + gente.length);
ok('respeta la citación individual', j.parte.fichadas[alguien.clave].entrada === '06:30',
  j.parte.fichadas[alguien.clave].entrada);
ficharTodos('salida');
ok('salida = wrap', gente.every(g => j.parte.fichadas[g.clave].salida === '21:00'));
j.parte.fichadas[alguien.clave].salida = '23:30';
ok('se puede corregir uno a mano', j.parte.fichadas[alguien.clave].salida === '23:30');
const hAlg = horasDe(alguien.clave, j, cfg, alguien.valorJornada, alguien.moneda);
ok('el que se quedó tiene más extras', hAlg.extra > 0, fmtHoras(hAlg.extra) + ' extras');

/* no pisa lo ya cargado */
const antes = j.parte.fichadas[alguien.clave].salida;
ficharTodos('salida');
ok('no pisa lo cargado a mano', j.parte.fichadas[alguien.clave].salida === antes, j.parte.fichadas[alguien.clave].salida);

/* --- 6. escenas filmadas ------------------------------------------------- */
console.log('\n--- 6. ESCENAS FILMADAS ---');
const e1 = C.escenas[0];
toggleFilmada(e1.id, true);
ok('marca filmada', j.parte.filmadas.includes(e1.id));
toggleFilmada(e1.id, true);
ok('no duplica', j.parte.filmadas.filter(x => x === e1.id).length === 1);
toggleFilmada(e1.id, false);
ok('desmarca', !j.parte.filmadas.includes(e1.id));

/* --- 7. acumulado y turnaround ------------------------------------------ */
console.log('\n--- 7. ACUMULADO Y DESCANSO ---');
const proy = horasProyecto(py, v, cfg);
console.log(proy.jornadas.map(x => `  J${x.numero}: ${x.fichados} fichados · ${fmtHoras(x.extra)} extras · ${fmt(x.costoARS, 'ARS')}`).join('\n'));
ok('acumula por jornada', proy.jornadas.length === d.jornadas.length, proy.jornadas.length);
ok('el total es la suma', Math.abs(proy.totalARS - proy.jornadas.reduce((s, x) => s + x.costoARS, 0)) < 1);
ok('hay costo de extras', proy.totalARS > 0, fmt(proy.totalARS, 'ARS'));

/* turnaround: wrap 21:00 y citación siguiente 07:00 = 10 h < 12 mínimo */
setPagJornada(0.25); autoAgrupar();
const dd = getD();
if (dd.jornadas.length > 1) {
  normalizarJornada(dd.jornadas[0]).parte.wrap = '21:00';
  normalizarJornada(dd.jornadas[1]).citacion = '07:00';
  const t = turnaround(py, dd.jornadas[0], cfg);
  ok('calcula el descanso', t && t.minutos === 600, t && fmtHoras(t.minutos));
  ok('avisa que es corto', t && t.corto === true, 'mínimo ' + cfg.minTurnaround + ' h');
  normalizarJornada(dd.jornadas[1]).citacion = '10:00';
  const t2 = turnaround(py, dd.jornadas[0], cfg);
  ok('con 13 h ya no avisa', t2 && !t2.corto, fmtHoras(t2.minutos));
}
ok('la última jornada no tiene descanso que calcular',
  turnaround(py, dd.jornadas[dd.jornadas.length - 1], cfg) === null);

/* --- 8. render ----------------------------------------------------------- */
console.log('\n--- 8. RENDER ---');
DB.ui.tab = 'rodaje';
['citaciones', 'parte', 'horas'].forEach(k => {
  try { setSubRodaje(k); render(); ok('render ' + k, true); }
  catch (e) { ok('render ' + k, false, e.message); }
});
const htmlH = horasHTML(pr, py, v, normalizarJornada(dd.jornadas[0]), gentePorJornada(py, v, dd.jornadas[0].numero).gente, cfg);
ok('la vista de horas muestra el total', /Horas extra del día|Cargá las entradas/.test(htmlH));
ok('proyecto sin jornadas manda al plan', (() => {
  const p2 = nuevoProyecto({ nombre: 'Sin plan' }); getPr().proyectos.push(p2);
  return /plan de rodaje/.test(vistaRodaje(pr, p2, p2.versiones[0]));
})());

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
