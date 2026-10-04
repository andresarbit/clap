/* Los ejercicios sugeridos: de un toque, desde la BASE, un juego de maneras
   de hacer lo mismo (comprimir con horas extra a distintas intensidades,
   una jornada más sin extras, jornada larga o corta, otra cámara, sin cada
   cámara especial, el equipo, los extras, una sola locación y la post),
   cada uno con su nombre, lo que cambia y los avisos cuando rompe una regla
   (el tope de horas extra, el descanso entre jornadas, las puestas que no
   entran). Se editan o se borran como cualquier versión, y la comparación
   va uno por renglón, ordenable por total.
   Con el ejemplo de la app (Cumbre, en cotización).
   Uso: node test/run.js test/sugeridos.js                                    */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
global.confirm = () => true;

DB = dbVacia(); sembrar();
const pr = getPr(), py = pr.proyectos[1];
const U = r => pr.usuarios.find(u => u.rol === r);
const como = r => { DB.ui.usuarioId = U(r).id; modal = null; };
DB.ui.proyectoId = py.id;
como('ejecutivo');
const base = baseDe(py), cfg = py.configRodaje, M0 = medidasVersion(py, base);
const nombres = () => familiaCotiz(py).map(v => v.nombre);

console.log('--- 1. LAS REGLAS: TOPE, DESCANSO Y PUESTAS ---');
ok('el tope de horas extra por jornada: 6 h si no se cambió', topeHE(cfg) === 6 && topeHE({topeHE: 8}) === 8);
let e = crearEjercicio(py, base, {jornadas: 1, he: 8}).v;
let av = avisosEjercicio(py, e);
ok('+8 h pasa el tope: aviso grave', av.some(a => a.k === 'tope' && a.nivel === 'mal' && /pasa el tope de 6 h/.test(a.t)), av.map(a => a.t).join(' / '));
e = crearEjercicio(py, base, {jornadas: 2, he: 2}).v;
av = avisosEjercicio(py, e);
/* 12 h de jornada + 2 extra + 1 de almuerzo = 15 h: del wrap a la citación quedan 9 h, y el mínimo es 12 */
ok('jornadas seguidas con extras: el descanso queda en 9 h (mínimo 12)', av.some(a => a.k === 'descanso' && /queda en 9 h/.test(a.t) && /mínimo es 12 h/.test(a.t)), av.map(a => a.t).join(' / '));
e = crearEjercicio(py, base, {jornadas: 1, he: 6}).v;
ok('una sola jornada no tiene descanso que cuidar', !avisosEjercicio(py, e).some(a => a.k === 'descanso'));
e = crearEjercicio(py, base, {jornadas: 1, he: 4}).v;
av = avisosEjercicio(py, e);
const A = analizarDesglose(py);
ok('en 1 jornada de 16 h no entran las puestas del desglose', av.some(a => a.k === 'puestas' && /No entran las puestas/.test(a.t)), av.map(a => a.t).join(' / '));
ok('…con +6 h sí (con la tolerancia de la estimación)', !avisosEjercicio(py, crearEjercicio(py, base, {jornadas: 1, he: 6}).v).some(a => a.k === 'puestas'));
ok('la base no tiene avisos de reglas', !avisosEjercicio(py, base).some(a => ['tope', 'descanso', 'puestas'].includes(a.k)));
const cfg2 = {...cfg}; py.configRodaje = {...cfg, topeHE: 4};
ok('el tope se cambia por proyecto (Condiciones de la jornada)', avisosEjercicio(py, crearEjercicio(py, base, {jornadas: 1, he: 6}).v).some(a => a.k === 'tope'));
py.configRodaje = cfg2;

console.log('\n--- 2. GENERAR LOS SUGERIDOS ---');
const antes = py.versiones.length;
const sug = ejerciciosSugeridos(py, base);
ok('el juego propuesto desde la base', sug.length >= 12, sug.map(x => x.o.nombre).join(' | '));
const toasts = []; const toastOrig = toast; toast = (m, o) => toasts.push({m, o});
const nuevos = generarSugeridos(py);
toast = toastOrig;
ok('se crean como versiones del presupuesto (ejercicios contra la base)', nuevos.length > 0 && py.versiones.length === antes + nuevos.length && nuevos.every(v => v.ejercicio && v.ejercicio.deId === base.id && v.ejercicio.sugerido));
const N = n => familiaCotiz(py).find(v => v.nombre === n);
['1 jornada con +4 h extra', '3 jornadas, cómoda (sin extras)', 'Jornada larga: 2 × 14 h', 'Jornada corta: 2 × 10 h', 'Sin dron', 'Sin car rig / brazo ruso',
  'Sin alta velocidad (Phantom)', 'Equipo reducido (−5 personas)', 'Equipo completo (+3 personas)', 'Menos extras (8)', 'Más extras (24)', 'Una sola locación (Ruta)',
  'Post simple: packshot filmado, sin 3D'].forEach(nm => ok(`«${nm}»`, !!N(nm), N(nm) ? cambiosVsBase(py, N(nm)).texto : nombres().join(' | ')));
