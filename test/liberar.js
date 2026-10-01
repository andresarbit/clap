/* En el set: los asistentes de producción cierran el día y liberan gente;
   eso calcula las horas reales y llega a la liquidación, también para
   locaciones, equipos y transporte que se cobran por jornada.             */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
global.confirm = () => true;

DB = dbVacia(); sembrar();
const pr = getPr();
const py = nuevoProyecto({ nombre: 'Spot Set', tipo: 'publicidad' }); pr.proyectos.push(py);
DB.ui.proyectoId = py.id; DB.ui.versionId = py.versiones[0].id;
const v = getV();
const R_ = c => v.rubros.find(r => r.codigo === c);
['02','03','04','05','06','07','08','09','10','11','12'].forEach(c => { if (R_(c)) R_(c).lineas = []; });
const linea = (c, concepto, o = {}) => { const l = nuevaLinea({ concepto, cantidad: 1, dias: 1, valorUnit: 120000, unidad: 'jornada', ...o }); R_(c).lineas.push(l); return l; };
const gaffer = linea('05', 'Gaffer');
const asist = linea('03', 'Asistente de producción');
const franco = linea('09', 'Franco', { valorUnit: 200000 });
const estudio = linea('10', 'Estudio Arenas', { valorUnit: 500000 });
const camion = linea('12', 'Camión de luces', { valorUnit: 80000, dias: 2 });
const alq = linea('11', 'Alquiler de cámara', { unidad: 'global' });

py.desglose = nuevoDesglose(); nuevaJornadaPlan(py); nuevaJornadaPlan(py);
const [j1, j2] = py.desglose.jornadas;
const p = planDe(py);
[1, 2].forEach(num => { const it = nuevoItemPlan({ tipo: 'plano', numero: String(num), desc: 'Franco', set: 'Arenas - Oficina', elenco: 'Franco' }); p.items.push(it); meterEnJornada(py, it, num); });
const cfg = py.configRodaje || (py.configRodaje = nuevaConfigRodaje());

