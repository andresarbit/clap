/* Armar el día y el rodaje de una.
   ---------------------------------------------------------------------------
   Pedido: que proponga orden, corte de almuerzo, citaciones de todo el
   mundo y corte si se necesitan más jornadas; y que al borrar una jornada lo
   que tenía pase al día anterior que quede.                                */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
global.confirm = () => true;

DB = dbVacia(); sembrar();
const pr = getPr();
const py = nuevoProyecto({ nombre: 'Spot Armado', tipo: 'publicidad' }); pr.proyectos.push(py);
DB.ui.proyectoId = py.id; DB.ui.versionId = py.versiones[0].id;
py.desglose = nuevoDesglose();
const p = planDe(py);
const H = horasJornadaDe(py.configRodaje || nuevaConfigRodaje());
/* 30 planos de un spot: cocina (frente, contraplano, cenital), living, calle, y uno de hora dorada */
const descs = [];
for (let i = 1; i <= 30; i++) {
  const set = i <= 14 ? 'Casa - Cocina' : i <= 22 ? 'Casa - Living' : 'Calle - Vereda';
  const tiro = i % 5 === 0 ? 'Contraplano: ' : i % 7 === 0 ? 'Cenital ' : '';
  const quien = i % 3 === 0 ? 'Juan' : 'Ana';
  descs.push([String(i), `${tiro}PM de ${quien} en ${set}`, set, i >= 23 ? 'EXT' : 'INT', i === 28 ? 'dorada' : '', quien]);
}
descs.forEach(([numero, desc, set, intExt, luz, elenco], i) => {
  const it = nuevoItemPlan({ tipo: 'plano', numero, desc, set, intExt, luz, elenco, movimiento: i % 4 === 0 ? 'Dolly' : 'Fijo' });
  it.orden = i + 1; p.items.push(it);
});

console.log('--- 1. ARMAR EL RODAJE DESDE EL BANCO ---');
DB.ui.tab = 'plan'; render();
ok('el banco ofrece "Armar el rodaje"', /plArmarRodaje\(\)/.test(app.innerHTML));
plFoto(py);
const rep = armarRodaje(py);
const js = py.desglose.jornadas;
ok('reparte todo: el banco queda vacío', !p.items.some(x => x.jornada == null && x.tipo === 'plano'));
ok('crea las jornadas que hacen falta', js.length >= 2, js.length + ' jornadas');
const Ds = js.map(j => calcularDia(py, j.numero));
ok('ninguna jornada se pasa de horas', Ds.every(D => D.extra === 0), Ds.map(D => durTexto(D.neto)).join(' · ') + ` (jornada de ${H} h)`);
ok('cada jornada tiene planos', Ds.every(D => D.items > 0));
const puestasEnDia = num => p.items.filter(x => x.jornada === num && x.tipo === 'plano').sort((a, b) => a.orden - b.orden)
  .map(x => x.set + '|' + x.emplazamiento);
ok('dentro del día, cada puesta va junta (no vuelve a una que ya terminó)', js.every(j => { const L = puestasEnDia(j.numero);
  return L.every((k, i) => i === 0 || k === L[i - 1] || !L.slice(0, i).includes(k)); }));
ok('el contraplano es otra puesta que lo de frente', (() => { const a = p.items.find(x => x.numero === '1'), c = p.items.find(x => x.numero === '5');
  return a.set === c.set && a.emplazamiento !== c.emplazamiento; })());

console.log('\n--- 2. EL ALMUERZO ---');
const hasta = (n(p.horasHastaComida) || 6) * 60;
const despuesDeTodo = D => !D.filas.slice(D.filas.indexOf(D.comida) + 1).some(f => f.it && f.it.tipo === 'plano');
ok('cada día tiene el almuerzo dentro de las horas (o, si es corto, después del último plano)', Ds.every(D => !D.comida ||
  (D.comida.inicio - D.inicio <= hasta && (D.comida.inicio - D.inicio >= 180 || despuesDeTodo(D)))),
  Ds.map(D => D.comida ? aHora(D.comida.inicio) : '—').join(' · '));
