/* La situación cero: un proyecto EN COTIZACIÓN muestra sólo el resumen, el
   desglose y el presupuesto; «Proyecto aprobado» (sólo el PE o
   Administración) congela la cotización, abre todo lo demás y le deja al
   jefe de producción los pasos para arrancar. «No salió» lo guarda y se
   puede reabrir. Con el ejemplo de la app: Brisa (en curso) y Cumbre (en
   cotización).
   Uso: node test/run.js test/cotizacion.js                                  */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
global.confirm = () => true;
global.prompt = () => '';

DB = dbVacia(); sembrar();
const pr = getPr(), brisa = pr.proyectos[0], cumbre = pr.proyectos[1];
const U = r => pr.usuarios.find(u => u.rol === r);
const como = r => { DB.ui.usuarioId = U(r).id; modal = null; };
const pantalla = tab => { DB.ui.tab = tab; render(); return app.innerHTML; };
const solapas = h => [...h.matchAll(/class="tab[^"]*" onclick="setTab\('([^']+)'\)"/g)].map(m => m[1]);
const PROYECTO = ['resumen', 'presu', 'desglose', 'plan', 'luces', 'personal:alta', 'callsheet', 'rodaje', 'gastos', 'personal:liquidacion'];

console.log('--- 1. LAS ETAPAS ---');
ok('el ejemplo: Brisa en curso, Cumbre cotizando', etapaDe(brisa) === 'aprobado' && etapaDe(cumbre) === 'cotizacion');
ok('lo que se arma por código (y lo viejo) es aprobado', etapaDe(nuevoProyecto()) === 'aprobado' && etapaDe({}) === 'aprobado');
const viejo = {proyectos: [{nombre: 'Viejo', versiones: [nuevaVersion()]}]};
DB.productoras.push(viejo); migrar(); DB.productoras.pop();
ok('migrar: un proyecto de antes queda aprobado', viejo.proyectos[0].etapa === 'aprobado');

console.log('\n--- 2. COTIZANDO SE VE SÓLO EL DESGLOSE Y EL PRESUPUESTO ---');
DB.ui.proyectoId = cumbre.id;
for(const r of ['ejecutivo', 'admin', 'produccion']){
  como(r); DB.ui.versionId = null;
  const ts = solapas(pantalla('resumen')).filter(k => PROYECTO.includes(k));
  ok(`${ROL(r).l}: Resumen, Presupuesto y Desglose`, ts.join(',') === 'resumen,presu,desglose', ts.join(','));
}
como('ejecutivo');
let h = pantalla('resumen');
ok('el resumen de la cotización: la etapa, el total al cliente y los pasos', /En cotización/.test(h) && /total al cliente/.test(h) && /Desglosar lo que mandó la agencia/.test(h) && /Probar ejercicios/.test(h) && /Mandar la cotización/.test(h));
ok('el PE ve «Proyecto aprobado» y «No salió»', /aprobarProyecto\(\)/.test(h) && /noSalio\(\)/.test(h));
ok('en el encabezado: la etapa al lado del proyecto, y el selector agrupado', /class="etapa-chip et-cotizacion"/.test(h) && /<optgroup label="Cotizando \(1\)">/.test(h) && /<optgroup label="En curso \(1\)">/.test(h));
ok('la cartera: cotizando y en curso, con cuántos', /1 cotizando · 1 en curso/.test(h) && /Cotizando · 1/.test(h) && /En curso · 1/.test(h));
como('produccion');
h = pantalla('resumen');
ok('el jefe ve el costo (no el total al cliente) y no aprueba', /costo de producción/.test(h) && !/total al cliente/.test(h) && !/aprobarProyecto\(\)/.test(h) && /Lo aprueban el Productor Ejecutivo o Administración/.test(h));
const RB = calcular(baseDe(cumbre));
ok('ni un número con fee en su resumen', !h.includes(fmt(RB.total, 'ARS')) && h.includes(fmt(RB.subtotal + RB.contingencia, 'ARS')));

console.log('\n--- 3. LOS LINKS A LO QUE TODAVÍA NO EXISTE VUELVEN AL RESUMEN ---');
como('ejecutivo');
for(const t of ['plan', 'luces', 'callsheet', 'rodaje', 'gastos', 'personal']){
  aplicarHash('#/' + (t === 'personal' ? 'altas' : t)); render();
  ok(`#/${t} → resumen`, DB.ui.tab === 'resumen', DB.ui.tab);
}
aplicarHash('#/plan'); render();
ok('con un aviso de por qué', /El plan de rodaje aparece cuando el proyecto se aprueba/.test(app.innerHTML));
aplicarHash('#/presu'); render(); ok('#/presu sí', DB.ui.tab === 'presu');
aplicarHash('#/desglose'); render(); ok('#/desglose sí', DB.ui.tab === 'desglose');
ok('el desglose arranca en «Para cotizar»', /Escenas y puestas/.test(app.innerHTML) && /Cámara especial/.test(app.innerHTML));
ok('sin el botón al plan de rodaje (todavía no hay)', !/setTab\('plan'\)" title="Repartir/.test(app.innerHTML));
ok('la barra de pasos no manda al plan', !/irAPaso\('plan'\)/.test(app.innerHTML));

