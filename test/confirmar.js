/* Confirmar la citación con un toque, y los adicionales del presupuesto. */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
global.confirm = () => true;
global.location = {search: '', origin: 'https://clap.test', pathname: '/clap.html', hash: ''};
global.setTimeout = fn => { fn(); return 0; };

(async () => {
/* que termine el arranque de la app antes de conectarse de mentira */
for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r));
sbSesionViva = async () => true; revisarAlta = async () => {};
DB = dbVacia(); sembrarChico();
const pr = getPr(), py = getPy();
const jefe = pr.usuarios.find(u => u.rol === 'produccion');
py.desglose ||= nuevoDesglose(); if(!py.desglose.jornadas.length) nuevaJornadaPlan(py);
const j = normalizarJornada(py.desglose.jornadas[0]); j.parte ||= nuevoParte();
DB.ui.jornada = j.numero;

console.log('--- 1. EL LINK EN EL MENSAJE ---');
/* conectado como el jefe, con una base de mentira que contesta como la de verdad */
SB.url = 'https://base.test'; SB.anon = 'sb_publishable_x'; SB.access = 'tok'; SB.user = {id: 'auth-jefe', email: 'jefe@x.com'};
jefe.authUid = 'auth-jefe'; py.enServidor = true;
const llamadas = [];
let confirmados = [];
sbFetch = async (ruta, o = {}) => {
  llamadas.push(ruta);
  const b = o.body ? JSON.parse(o.body) : {};
  if (ruta.endsWith('/preparar_citaciones')) return Object.fromEntries(b.p_items.map(it => [it.clave, 'a'.repeat(31) + it.clave.length]));
  if (ruta.endsWith('/estado_citaciones')) return confirmados;
  return [];
};
const {gente, callsheet: C} = gentePorJornada(py, versionRodaje(py), j.numero);
await prepararLinksCitacion(py, j);
ok('arma un link por persona', gente.every(g => j.parte.links[g.clave]), Object.keys(j.parte.links || {}).length + ' de ' + gente.length);
const g0 = gente[0];
const txt = textoCitacionAl(pr, py, j, C, g0, cfgActual());
ok('el mensaje de WhatsApp lo lleva, con la conexión', /Confirmá tu citación con un toque: https:\/\/clap\.test\/clap\.html\?cit=a+\d+&sb=/.test(txt));
const pedidos = () => llamadas.filter(x => x.includes('preparar_citaciones')).length;
const n1 = pedidos();
await prepararLinksCitacion(py, j);
ok('si nada cambió, no vuelve a pedirlos', pedidos() === n1);
upCitacion(g0.clave, 'citacion', '05:45');
await prepararLinksCitacion(py, j);
ok('si cambia una hora, actualiza ese', pedidos() === n1 + 1);

console.log('\n--- 2. QUIÉN CONFIRMÓ ---');
confirmados = [{clave: g0.clave, hora: '05:45', confirmado_el: '2026-10-07T20:00:00Z', confirma: true, confirmada_hora: '05:45', respuesta: ''},
               {clave: gente[1].clave, hora: '07:00', confirmado_el: '2026-10-07T20:05:00Z', confirma: false, confirmada_hora: '07:00', respuesta: 'Tengo otro rodaje'}];
await actualizarConfirmaciones(py, j);
ok('confirmó', estadoConfirmacion(j, g0.clave).k === 'si');
ok('avisó que no puede, con su mensaje', estadoConfirmacion(j, gente[1].clave).k === 'nopuede' && estadoConfirmacion(j, gente[1].clave).respuesta === 'Tengo otro rodaje');
upCitacion(g0.clave, 'citacion', '06:15');
ok('si después cambia la hora, queda que confirmó la vieja', estadoConfirmacion(j, g0.clave).k === 'vieja');
DB.ui.usuarioId = jefe.id; DB.ui.tab = 'rodaje'; DB.ui.subRodaje = 'citaciones'; render();
ok('la pantalla lo muestra', /confirmaron/.test(app.innerHTML) && /1 no puede</.test(app.innerHTML) && !/1 no pueden/.test(app.innerHTML) && /Tengo otro rodaje/.test(app.innerHTML) && /refrescarConfirmaciones\(\)/.test(app.innerHTML));
DB.ui.tab = 'resumen'; render();
ok('el Resumen avisa que alguien no puede ir (en singular: es uno)', /avisó que no puede ir a la jornada/.test(app.innerHTML));