const enCambio = D => { const i = D.filas.indexOf(D.comida); const ant = D.filas.slice(0, i).reverse().find(f => f.it && f.it.tipo === 'plano');
  const sig = D.filas.slice(i + 1).find(f => f.it && f.it.tipo === 'plano'); return !ant || !sig || claveGrupo(py, ant.it) !== claveGrupo(py, sig.it); };
ok('y cae en un cambio de puesta, no en el medio', Ds.filter(D => D.comida).every(enCambio));
ok('sin avisos de almuerzo', Ds.every(D => !D.avisos.some(a => /almuerzo/i.test(a.txt) && a.nivel === 'mal')), Ds.flatMap(D => D.avisos.map(a => a.txt)).join(' | '));

console.log('\n--- 3. LAS CITACIONES ---');
const j1 = js[0];
const ana = j1.citaciones['p:Ana'];
ok('el elenco queda citado en el callsheet', ana && ana.citacion && ana.auto, JSON.stringify(ana));
const E = elencoDelDia(py, 1);
ok('cada actor, según su primer plano menos maquillaje', E.every(x => j1.citaciones['p:' + x.nombre].citacion === aHora(x.citacion)));
j1.citaciones['p:Juan'] = { citacion: '06:15' };
armarDia(py, 1);
ok('lo que se escribió a mano no se pisa', j1.citaciones['p:Juan'].citacion === '06:15');

console.log('\n--- 4. LA HORA DORADA ---');
const dor = p.items.find(x => x.numero === '28');
const resto = p.items.filter(x => x.jornada === dor.jornada && x.tipo === 'plano' && x !== dor);
ok('el plano de hora dorada queda al final de su día', resto.every(x => x.orden < dor.orden));

console.log('\n--- 5. DESHACER ---');
const antesDeshacer = js.length;
plDeshacer();
ok('deshacer deja todo como estaba (en el banco, sin jornadas nuevas)', p.items.filter(x => x.tipo === 'plano').every(x => x.jornada == null) && py.desglose.jornadas.length < antesDeshacer);

console.log('\n--- 6. ARMAR UN DÍA QUE NO ENTRA ---');
armarRodaje(py);
const total = py.desglose.jornadas.length;
/* todo a la jornada 1 y armar sólo ese día */
p.items.filter(x => x.tipo === 'plano').forEach(x => meterEnJornada(py, x, 1));
p.items.find(x => x.numero === '2').estado = 'filmado';
const r6 = armarDia(py, 1);
ok('lo que no entra pasa a la siguiente', r6.pasados > 0 && calcularDia(py, 1).extra === 0);
ok('y la siguiente también se arma', [...r6.jornadas].length >= 2 && [...r6.jornadas].every(num => calcularDia(py, num).extra === 0));
ok('lo filmado no se mueve de día', p.items.find(x => x.numero === '2').jornada === 1);

console.log('\n--- 7. QUITAR UNA JORNADA DEL MEDIO ---');
while (py.desglose.jornadas.length < 3) nuevaJornadaPlan(py);
const d = py.desglose;
const de2 = p.items.filter(x => x.jornada === 2 && x.tipo !== 'evento');
const de3 = p.items.filter(x => x.jornada === 3 && x.tipo !== 'evento');
const fecha3 = d.jornadas[2].fecha, n0 = d.jornadas.length;
DB.ui.jornada = 2;
plQuitarJornada(2);
ok('se quita la del medio (no sólo la última)', d.jornadas.length === n0 - 1);
ok('lo que tenía la 2 pasa a la 1 (el día anterior)', de2.every(x => x.jornada === 1));
ok('la 3 pasa a ser la 2, con su fecha y sus planos', d.jornadas[1].fecha === fecha3 && de3.every(x => x.jornada === 2));
ok('no queda nada colgado en una jornada que no existe', p.items.every(x => x.jornada == null || x.jornada <= d.jornadas.length));
plQuitarJornada(1);
ok('si se quita la primera, lo suyo pasa a la que queda primera', p.items.filter(x => x.tipo === 'plano').every(x => x.jornada === 1 || x.jornada == null));

console.log('\n--- 8. EL RENGLÓN DICE EN QUÉ JORNADA ESTÁ ---');
DB.ui.jornada = 1; render();
ok('el desplegable muestra la jornada actual', /<option value="" selected>J1<\/option>/.test(app.innerHTML));
ok('y ofrece el banco', /→ Banco/.test(app.innerHTML));

console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