console.log('\n--- 4. LOS DEMÁS ROLES, SI ALGUIEN LOS INVITÓ ANTES DE TIEMPO ---');
cumbre.invitados.push(U('asistdir').id, U('asistprod').id, U('equipo').id);
for(const r of ['asistdir', 'asistprod', 'arte', 'equipo']){
  como(r);
  const ts = solapas(pantalla('resumen')).filter(k => PROYECTO.includes(k));
  ok(`${ROL(r).l}: sólo su panel, con «todavía se está cotizando»`, ts.join(',') === 'resumen' && /Este proyecto todavía se está cotizando/.test(app.innerHTML), ts.join(','));
}
como('asistdir');
ok('cotizando no escriben ninguna parte (como en la base)', !puedeParte('plan', true, U('asistdir'), cumbre) && !puedeParte('gastos', true, U('asistprod'), cumbre) && puedeParte('presupuesto', true, U('produccion'), cumbre));
ok('en Brisa (en curso) sí', puedeParte('plan', true, U('asistdir'), brisa) && puedeParte('gastos', true, U('asistprod'), brisa));
cumbre.invitados = [U('produccion').id];

console.log('\n--- 5. EN BRISA (APROBADO) TODO SIGUE IGUAL ---');
DB.ui.proyectoId = brisa.id;
como('ejecutivo');
ok('el PE ve todas las solapas', ['presu', 'desglose', 'plan', 'luces', 'callsheet', 'rodaje', 'gastos'].every(k => solapas(pantalla('resumen')).includes(k)));
como('asistprod');
ok('el asistente de producción, las suyas', ['luces', 'callsheet', 'rodaje', 'gastos'].every(k => solapas(pantalla('resumen')).includes(k)));

console.log('\n--- 6. APROBAR: SÓLO EL PE O ADMINISTRACIÓN ---');
DB.ui.proyectoId = cumbre.id;
como('produccion');
const nv = cumbre.versiones.length;
aprobarProyecto();
ok('el jefe no puede (ni abre la ventana)', !modal && etapaDe(cumbre) === 'cotizacion');
confirmarAprobacion({version: baseDe(cumbre).id});
ok('ni llamándolo directo', etapaDe(cumbre) === 'cotizacion' && cumbre.versiones.length === nv);
como('ejecutivo');
const e1 = cumbre.versiones.find(v => v.nombre === '1 jornada con horas extra');
elegirEjercicio(e1.id);
aprobarProyecto();
ok('la ventana propone la elegida', new RegExp(`<option value="${e1.id}" selected`).test(modal));
const toasts = []; const toastOrig = toast; toast = (m, o) => toasts.push({m, o});
const snap = confirmarAprobacion({version: e1.id, tareas: true});
toast = toastOrig;
ok('pasa a aprobado', etapaDe(cumbre) === 'aprobado');
ok('congela la cotización aprobada: una versión del Cliente, con fecha', snap && snap.congelada && snap.nivel === 'cliente' && snap.estado === 'aprobado' && new RegExp('aprobada ' + fechaAR(hoy())).test(snap.nombre), snap && snap.nombre);
ok('la congelada da lo mismo que la elegida', Math.abs(calcular(snap).total - calcular(e1).total) < 1);
ok('la elegida pasa a ser la de rodaje del jefe', versionRodaje(cumbre) === e1 && e1.estado === 'aprobado');
ok('queda anotado quién y cuándo (sin montos: lo lee el jefe)', cumbre.aprobado.quien === U('ejecutivo').nombre && cumbre.aprobado.fecha === hoy() && !('total' in cumbre.aprobado));
const tJefe = tareasDe(cumbre).filter(t => t.arranque);
ok('le deja al jefe las tareas para arrancar', tJefe.length === 4 && tJefe.every(t => t.asignadoA === U('produccion').id), tJefe.map(t => t.titulo).join(' / '));
ok('con Deshacer', toasts.some(t => t.o && t.o.accion === 'Deshacer'));
ok('ahora el PE ve todo', ['plan', 'luces', 'callsheet', 'rodaje', 'gastos'].every(k => solapas(pantalla('resumen')).includes(k)));

