/* Grip y Maquillaje y Peinado como rubros aparte (códigos 18 y 19, que en
   pantalla son el 06 y el 09), la migración de los presupuestos de antes,
   las «Jornadas de 8 h» de la línea de rodaje (la línea de preproducción
   atada), los encabezados Preproducción / Rodaje y el catálogo de funciones
   con los «Gastos del área» aparte. También que el convenio siga
   encontrando el cargo con los nombres nuevos y con los de antes.
   Uso: node test/run.js test/rubros-partidos.js                             */
(() => {
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

console.log('--- SICA de los nombres nuevos y viejos ---');
const E = escalaSICA('2026-10-10');
[['Director de Fotografía','DIRECTOR/A DE FOTOGRAFIA'],['Gaffer','GAFFER'],['Jefe de eléctricos','JEFE/A ELECTRICO/A'],['Jefe eléctrico','JEFE/A ELECTRICO/A'],
 ['Eléctrico','ELECTRICO/A'],['Operador de generador','OP. DE GENERADOR'],['Generadorista','OP. DE GENERADOR'],['Key Grip','KEY GRIP'],
 ['Foquista (1° asistente de cámara)','ASISTENTE (FOQUISTA)'],['Foquista (1° AC)','ASISTENTE (FOQUISTA)'],
 ['Ayudante de cámara','AYUDANTE'],['2° Asistente de Cámara','AYUDANTE'],['Video assist (VTR)','VIDEO ASISTENTE'],['Video Assist','VIDEO ASISTENTE'],
 ['Operador HD (DIT)','OPERADOR/A HD'],['DIT','OPERADOR/A HD'],['Ayudante de operador HD (Data manager)','AYTE. OPERADOR/A HD'],['Data manager','AYTE. OPERADOR/A HD'],
 ['Utilero','UTILERO/A - CARPINTERO/A'],['Ayudante de utilero','AYUDANTE'],['Maquillador/a','MAQUILLADOR/A'],['Peinador/a','PEINADOR/A']].forEach(([f, c]) => {
  const x = cargoSICA(f, E); ok(f, x && x.c === c, x ? x.d + ' · ' + x.c + ' r' + x.r : 'nada'); });
ok('Ayudante de cámara es de cámara', cargoSICA('Ayudante de cámara', E).d === 'Fotografía y Cámara');
ok('Ayudante de utilero es de utilería', cargoSICA('Ayudante de utilero', E).d === 'Utilería');
ok('Key Grip del convenio va al rubro 18', cargoSICA('Key Grip', E).r === '18');
ok('Maquilladora va al 19', cargoSICA('Maquillador/a', E).r === '19');
ok('Grip sin convenio', cargoSICA('Grip', E) === null);

console.log('--- números que ve la gente ---');
ok('orden', RUBROS_BASE.map(r => r.codigo).join(',') === '01,02,03,04,05,18,06,07,19,08,09,10,11,12,13,14,15,16,17');
ok('Luces 05, Grip 06, Arte 07, Vestuario 08, Maquillaje 09, Sonido 10, Elenco 11, Administración 19',
  ['05','18','06','07','19','08','09','17'].map(numRubro).join(',') === '05,06,07,08,09,10,11,19');
ok('un rubro agregado a mano muestra su código', numRubro('23') === '23');
ok('catálogo de Grip', FUNCIONES['18'].includes('Key Grip') && FUNCIONES['18'].includes('Fletes y envíos'));
ok('SUBRUBROS en orden (fletes: primero dirección)', SUBRUBROS.find(x => x.s === 'Fletes y envíos').r === '02');

console.log('--- la migración ---');
DB = dbVacia(); sembrarChico();
const py = getPy(), v = getV();
/* un presupuesto de antes: 17 rubros, Eléctrica y Grip junto, y uno agregado a mano con el 18 */
v.rubros = v.rubros.filter(r => !['18', '19'].includes(r.codigo));
v.rubros.find(r => r.codigo === '05').nombre = 'Eléctrica y Grip';
v.rubros.find(r => r.codigo === '07').nombre = 'Vestuario, Maquillaje y Peinado';
const r05 = v.rubros.find(r => r.codigo === '05'), r07 = v.rubros.find(r => r.codigo === '07');
r05.aplicaFee = false;
const lg = nuevaLinea({concepto: 'Gaffer', valorUnit: 300000, area: 'electrica'}), lk = nuevaLinea({concepto: 'Key Grip', valorUnit: 280000, area: 'electrica', refId: 'pX'}),
  lgr = nuevaLinea({concepto: 'Grip', valorUnit: 200000, cantidad: 2}), lhe = nuevaLinea({concepto: 'Horas extra — Key Grip', unidad: 'hora', valorUnit: 50000, dias: 4});
r05.lineas = [lg, lk, lgr, lhe];
const lv = nuevaLinea({concepto: 'Vestuarista', valorUnit: 250000}), lm = nuevaLinea({concepto: 'Maquillador/a', valorUnit: 260000, area: 'vestuario'}),
  li = nuevaLinea({concepto: 'Insumos de maquillaje', unidad: 'global', valorUnit: 90000});
r07.lineas = [lv, lm, li];
v.rubros.push({id: 'rbX', codigo: '18', nombre: 'Animación', aplicaFee: true, lineas: [nuevaLinea({concepto: 'Animador', valorUnit: 500000})], abierto: false});
const cp = nuevoComprobante({rubro: '05', subrubro: 'Key Grip', importe: 100000, lineaId: lk.id});
const cp2 = nuevoComprobante({rubro: '05', subrubro: 'Gaffer', importe: 100000, lineaId: lg.id});
py.comprobantes.push(cp, cp2);
const antes = calcular(v);
migrar();
const despues = calcular(v);
const RV = c => v.rubros.find(r => r.codigo === c);
ok('el total no cambia', Math.round(antes.total) === Math.round(despues.total) && Math.round(antes.fee) === Math.round(despues.fee), `${antes.total} → ${despues.total} · fee ${antes.fee} → ${despues.fee}`);
ok('el agregado a mano se corrió a un código libre', RV('20') && RV('20').nombre === 'Animación' && RV('18').nombre === 'Grip');
ok('Eléctrica (Luces) se queda con el gaffer', RV('05').nombre === 'Eléctrica (Luces)' && RV('05').lineas.map(l => l.concepto).join() === 'Gaffer');
ok('Grip tiene key grip, grip y sus horas extra, con los mismos ids', RV('18').lineas.map(l => l.id).join() === [lk.id, lgr.id, lhe.id].join());
ok('la persona sigue atada', RV('18').lineas[0].refId === 'pX');
ok('el área automática pasa a grip', RV('18').lineas[0].area === 'grip' && RV('18').lineas[1].area === '');
ok('Grip hereda «sin fee» de Eléctrica', RV('18').aplicaFee === false);
ok('maquillaje aparte', RV('19').lineas.map(l => l.concepto).join() === 'Maquillador/a,Insumos de maquillaje' && RV('07').nombre === 'Vestuario' && RV('07').lineas.length === 1);
ok('en orden', v.rubros.map(r => r.codigo).join(',') === '01,02,03,04,05,18,06,07,19,08,09,10,11,12,13,14,15,16,17,20', v.rubros.map(r => r.codigo).join(','));
ok('el gasto atado a la línea de grip se muda; el del gaffer no', cp.rubro === '18' && cp2.rubro === '05');
const ids = JSON.stringify(v.rubros.map(r => [r.id, r.lineas.map(l => l.id)]));
migrar(); partirRubros(py);
ok('idempotente', JSON.stringify(v.rubros.map(r => [r.id, r.lineas.map(l => l.id)])) === ids);
/* un grip puesto a propósito en Eléctrica después ya no se mueve */
RV('05').lineas.push(nuevaLinea({concepto: 'Grip de refuerzo'})); migrar();
ok('una vez partida, no se vuelve a tocar', RV('05').lineas.some(l => l.concepto === 'Grip de refuerzo'));
/* dos compus que parten a la vez arman el mismo rubro */
const vv = JSON.parse(JSON.stringify(v)); delete vv.rubrosPartidos; vv.rubros = vv.rubros.filter(r => !['18','19'].includes(r.codigo));
const a1 = JSON.parse(JSON.stringify(vv)), a2 = JSON.parse(JSON.stringify(vv)); partirRubrosVersion(a1); partirRubrosVersion(a2);
ok('el id del rubro nuevo sale de la versión', a1.rubros.find(r => r.codigo === '18').id === a2.rubros.find(r => r.codigo === '18').id);
/* lo que llega de la base sin partir se parte al ponerlo */
const datos = PARTES_PY.presupuesto.lee(py); datos.versiones.forEach(x => { delete x.rubrosPartidos; const g = x.rubros.find(r => r.codigo === '18');
  const e = x.rubros.find(r => r.codigo === '05'); e.lineas.push(...g.lineas); x.rubros = x.rubros.filter(r => r !== g); });
PARTES_PY.presupuesto.pone(py, JSON.parse(JSON.stringify(datos)));
ok('al recibir el presupuesto de la base, se parte', getV().rubros.find(r => r.codigo === '18').lineas.some(l => l.concepto === 'Key Grip'));

console.log('--- jornadas de 8 h ---');
DB = dbVacia(); sembrar();
const P = getPy(), V = getV(); DB.ui.usuarioId = getPr().usuarios.find(u => u.rol === 'ejecutivo').id;
const r04 = V.rubros.find(r => r.codigo === '04');
const df = r04.lineas.find(l => l.concepto === 'Director de Fotografía' && !l.etapa);
const pre0 = lineaPrepro(r04, df);
ok('la prepro de la plantilla se reconoce', pre0 && pre0.etapa === 'prepro' && n(pre0.dias) === 1, pre0 && pre0.dias);
const nAntes = r04.lineas.length;
setJornadas8(r04.id, df.id, 3);
ok('no duplica: pone al día la que había', r04.lineas.length === nAntes && pre0.dias === 3 && pre0.preDe === raizLinea(df));
ok('a 8 h del convenio', pre0.valorUnit === cargoSICA('Director de Fotografía', escalaDelProyecto(P)).j8, pre0.valorUnit);
const foq = r04.lineas.find(l => /^Foquista/.test(l.concepto) && !l.etapa);
ok('el foquista lleva el campo', llevaJornadas8(foq, r04) && !lineaPrepro(r04, foq));
setJornadas8(r04.id, foq.id, 2);
const pf = lineaPrepro(r04, foq);
ok('crea la de prepro, atada, con la misma persona', pf && pf.etapa === 'prepro' && pf.dias === 2 && pf.cantidad === foq.cantidad && pf.refId === foq.refId && pf.preDe === raizLinea(foq));
ok('valor de 8 h', pf.valorUnit === cargoSICA(foq.concepto, escalaDelProyecto(P)).j8 && pf.sica.horas === 8);
const GG = genteDelProyecto(P, V).filter(g => g.funciones.some(f => /^Foquista/.test(f)));
ok('es UNA persona con dos líneas', GG.length === 1 && GG[0].lineas.length === 2, GG.map(g => g.lineas.length).join());
setJornadas8(r04.id, foq.id, 0);
ok('en 0 se borra', !lineaPrepro(r04, foq));
toastAccion();
ok('y Deshacer la vuelve', lineaPrepro(r04, foq) === pf);
const gaffer = V.rubros.find(r => r.codigo === '05').lineas.find(l => l.concepto === 'Gaffer');
ok('gaffer sí, alquiler no', llevaJornadas8(gaffer, V.rubros.find(r => r.codigo === '05')) && !llevaJornadas8(V.rubros.find(r => r.codigo === '11').lineas[0], V.rubros.find(r => r.codigo === '11')));
const grip = V.rubros.find(r => r.codigo === '18').lineas.find(l => l.concepto === 'Grip');
setJornadas8(V.rubros.find(r => r.codigo === '18').id, grip.id, 1);
ok('grip sin convenio: la línea queda en cero para completar', lineaPrepro(V.rubros.find(r => r.codigo === '18'), grip).valorUnit === 0);
/* la vista */
DB.ui.tab = 'presu'; DB.ui.vista = 'interna'; r04.abierto = true; render();
const h = app.innerHTML;
ok('encabezados Preproducción y Rodaje', /etgrupo et-prepro"><span>Preproducción/.test(h) && /etgrupo et-rodaje"><span>Rodaje/.test(h));
ok('el campo en la línea', /Jornadas de 8 h/.test(h) && /setJornadas8\(/.test(h));
ok('números de rubro a la vista', /<span class="rcode">06<\/span>\s*<span class="rname">Grip/.test(h) && /<span class="rcode">09<\/span>\s*<span class="rname">Maquillaje y Peinado/.test(h));
/* el jefe de producción ve plata; el equipo no ve el presupuesto */
DB.ui.usuarioId = getPr().usuarios.find(u => u.rol === 'equipo').id;
ok('el equipo no ve el campo', chipJornadas8(df, r04) === '');
/* duplicar la versión: la atadura sigue */
DB.ui.usuarioId = getPr().usuarios.find(u => u.rol === 'ejecutivo').id;
const c = JSON.parse(JSON.stringify(V)); c.rubros.forEach(r => r.lineas.forEach(l => { l.origenId = raizLinea(l); l.id = uid('ln'); }));
const c04 = c.rubros.find(r => r.codigo === '04'), cdf = c04.lineas.find(l => l.concepto === 'Director de Fotografía' && !l.etapa);
ok('copiada la versión, sigue atada', lineaPrepro(c04, cdf) && lineaPrepro(c04, cdf).dias === 3);

console.log('--- catálogo de funciones ---');
modal = null; pickFuncion(r04.id);
const m = modal || '';
ok('Gastos del área aparte, después de los puestos', m.indexOf('Gastos del área') > m.indexOf('Director de Fotografía') && m.indexOf('Fletes y envíos') > m.indexOf('Gastos del área'));
modal = null; pickFuncion(V.rubros.find(r => r.codigo === '18').id);
ok('Grip muestra lo de grip', /06 · Grip/.test(modal) && /Key Grip/.test(modal) && !/Gaffer/.test(modal));
console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
})();
