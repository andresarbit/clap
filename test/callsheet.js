/* Callsheet: tiene que armarse solo juntando guion + presupuesto + catálogo. */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

const pr = getPr(), py = getPy(), v = getV();

/* sin guion todavía */
DB.ui.tab = 'callsheet';
ok('sin guion pide cargar el guion', /solapa <b>Desglose<\/b>/.test(vistaCallsheet(pr, py, v)));

guionEjemplo();
ok('con guion pero sin jornadas manda al plan', /Auto-agrupar/.test(vistaCallsheet(pr, py, v)));

setPagJornada(0.25); autoAgrupar();
const d = getD();
console.log('\n--- PLAN ---');
d.escenas.forEach(e => console.log(`  esc ${e.numero}  J${e.jornada}  ${e.intExt} ${e.locacion} (${e.momento})`));
ok('quedan varias jornadas', d.jornadas.length >= 2, d.jornadas.length);
ok('jornadas completas, no objetos pelados', d.jornadas.every(j => j.hospital && j.citaciones && j.direcciones));

DB.ui.jornada = 1;
let C = armarCallsheet(py, v, 1);
console.log('\n--- CALLSHEET JORNADA 1 ---');
console.log('  escenas :', C.escenas.map(e => e.numero).join(', '), '|', octavosATexto(C.octavos), 'pg');
console.log('  locación:', C.locaciones.join(' | '));
console.log('  elenco  :', C.elenco.map(p => p.personaje + ' (esc ' + p.escenas.join(',') + ')').join(', ') || '—');
console.log('  crew    :', C.crew.length, 'personas de los rubros', [...new Set(C.crew.map(c => c.rubro))].join(','));
C.crew.slice(0, 4).forEach(c => console.log(`     ${c.rubro} ${c.funcion.padEnd(28)} ${c.nombre || '(sin asignar)'}`));
console.log('  elementos:', Object.entries(C.elementos).map(([k, x]) => DEPTO(k).l + ':' + x.length).join(' '));

ok('sólo trae las escenas de esa jornada', C.escenas.every(e => e.jornada === 1));
ok('el elenco sale de esas escenas',
  C.elenco.every(p => p.escenas.every(nn => C.escenas.some(e => e.numero === nn))));
ok('cuenta las páginas del día', C.octavos === C.escenas.reduce((s, e) => s + e.octavos, 0));
ok('el crew sale del presupuesto', C.crew.length > 0, C.crew.length + ' líneas');
ok('el crew es sólo de rubros 02-08', C.crew.every(c => RUBROS_CREW.includes(c.rubro)));
ok('linkea con el catálogo por refId',
  C.crew.some(c => c.persona && c.nombre), C.crew.filter(c => c.nombre).map(c => c.nombre).join(', ') || 'ninguno');
ok('trae el teléfono del catálogo', C.crew.filter(c => c.persona).every(c => c.tel === c.persona.tel));

/* cada jornada trae lo suyo */
const C2 = armarCallsheet(py, v, 2);
ok('la jornada 2 trae otras escenas',
  C2.escenas.map(e => e.numero).join() !== C.escenas.map(e => e.numero).join(),
  'J1: ' + C.escenas.map(e => e.numero) + ' | J2: ' + C2.escenas.map(e => e.numero));

/* edición de datos */
DB.ui.jornada = 1;
upJornada('fecha', '2026-09-14');
upJornada('citacion', '06:30');
upJornada('hospital.nombre', 'Hospital Fernández');
upJornada('hospital.tel', '011 4808-2600');
const j1 = d.jornadas.find(x => x.numero === 1);
ok('guarda fecha y citación', j1.fecha === '2026-09-14' && j1.citacion === '06:30', j1.fecha + ' ' + j1.citacion);
ok('guarda campos anidados', j1.hospital.nombre === 'Hospital Fernández' && j1.hospital.tel === '011 4808-2600');
ok('día de la semana', diaSemana('2026-09-14'), diaSemana('2026-09-14'));

const loc = C.locaciones[0];
upDireccion(loc, 'direccion', 'Av. Corrientes 1234');
ok('guarda dirección por locación', j1.direcciones[loc].direccion === 'Av. Corrientes 1234');

