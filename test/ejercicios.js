/* Los ejercicios de cotización: maneras distintas de hacer el mismo trabajo
   (menos jornadas con horas extra, otra cámara, más o menos gente, extras),
   cada una una versión más del presupuesto contra la BASE, con lo que
   cambia dicho en palabras, una comparación lado a lado y la elegida.
   Con el ejemplo de la app (Cumbre, en cotización).
   Uso: node test/run.js test/ejercicios.js                                  */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
global.confirm = () => true;

DB = dbVacia(); sembrar();
const pr = getPr(), py = pr.proyectos[1];
const U = r => pr.usuarios.find(u => u.rol === r);
const como = r => { DB.ui.usuarioId = U(r).id; modal = null; };
DB.ui.proyectoId = py.id;
como('ejecutivo');
const base = baseDe(py), cfg = py.configRodaje;
const M0 = medidasVersion(py, base);

console.log('--- 1. EL EJEMPLO ---');
ok('la base y dos ejercicios', familiaCotiz(py).map(v => v.nombre).join(' | ') === 'Base 2 jornadas | 1 jornada con horas extra | 2 cámaras', familiaCotiz(py).map(v => v.nombre).join(' | '));
ok('los ejercicios son versiones del presupuesto (no otra cosa)', familiaCotiz(py).every(v => py.versiones.includes(v)) && familiaCotiz(py).slice(1).every(v => v.ejercicio && v.ejercicio.deId === base.id));
ok('la base: 2 jornadas, 1 cámara', M0.jornadas === 2 && M0.camaras === 1, JSON.stringify(M0));

console.log('\n--- 2. MENOS JORNADAS, CON LAS HORAS EXTRA DEL CONVENIO ---');
let {v: e, rep} = crearEjercicio(py, base, {jornadas: 1});
let M = medidasVersion(py, e);
ok('de 2 a 1 jornada', M.jornadas === 1);
ok('las horas extra se calculan solas: la mitad de lo que se pierde (12 h → 6 h)', rep.he === 6 && sugerirHE(2, 1, cfg) === 6 && sugerirHE(3, 2, cfg) === 3);
const df = e.rubros.find(r => r.codigo === '04').lineas.find(l => l.concepto === 'Director de Fotografía');
const heDF = e.rubros.find(r => r.codigo === '04').lineas.find(l => l.hex && l.concepto === 'Horas extra — Director de Fotografía');
ok('el DF pasa a 1 día y tiene sus horas extra', df.dias === 1 && heDF && heDF.cantidad === df.cantidad && heDF.dias === 6 && heDF.unidad === 'hora');
/* la cuenta de la app: hora del convenio (con las 4 extras ya incluidas en la jornada de 12) y la escala de recargos */
const bh = baseHoraDe(cfg, df.valorUnit, df), rp = repartirHEDesde(6, escalaDe(cfg), bh.incluidas);
const esperado = rp.reduce((s, t) => s + t.horas * bh.valorHora * (1 + t.recargo / 100), 0);
ok('el valor de la hora extra sale de las reglas del convenio que ya usa el rodaje', Math.abs(heDF.valorUnit * 6 - esperado) < 6, `${heDF.valorUnit} × 6 vs ${Math.round(esperado)}`);
ok('y lleva cargas sociales (es sueldo de convenio)', contratoDe(heDF, e.rubros.find(r => r.codigo === '04')) === 'sica');
ok('no aparece como una persona más en el callsheet', NO_ES_PERSONA.test(heDF.concepto));
ok('la preproducción no se comprime', e.rubros.flatMap(r => r.lineas).filter(l => l.etapa === 'prepro').every(l => { const o = base.rubros.flatMap(r => r.lineas).find(x => raizLinea(x) === raizLinea(l)); return o && o.dias === l.dias; }));
ok('el catering y la locación, a 1 día', e.rubros.find(r => r.codigo === '13').lineas.filter(l => l.unidad === 'persona').every(l => l.dias === 1) && e.rubros.find(r => r.codigo === '10').lineas.find(l => l.concepto === 'Fee de locación').dias === 1);
ok('la base no se tocó', medidasVersion(py, base).jornadas === 2 && !base.rubros.some(r => r.lineas.some(l => l.hex)));
({v: e} = crearEjercicio(py, base, {jornadas: 1, he: 4}));
ok('las horas se pueden poner a mano', medidasVersion(py, e).he === 4);
({v: e} = crearEjercicio(py, base, {jornadas: 3}));
ok('más jornadas: sin horas extra', medidasVersion(py, e).jornadas === 3 && medidasVersion(py, e).he === 0);
const conHE = familiaCotiz(py)[1];
({v: e} = crearEjercicio(py, conHE, {jornadas: 2}));
ok('desde un ejercicio con extras, volver a 2 jornadas las saca', medidasVersion(py, e).he === 0 && medidasVersion(py, e).jornadas === 2);