ok('no repite lo que ya estaba: «1 jornada con horas extra» (+6 h) y «2 cámaras»',
  !N('1 jornada con +6 h extra') && nombres().filter(x => x === '2 cámaras').length === 1 && !!N('1 jornada con horas extra'));
ok('lo que cambia, en palabras (comprimir con +4 h)', cambiosVsBase(py, N('1 jornada con +4 h extra')).items.includes('Jornadas 2 → 1 (+4 h extra c/u)'));
ok('cómoda: una jornada más y ninguna hora extra', medidasVersion(py, N('3 jornadas, cómoda (sin extras)')).jornadas === 3 && medidasVersion(py, N('3 jornadas, cómoda (sin extras)')).he === 0);
ok('jornada larga: mismas jornadas, +2 h cada una', cambiosVsBase(py, N('Jornada larga: 2 × 14 h')).items.includes('Horas extra: +2 h por jornada'));
const corta = N('Jornada corta: 2 × 10 h');
ok('jornada corta: dice la jornada nueva', cambiosVsBase(py, corta).items.includes('Jornada de 12 h → 10 h'));
const dfB = base.rubros.find(r => r.codigo === '04').lineas.find(l => l.concepto === 'Director de Fotografía' && !l.etapa);
const dfC = corta.rubros.find(r => r.codigo === '04').lineas.find(l => l.concepto === 'Director de Fotografía' && !l.etapa);
const cargoDF = cargoSICA('Director de Fotografía', escalaDelProyecto(py));
ok('…el DF cobra la jornada de 10 h del convenio (con la escala de extras del proyecto)', dfC.valorUnit === valorJornadaSICA(cargoDF, {...cfg, horasJornada: 10}) && dfC.valorUnit < dfB.valorUnit, `${dfB.valorUnit} → ${dfC.valorUnit}`);
ok('…y el chip del convenio la da por buena (no la marca vieja)', !estadoSICA(dfC, py).desactualizado && estadoSICA(dfC, py).horas === 10);
ok('…los que cobran un fee propio no cambian', corta.rubros.find(r => r.codigo === '04').lineas.find(l => l.concepto === 'Piloto de Drone').valorUnit === 450000);
ok('sin dron: salen el alquiler y el piloto', ['Alquiler de drone', 'Piloto de Drone'].every(c => !N('Sin dron').rubros.some(r => r.lineas.some(l => l.concepto === c))) && /Sale: Piloto de Drone, Alquiler de drone/.test(cambiosVsBase(py, N('Sin dron')).texto));
ok('sin Phantom: la cámara y el técnico', /Técnico de Phantom/.test(cambiosVsBase(py, N('Sin alta velocidad (Phantom)')).texto) && /Cámara de alta velocidad/.test(cambiosVsBase(py, N('Sin alta velocidad (Phantom)')).texto));
ok('equipo reducido: una persona menos por área grande (la cabeza queda)', (() => { const M = medidasVersion(py, N('Equipo reducido (−5 personas)')); return M.personas === M0.personas - 5 && ['03', '04', '05', '06', '07'].every(c => M.crew[c] === M0.crew[c] - 1); })());
ok('una sola locación: sale el mirador', /Sale: Locación — MIRADOR/.test(cambiosVsBase(py, N('Una sola locación (Ruta)')).texto));
const ps = N('Post simple: packshot filmado, sin 3D');
ok('post simple: sale el 3D y entra el packshot filmado (sin valor: lo avisa)', /Sale: Packshot 3D/.test(cambiosVsBase(py, ps).texto) && avisosEjercicio(py, ps).some(a => a.k === 'valor'));
ok('cada uno más barato o más caro que la base, como corresponde', calcular(N('1 jornada con +4 h extra')).total < calcular(base).total && calcular(N('3 jornadas, cómoda (sin extras)')).total > calcular(base).total && calcular(N('Sin dron')).total < calcular(base).total);
ok('comprimir con +4 h avisa que no entran las puestas', avisosEjercicio(py, N('1 jornada con +4 h extra')).some(a => a.k === 'puestas'));
ok('la jornada larga avisa el descanso', avisosEjercicio(py, N('Jornada larga: 2 × 14 h')).some(a => a.k === 'descanso'));
ok('el aviso dice cuántos y que se editan o se borran, con Deshacer', toasts.some(t => /ejercicios sugeridos contra la base/.test(t.m) && t.o && t.o.accion === 'Deshacer'));
ok('y abre la comparación', /Comparar ejercicios/.test(modal || ''));
modal = null;
ok('generar otra vez no duplica nada', generarSugeridos(py, {silencioso: true}).length === 0);