upCitacion(C.elenco[0].clave, 'citacion', '07:00');
upCitacion(C.elenco[0].clave, 'maquillaje', '07:30');
ok('guarda citaciones de elenco',
  j1.citaciones[C.elenco[0].clave].citacion === '07:00' && j1.citaciones[C.elenco[0].clave].maquillaje === '07:30');
upCitacion(C.crew[0].clave, 'citacion', '06:00');
ok('guarda citación de crew', j1.citaciones[C.crew[0].clave].citacion === '06:00');

upEscNota(C.escenas[0].id, 'Arrancar con el plano del mate');
ok('guarda nota de escena', d.escenas.find(x => x.id === C.escenas[0].id).notas === 'Arrancar con el plano del mate');

/* los datos de una jornada no se pisan con los de otra */
DB.ui.jornada = 2;
upJornada('citacion', '10:00');
ok('cada jornada guarda lo suyo',
  d.jornadas.find(x => x.numero === 1).citacion === '06:30' && d.jornadas.find(x => x.numero === 2).citacion === '10:00',
  'J1 06:30 / J2 10:00');

/* render de todas las jornadas sin romper */
const errs = [];
d.jornadas.forEach(j => { DB.ui.jornada = j.numero; try { render(); } catch (e) { errs.push('J' + j.numero + ': ' + e.message); } });
ok('renderiza todas las jornadas', !errs.length, errs.join(' | ') || 'sin errores');

/* jornada inexistente cae en la primera, no explota */
DB.ui.jornada = 99;
try { render(); ok('jornada inexistente cae parada', DB.ui.jornada === d.jornadas[0].numero, 'cayó en J' + DB.ui.jornada); }
catch (e) { ok('jornada inexistente cae parada', false, e.message); }

/* el HTML impreso tiene lo que tiene que tener */
DB.ui.jornada = 1;
const html = vistaCallsheet(pr, py, v);
[['título del proyecto', esc(py.nombre)], ['nombre de la productora', esc(pr.nombre)],
['número de jornada', 'JORNADA 1'], ['hospital', 'Hospital Fernández'],
['tabla del plan del día', 'Plan del día'], ['bloque de seguridad', 'Seguridad y contactos'],
['pie', 'generado con CLAP']].forEach(([l, txt]) =>
  ok('el callsheet incluye ' + l, html.includes(txt)));
ok('escapa comillas del proyecto', html.includes('&quot;') && !html.includes('30"<'),
   'Spot Verano - 30\" sale como &quot;');
ok('no inyecta HTML', !/<script/i.test(html));
/* --- migración: jornadas guardadas por la versión anterior del sistema ---- */
console.log('\n--- MIGRACION DE DATOS VIEJOS ---');
const dVieja = getD();
/* la versión anterior guardaba sólo esto */
dVieja.jornadas = [{id:'j_viejo1', numero:1, fecha:'2026-01-05', notas:'nota vieja'},
               {id:'j_viejo2', numero:2, fecha:'', notas:''}];
DB.ui.jornada = 1;
const Cv = armarCallsheet(py, v, 1);
ok('rellena la citación por defecto', Cv.j.citacion === '07:00', Cv.j.citacion);
ok('rellena comida y wrap', Cv.j.comida === '13:00' && Cv.j.wrap === '19:00', Cv.j.comida + ' / ' + Cv.j.wrap);
ok('rellena hospital y contactos', !!Cv.j.hospital && !!Cv.j.emergencia && !!Cv.j.direcciones);
ok('NO pisa lo que ya estaba', Cv.j.fecha === '2026-01-05' && Cv.j.notas === 'nota vieja',
   Cv.j.fecha + ' / "' + Cv.j.notas + '"');
const htmlV = vistaCallsheet(pr, py, v);
ok('el callsheet ya no muestra guiones vacíos', htmlV.includes('07:00') && htmlV.includes('13:00'));
ok('render con datos viejos no explota', (()=>{ try{ DB.ui.tab='callsheet'; render(); return true; }catch(e){ return e.message; } })()===true);
/* y por el camino de migrar() al abrir la app */
dVieja.jornadas = [{id:'j_v3', numero:1, fecha:'', notas:''}];
migrar();
ok('migrar() al abrir también los arregla', dVieja.jornadas[0].citacion === '07:00', dVieja.jornadas[0].citacion);


console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