console.log('\n--- 7. EL JEFE RECIBE EL PROYECTO ---');
como('produccion');
h = pantalla('resumen');
ok('su resumen arranca con el siguiente paso', /Siguiente paso: arrancar la producción/.test(h) && h.indexOf('Siguiente paso') < h.indexOf('Esperan algo'));
ok('invitar al equipo, fechas, plan y desglose al presupuesto de rodaje', ['Invitar al equipo del rodaje', 'Poner las fechas de rodaje', 'Armar el plan de rodaje', 'Pasar el desglose al presupuesto de rodaje'].every(t => h.includes(t)));
ok('ve el plan y el rodaje', ['plan', 'luces', 'callsheet', 'rodaje', 'gastos'].every(k => solapas(h).includes(k)));
ok('la congelada no es para él (lleva el fee)', !versionesQueVeo(cumbre, U('produccion')).includes(snap));
/* pasar el desglose cuenta como paso hecho */
DB.ui.versionId = e1.id;
const P = propuestaPresupuesto();
confirmarAPresupuesto(P.lineas.map((l, i) => ({i})));
ok('aplicar el desglose marca el paso', pasosArranque(cumbre).find(p => p.k === 'desglose').hecho);

console.log('\n--- 8. DESHACER LA APROBACIÓN ---');
como('ejecutivo');
const deshacer = toasts.find(t => t.o && t.o.fn).o.fn;
deshacer();
ok('vuelve a cotización, sin la congelada ni las tareas', etapaDe(cumbre) === 'cotizacion' && !cumbre.versiones.includes(snap) && !tareasDe(cumbre).some(t => t.arranque) && !cumbre.aprobado);

console.log('\n--- 9. NO SALIÓ, Y REABRIR ---');
como('produccion');
confirmarNoSalio({motivo: 'x'});
ok('el jefe no lo marca', etapaDe(cumbre) === 'cotizacion');
como('admin');
confirmarNoSalio({motivo: 'Lo ganó otra productora'});
ok('Administración sí: queda «No salió» con el motivo', etapaDe(cumbre) === 'nosalio' && cumbre.noSalio.motivo === 'Lo ganó otra productora');
h = pantalla('resumen');
ok('guardado, con el motivo y el botón para reabrir', /No salió/.test(h) && /Lo ganó otra productora/.test(h) && /reabrirCotizacion\(\)/.test(h));
ok('se ve como una cotización (sin plan ni rodaje)', solapas(h).filter(k => PROYECTO.includes(k)).join(',') === 'resumen,presu,desglose');
ok('en la cartera, aparte', /No salió · 1/.test(h));
reabrirCotizacion();
ok('reabierto: de nuevo en cotización', etapaDe(cumbre) === 'cotizacion' && cumbre.etapaHist.length >= 2 && cumbre.etapaHist[cumbre.etapaHist.length - 1].a === 'cotizacion', cumbre.etapaHist.map(x => x.a).join(' → '));

console.log('\n--- 10. LO APROBADO VUELVE A COTIZACIÓN SÓLO SI NO ARRANCÓ NADA ---');
DB.ui.proyectoId = brisa.id;
reabrirCotizacion();
ok('Brisa ya rodó: no vuelve', etapaDe(brisa) === 'aprobado');

console.log('\n--- 11. UN PROYECTO NUEVO ARRANCA COTIZANDO, CON EL DESGLOSADOR AHÍ ---');
como('ejecutivo');
editProyecto();
ok('la ventana dice que arranca en cotización y deja pegar el brief', /arranca <b>en cotización<\/b>/.test(modal) && /name="brief"/.test(modal));
const fake = {nombre: 'Snack de prueba', tipo: 'publicidad', cliente: 'Cliente inventado', agencia: '', producto: '', jornadas: '1', medios: '', territorio: '', plazo: '',
  plantilla: 'pub-chica', brief: EJEMPLOS_PUB.find(x => x.k === 'frases').texto};
const datosOrig = datos; datos = () => fake;
saveProyecto('');
datos = datosOrig;
const nuevo = getPy();
ok('en cotización', nuevo.nombre === 'Snack de prueba' && etapaDe(nuevo) === 'cotizacion');
ok('con la plantilla (tipo y escala) como siempre', baseDe(nuevo).rubros.some(r => r.lineas.length) && nuevo.plantilla === 'pub-chica');
ok('el primer presupuesto es la base', baseDe(nuevo) === nuevo.versiones[0] && nuevo.versiones[0].nombre === 'Base');
ok('el brief ya desglosado y en «Para cotizar»', nuevo.desglose.escenas.length === 3 && DB.ui.tab === 'desglose' && DB.ui.subDesglose === 'cotizar');
ok('y la etapa viaja en la ficha del proyecto', PY_CAMPOS.some(([s]) => s === 'etapa'));

console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