console.log('\n--- 3. LA COMPARACIÓN CON MUCHOS ---');
const F = filasComparacion(py, getUsuario(), 'total');
ok('ordenada por total, de menor a mayor', F.every((x, i) => !i || F[i - 1].visible <= x.visible));
const F2 = filasComparacion(py, getUsuario(), '-total');
ok('y al revés', F2[0].visible === Math.max(...F.map(x => x.visible)));
ok('en el orden de creación, la base primero', filasComparacion(py)[0].esBase);
DB.ui.cmpOrden = 'orden'; compararEjercicios();
ok('uno por renglón: un <tr> por ejercicio', (modal.match(/<tr class="/g) || []).length === familiaCotiz(py).length);
ok('con los títulos para ordenar y lo que hacía la de antes', ['ordenarComparacion(\'total\')', 'Total al cliente', 'Fee (margen)', 'Costo de producción', 'Jornadas', 'Equipo técnico', 'Lo que cambia', 'elegirEjercicio(', 'borrarEjercicio('].every(t => modal.includes(t)));
ok('los avisos a la vista en el renglón', /class="ej-aviso mal"/.test(modal) && /No entran las puestas/.test(modal));
ordenarComparacion('total');
ok('tocar «Total» ordena por total', DB.ui.cmpOrden === 'total' && modal.indexOf(esc(F[0].v.nombre)) < modal.indexOf(esc(F[F.length - 1].v.nombre)));
ordenarComparacion('total');
ok('otra vez, de mayor a menor', DB.ui.cmpOrden === '-total');
DB.ui.cmpOrden = 'orden';
como('produccion');
compararEjercicios();
ok('el jefe la ve en costo: sin fee, sin elegir ni borrar', !/Fee \(margen\)/.test(modal) && !/Total al cliente/.test(modal) && !/elegirEjercicio\(/.test(modal) && !/borrarEjercicio\(/.test(modal) && /Costo de producción/.test(modal));
modal = null;
const nAntesJefe = py.versiones.length; generarSugeridos(py);
ok('el jefe no genera sugeridos', py.versiones.length === nAntesJefe);
DB.ui.tab = 'presu'; render();
ok('ni ve el botón', !/generarSugeridos\(\)/.test(app.innerHTML));
como('ejecutivo');
DB.ui.versionId = base.id; DB.ui.tab = 'presu'; DB.ui.vista = 'interna'; render();
ok('el PE ve «Ejercicios sugeridos» arriba del presupuesto', /generarSugeridos\(\)/.test(app.innerHTML) && /Ejercicios sugeridos/.test(app.innerHTML));
DB.ui.versionId = N('1 jornada con +4 h extra').id; render();
ok('parado en un ejercicio: sus avisos, por qué se sugirió y Borrar', /No entran las puestas/.test(app.innerHTML) && /sugerido: comprimir 2 en 1/.test(app.innerHTML) && /borrarEjercicio\(/.test(app.innerHTML));

console.log('\n--- 4. EDITAR Y BORRAR ---');
const m4 = N('Menos extras (8)');
m4.rubros.find(r => r.codigo === '09').lineas.find(l => /^Extra$/.test(l.concepto)).cantidad = 0;
ok('se edita como cualquier versión (y lo que cambia se recalcula)', cambiosVsBase(py, m4).items.includes(`Extras ${M0.extras} → ${medidasVersion(py, m4).extras}`));
const t2 = []; toast = (m, o) => t2.push({m, o});
const nv = py.versiones.length;
borrarEjercicio(m4.id);
ok('borrar un ejercicio', py.versiones.length === nv - 1 && !py.versiones.includes(m4));
t2.find(t => t.o && t.o.fn).o.fn();
ok('con Deshacer', py.versiones.includes(m4));
borrarEjercicio(base.id);
ok('la base no se borra', py.versiones.includes(base) && t2.some(t => /La base no se borra/.test(t.m)));
toast = toastOrig;
elegirEjercicio(m4.id); borrarEjercicio(m4.id);
ok('borrar la elegida la desmarca', py.elegidaId === null);
const deshacer = toasts.find(t => t.o && t.o.fn).o.fn;

console.log('\n--- 5. APROBAR UNA JORNADA CORTA ---');
const tA = []; toast = (m, o) => tA.push({m, o});
confirmarAprobacion({version: corta.id, tareas: false});
ok('aprobar el ejercicio de 10 h deja el rodaje en jornada de 10 h', py.configRodaje.horasJornada === 10 && etapaDe(py) === 'aprobado');
tA.find(t => t.o && t.o.fn).o.fn();
toast = toastOrig;
ok('deshacer la aprobación vuelve a 12 h', py.configRodaje.horasJornada === 12 && etapaDe(py) === 'cotizacion');

console.log('\n--- 6. DESHACER LOS SUGERIDOS ---');
const quedan = py.versiones.filter(v => nuevos.includes(v)).length, conSug = py.versiones.length;
deshacer();
ok('Deshacer saca todos los sugeridos de una', quedan > 0 && py.versiones.length === conSug - quedan && !py.versiones.some(v => nuevos.includes(v)), `${conSug} → ${py.versiones.length}`);
ok('y quedan la base y los dos de antes', nombres().join(' | ') === 'Base 2 jornadas | 1 jornada con horas extra | 2 cámaras', nombres().join(' | '));

console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