console.log('\n--- 3. LA PÁGINA DEL QUE ABRE EL LINK ---');
_cit = {token: 'b'.repeat(40), estado: 'cargando'};
sbFetch = async (ruta, o = {}) => {
  llamadas.push(ruta + (o.sinToken ? ' (sin cuenta)' : ''));
  if (ruta.endsWith('/ver_citacion')) return {nombre: 'Gaffer Gómez', rol: 'Gaffer', hora: '07:00', fecha: '2026-10-08', jornada: 1,
    texto: 'Citación J1 · 07:00', proyecto: 'Spot', productora: 'Neto', confirmado_el: null};
  if (ruta.endsWith('/confirmar_citacion')) return {ok: true};
  return null;
};
render();
ok('mientras busca, lo dice', /Buscando tu citación/.test(app.innerHTML));
await cargarCitacionPublica();
ok('muestra su citación, sin pedir cuenta', /Gaffer Gómez/.test(app.innerHTML) && /07:00/.test(app.innerHTML) && /Confirmo, voy a las 07:00/.test(app.innerHTML)
  && llamadas.some(x => x.includes('ver_citacion (sin cuenta)')));
ok('no muestra nada más de CLAP', !/class="tabs"/.test(app.innerHTML));
await confirmarCitacionPublica(true);
ok('confirma con un toque', _cit.estado === 'hecho' && /te esperamos a las/.test(app.innerHTML));
_cit = {token: 'c'.repeat(40), estado: 'listo', datos: {hora: '07:00', jornada: 1}, noPuede: true};
document.getElementById = () => ({value: '', focus(){}});
await confirmarCitacionPublica(false);
ok('para avisar que no puede, pide que diga qué pasa', _cit.falta === true && /Escribí qué pasa/.test(app.innerHTML));
document.getElementById = () => ({value: 'Llego 30 minutos tarde', focus(){}});
await confirmarCitacionPublica(false);
ok('y lo manda', _cit.estado === 'hecho' && /no podés: "Llego 30 minutos tarde"/.test(app.innerHTML));
_cit = null;

console.log('\n--- 4. ADICIONALES ---');
SB.access = null; SB.user = null;
const pe = pr.usuarios.find(u => u.rol === 'ejecutivo');
DB.ui.usuarioId = pe.id; DB.ui.vista = 'interna'; setTab('presu');
ok('el PE los ve en el presupuesto', /Adicionales/.test(app.innerHTML) && /editAdicional\(\)/.test(app.innerHTML));
adicionalesDe(py).push(nuevoAdicional({concepto: 'Día de edición extra', cantidad: 2, valor: 100000, estado: 'aprobado'}),
                       nuevoAdicional({concepto: 'Versión de 6″', cantidad: 1, valor: 50000}));
const v = getV(), R = calcular(v), T = totalesAdicionales(py, v);
ok('suman los aprobados, con IVA', T.apr === 200000 && Math.round(T.total) === Math.round(R.total + 200000 * (1 + n(v.capas.iva) / 100)));
ok('el presupuesto no cambia', calcular(v).total === R.total);
render();
ok('en la pantalla: el total con adicionales', /TOTAL CON ADICIONALES/.test(app.innerHTML) && app.innerHTML.includes(fmt(T.total, v.monedaBase)));
DB.ui.vista = 'cliente'; render();
ok('y en la cotización van los que no se descartaron', /Día de edición extra/.test(app.innerHTML) && /Versión de 6/.test(app.innerHTML));
DB.ui.vista = 'interna';
DB.ui.usuarioId = jefe.id; setTab('presu');
ok('el jefe de producción no los ve (son precio al cliente)', !/Adicionales/.test(app.innerHTML) && !/Día de edición extra/.test(app.innerHTML));
ok('viajan en la parte que sólo leen Administración y el PE', PARTES_PY.presupuesto_real.lee(py).adicionales.length === 2 && !canon(PARTES_PY.presupuesto.lee(py)).includes('Día de edición'));

console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
})();