console.log('--- 1. EL PARTE: LLEGÓ Y LIBERAR ---');
DB.ui.tab = 'rodaje'; DB.ui.subRodaje = 'parte'; DB.ui.jornada = 1; render();
const h1 = app.innerHTML;
ok('cada uno tiene "Llegó"', (h1.match(/>Llegó</g) || []).length >= 3);
ok('liberar por departamento', /rdLiberarGrupo\('Eléctrica y Grip'\)/.test(h1) && /Liberar a todo Eléctrica y Grip/.test(h1));
ok('y a todos los que quedan', /rdLiberarGrupo\('\*'\)/.test(h1));
ok('la salida propone la hora en que el plan lo libera', new RegExp('placeholder="' + j1.citaciones['p:Franco'].libera + '"').test(h1));
rdFichar('l:' + gaffer.id, 'entrada', '06:00');
render();
ok('al llegar queda "en set" y aparece "Liberar"', /rd-est set">en set/.test(app.innerHTML) && /rdFichar\('l:[^']+','salida'\)/.test(app.innerHTML));
rdFichar('l:' + gaffer.id, 'salida', '16:00');
ok('liberado: queda la salida', j1.parte.fichadas['l:' + gaffer.id].salida === '16:00');
rdFichar('p:Franco', 'entrada', '06:00'); rdFichar('p:Franco', 'salida', '20:00');
rdLiberarGrupo('Equipo de Producción', '19:00');
const fa = j1.parte.fichadas['l:' + asist.id];
ok('liberar al departamento: entra a su citación y sale ahora', fa && fa.entrada === (j1.citaciones['l:' + asist.id] || {}).citacion && fa.salida === '19:00', JSON.stringify(fa));
ok('no toca a los que ya estaban liberados', j1.parte.fichadas['l:' + gaffer.id].salida === '16:00');
ok('el reloj redondea a 5 minutos', /^\d\d:\d[05]$/.test(ahoraHHMM()));

console.log('\n--- 2. LOCACIONES, EQUIPOS Y TRANSPORTE ---');
render();
ok('el parte los lista (lo que se cobra por jornada)', /Locaciones, equipos y transporte/.test(app.innerHTML) && /Estudio Arenas/.test(app.innerHTML) && /Camión de luces/.test(app.innerHTML));
ok('no lo que se cobra global', !/Alquiler de cámara/.test(app.innerHTML.split('Locaciones, equipos y transporte')[1] || ''));
upFichada('l:' + estudio.id, 'entrada', '05:00'); upFichada('l:' + estudio.id, 'salida', '19:00');
rdContrato('l:' + estudio.id, '12');
const he = horasProveedor('l:' + estudio.id, j1, cfg, 500000);
ok('el estudio: 14 h contra 12 contratadas = 2 h de más', he.brutos === 14 * 60 && he.extra === 120, JSON.stringify({ b: he.brutos, e: he.extra }));
ok('al valor hora de su jornada, sin recargo', Math.round(he.costoHE) === Math.round(2 * 500000 / 12));

console.log('\n--- 3. LA SEGUNDA JORNADA ---');
DB.ui.jornada = 2;
rdFichar('l:' + gaffer.id, 'entrada', '07:00'); rdFichar('l:' + gaffer.id, 'salida', '15:00');
upFichada('l:' + camion.id, 'entrada', '06:00'); upFichada('l:' + camion.id, 'salida', '15:00');

console.log('\n--- 4. LA LIQUIDACIÓN ---');
const G = genteDelProyecto(py, v);
const Lg = liquidarPersona(py, v, G.find(g => g.lineas.some(x => x.l === gaffer)));
ok('el gaffer trabajó 2 jornadas con 1 presupuestada', Lg.trabajadas === 2 && Lg.presRodaje === 1 && Lg.deMas === 1);
ok('la jornada de más se suma sola', Lg.montoDias === 120000 && Lg.total === Lg.base + Lg.montoDias + Lg.he + Lg.ajuste);
ok('y sus horas extra (10 h el primer día)', Lg.heHoras > 0, Lg.heHoras);
const Lf = liquidarPersona(py, v, G.find(g => g.lineas.some(x => x.l === franco)));
ok('LAS EXTRAS DEL ELENCO LLEGAN (fichado como "Franco")', Lf.heHoras > 0 && Lf.he > 0, Lf.heHoras + ' h');
const La = liquidarPersona(py, v, G.find(g => g.lineas.some(x => x.l === asist)));
ok('una jornada sin parte se avisa, no se descuenta', La.trabajadas === 1 && La.presRodaje === 1 && !La.faltan && La.total >= La.base);
DB.ui.tab = 'personal'; DB.ui.subPersonal = 'liquidacion'; render();
ok('la liquidación muestra jornadas y lo de más', /title="Jornadas de rodaje fichadas en el parte">Jornadas/.test(app.innerHTML) && /2 de 1/.test(app.innerHTML) && /\(1 de más\)/.test(app.innerHTML));
const Pv = proveedoresDelRodaje(py, v);
const Le = liquidarProveedor(py, v, Pv.find(x => x.l === estudio));
ok('el estudio: 1 de 1 jornadas, 2 h de más', Le.usadas === 1 && Math.round(Le.heHoras) === 2 && Le.total > Le.base);
const Lc = liquidarProveedor(py, v, Pv.find(x => x.l === camion));
ok('el camión: 1 de 2 jornadas (no se descuenta) y 9 h contra 8 = 1 h de más', Lc.usadas === 1 && Lc.pres === 2 && Lc.deMas === 0 && Math.round(Lc.heHoras) === 1);
ok('y van en una tabla de proveedores, con su planilla', /Proveedores del rodaje/.test(app.innerHTML) && /bajarLiquidacionProveedores\(\)/.test(app.innerHTML));

console.log('\n--- 5. HORAS Y EXTRAS DEL DÍA ---');
DB.ui.tab = 'rodaje'; DB.ui.subRodaje = 'horas'; DB.ui.jornada = 1; render();
ok('la vista de horas muestra a los proveedores con sus horas de más', /Locaciones, equipos y transporte/.test(app.innerHTML) && /Estudio Arenas/.test(app.innerHTML));

console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