console.log('\n--- 3. CÁMARAS, EQUIPO, ELENCO Y EXTRAS ---');
({v: e} = crearEjercicio(py, base, {camaras: 2}));
M = medidasVersion(py, e);
ok('2 cámaras: otro paquete, un operador y otro foquista', M.camaras === 2 && (M.crew['04'] - M0.crew['04']) === 2 && e.rubros.find(r => r.codigo === '04').lineas.some(l => l.concepto === 'Operador de Cámara'));
({v: e} = crearEjercicio(py, e, {camaras: 1}));
ok('y de vuelta a 1', medidasVersion(py, e).camaras === 1 && medidasVersion(py, e).crew['04'] === M0.crew['04']);
({v: e} = crearEjercicio(py, base, {areas: [{rubro: '05', delta: 2}, {rubro: '06', delta: -1}]}));
M = medidasVersion(py, e);
ok('eléctrica +2 y arte −1', M.crew['05'] === M0.crew['05'] + 2 && M.crew['06'] === M0.crew['06'] - 1, `${M0.crew['05']}→${M.crew['05']} · ${M0.crew['06']}→${M.crew['06']}`);
ok('la cabeza del área no se saca', e.rubros.find(r => r.codigo === '06').lineas.some(l => l.concepto === 'Director de Arte' && n(l.cantidad) >= 1));
({v: e} = crearEjercicio(py, base, {extras: 6, elenco: M0.elenco + 1}));
M = medidasVersion(py, e);
ok('extras y elenco a mano', M.extras === 6 && M.elenco === M0.elenco + 1, `extras ${M0.extras}→${M.extras} · elenco ${M0.elenco}→${M.elenco}`);
({v: e} = crearEjercicio(py, base, {areas: [{rubro: '05', delta: -20}]}));
ok('achicar de más deja al jefe del área', medidasVersion(py, e).crew['05'] >= 1);

console.log('\n--- 4. LO QUE CAMBIA, EN PALABRAS ---');
({v: e} = crearEjercicio(py, base, {jornadas: 1, extras: 6, camaras: 2, areas: [{rubro: '05', delta: 2}]}));
const C = cambiosVsBase(py, e);
ok('jornadas con las horas extra', C.items.includes('Jornadas 2 → 1 (+6 h extra c/u)'), C.texto);
ok('extras, cámaras y personas por área', C.items.includes(`Extras ${M0.extras} → 6`) && C.items.includes('Cámaras 1 → 2') && C.items.includes('Eléctrica y grip +2 personas'), C.texto);
const TB = calcular(base).total, TE = calcular(e).total;
ok('y el total contra la base', C.texto.endsWith(`Total ${fmt(TE, 'ARS')} (${TE < TB ? '−' : '+'}${Math.abs(Math.round((TE - TB) / TB * 1000) / 10).toLocaleString('es-AR')} % vs base)`), C.texto);
ok('el nombre sale solo de los cambios', /^1 jornada con horas extra · 2 cámaras · 6 extras/.test(e.nombre), e.nombre);
ok('la base dice que es la base', cambiosVsBase(py, base).items.length === 0);

console.log('\n--- 5. COMPARAR Y ELEGIR ---');
const F = filasComparacion(py);
ok('una columna por cada uno', F.length === 3 && F[0].esBase);
ok('con el total, el costo, el fee y las jornadas de cada uno', F.every(x => Math.abs(x.total - calcular(x.v).total) < 1 && Math.abs(x.costo - (calcular(x.v).subtotal + calcular(x.v).contingencia)) < 1) && F[1].M.jornadas === 1 && F[1].M.he === 6);
ok('comprimir sale más barato y dos cámaras más caro', F[1].total < F[0].total && F[2].total > F[0].total);
compararEjercicios();
ok('la tabla: total al cliente, fee, costo, jornadas, equipo, lo que cambia y Elegir', ['Total al cliente', 'Fee (margen)', 'Costo de producción', 'Jornadas', 'Equipo técnico', 'Lo que cambia', 'elegirEjercicio('].every(t => modal.includes(t)));
const e2 = familiaCotiz(py)[2];
elegirEjercicio(e2.id);
ok('elegir: es la que se presenta y se abre', py.elegidaId === e2.id && getV() === e2);
DB.ui.tab = 'presu'; DB.ui.vista = 'cliente'; render();
ok('la cotización para el cliente sale de la elegida', app.innerHTML.includes(fmt(calcular(e2).total, 'ARS')));
DB.ui.vista = 'interna'; render();
ok('arriba del presupuesto: los ejercicios y qué cambia', /Ejercicios de cotización/.test(app.innerHTML) && /Para llegar a este precio/.test(app.innerHTML) && /Cámaras 1 → 2/.test(app.innerHTML) && /la que se presenta/.test(app.innerHTML));

console.log('\n--- 6. QUIÉN LOS VE ---');
como('produccion');
DB.ui.versionId = null;
ok('el jefe (invitado) los ve', familiaCotiz(py).length === 3);
const Fj = filasComparacion(py);
ok('en costo: lo visible es el costo de producción', Fj.every(x => Math.abs(x.visible - x.costo) < 1));
compararEjercicios();
ok('sin el total al cliente ni el fee', !/Total al cliente/.test(modal) && !/Fee \(margen\)/.test(modal) && !modal.includes(fmt(Fj[0].total, 'ARS')) && modal.includes(fmt(Fj[0].costo, 'ARS')));
ok('ni el botón de elegir', !/elegirEjercicio\(/.test(modal));
DB.ui.tab = 'presu'; render();
ok('en la barra de los ejercicios, costos', !app.innerHTML.includes(fmt(calcular(baseDe(py)).total, 'ARS')) && /costo de producción/.test(app.innerHTML));
ok('no crea ejercicios', !/nuevoEjercicio\(\)/.test(app.innerHTML));
modal = null; const antes = py.versiones.length; nuevoEjercicio();
ok('(ni llamándolo directo)', !modal && py.versiones.length === antes);
ok('el resumen del ejercicio también en costo', /Costo \$/.test(cambiosVsBase(py, familiaCotiz(py)[1]).totalTxt));
como('asistprod');
ok('los asistentes no ven presupuestos', familiaCotiz(py).length === 0);

console.log('\n--- 7. CREAR DESDE LA PANTALLA, CON DESHACER ---');
como('ejecutivo');
DB.ui.versionId = baseDe(py).id;
nuevoEjercicio();
ok('la ventana: parte de, jornadas, horas extra, cámaras, elenco, extras y áreas', ['name="origen"', 'name="jornadas"', 'name="he"', 'name="camaras"', 'name="elenco"', 'name="extras"', 'name="area1"', 'name="delta1"'].every(t => modal.includes(t)));
const datosOrig = datos; datos = () => ({nombre: '', origen: baseDe(py).id, jornadas: '1', he: '', camaras: '', elenco: '', extras: '', area1: '', delta1: '', area2: '', delta2: ''});
const toasts = []; const toastOrig = toast; toast = (m, o) => toasts.push({m, o});
const n0 = py.versiones.length;
confirmarEjercicio();
datos = datosOrig; toast = toastOrig;
const creado = py.versiones[py.versiones.length - 1];
ok('se crea y queda abierto', py.versiones.length === n0 + 1 && getV() === creado && creado.ejercicio && creado.nombre === '1 jornada con horas extra');
ok('el aviso dice el precio', toasts.some(t => /Total \$/.test(t.m)));
toasts.find(t => t.o && t.o.fn).o.fn();
ok('Deshacer lo borra', py.versiones.length === n0 && !py.versiones.includes(creado));

console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
