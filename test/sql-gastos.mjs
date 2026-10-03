/* La base de verdad (todo backend/*.sql, en un Postgres de verdad: PGlite)
   con la app de verdad (clap.html) arriba. Prueba lo de las rendiciones que
   sólo la base puede hacer cumplir:
     · a la compu de un asistente le llega SÓLO lo suyo de los gastos (el
       asistente de producción, además, lo de arte, que revisa);
     · un asistente guarda lo suyo y la base lo junta con lo de los demás;
     · nadie escribe la tabla directo (salteando los controles);
     · lo de arte pasa por producción: Administración no lo recibe salteado;
       lo eleva el jefe (sin jefe en el proyecto, el PE).

   Uso:   node test/sql-gastos.mjs
   Necesita @electric-sql/pglite (no es parte de CLAP: sólo para probar):
     npm i --no-save @electric-sql/pglite      (en esta carpeta), o
     PGLITE=/ruta/a/node_modules/@electric-sql/pglite node test/sql-gastos.mjs
   Sin PGlite, avisa y no falla.                                             */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const B = path.join(AQUI, '..', 'backend');
let PGlite, ext = {};
try {
  if (process.env.PGLITE) {
    ({PGlite} = await import(pathToFileURL(path.join(process.env.PGLITE, 'dist', 'index.js')).href));
    try { ext.pgcrypto = (await import(pathToFileURL(path.join(process.env.PGLITE, 'dist', 'contrib', 'pgcrypto.js')).href)).pgcrypto; } catch (e) {}
  } else {
    ({PGlite} = await import('@electric-sql/pglite'));
    try { ext.pgcrypto = (await import('@electric-sql/pglite/contrib/pgcrypto')).pgcrypto; } catch (e) {}
  }
} catch (e) {
  console.log('SALTEADA: falta @electric-sql/pglite (npm i --no-save @electric-sql/pglite, o PGLITE=…).');
  process.exit(0);
}

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
const db = new PGlite({extensions: ext});
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  create schema auth;
  create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create function productora_pide_aprobacion(p uuid) returns boolean language plpgsql as $$ begin return false; end $$;
`);
const ORDEN = ['esquema.sql', 'alta-propia.sql', 'sincronizacion.sql', 'arranque.sql', 'permisos.sql', 'mis-datos.sql', 'destrabar.sql',
  'modo-prueba.sql', 'catalogo-cbu.sql', 'catalogo-notas.sql', 'privado.sql', 'subir-proyectos.sql', 'proyecto-completo.sql'];
for (const f of ORDEN) {
  let s = fs.readFileSync(path.join(B, f), 'utf8'); if (!ext.pgcrypto) s = s.replace(/create extension[^;]*;/gi, '');
  await db.exec(s);
}
/* se puede volver a correr (no rompe ni borra) */
await db.exec(fs.readFileSync(path.join(B, 'proyecto-completo.sql'), 'utf8'));
ok('proyecto-completo.sql se corre dos veces sin errores', true);

/* la gente: uno por rol (todo inventado) */
const U = {}, UID = {};
const org = (await db.query(`insert into organizacion(nombre) values('Estudio de prueba') returning id`)).rows[0].id;
const prodId = (await db.query(`insert into productora(org_id,nombre) values($1,'Productora Demo') returning id`, [org])).rows[0].id;
const GENTE = [['jefe', 'produccion', 'Lucía Ferrer'], ['diego', 'asistprod', 'Diego Sosa'], ['carla', 'arte', 'Carla Méndez'],
  ['sofia', 'equipo', 'Sofía Roldán'], ['marta', 'admin', 'Marta Giles'], ['tomas', 'ejecutivo', 'Tomás Vidal'], ['paula', 'asistdir', 'Paula Ríos']];
for (const [k, rol, nom] of GENTE) {
  U[k] = (await db.query(`insert into auth.users(id,email,email_confirmed_at) values (gen_random_uuid(),$1,now()) returning id`, [k + '@ejemplo.com'])).rows[0].id;
  UID[k] = (await db.query(`insert into usuario(auth_uid,productora_id,nombre,rol,email,activo,pendiente) values ($1,$2,$3,$4,$5,true,false) returning id`,
    [U[k], prodId, nom, rol, k + '@ejemplo.com'])).rows[0].id;
}
let actual = 'jefe';
const como = async (k, fn) => { await db.exec('set role authenticated'); await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [U[k]]); try { return await fn(); } finally { await db.exec('reset role'); } };
const q1 = async (k, sql, ps) => como(k, async () => (await db.query(sql, ps)).rows);
const guardarComo = async (k, pyId, datos, base) => {
  try { return await como(k, async () => (await db.query(`select guardar_parte($1,'gastos',$2,$3) r`, [pyId, JSON.stringify(datos), base])).rows[0].r); }
  catch (e) { return {error: e.message}; }
};
const leerComo = async (k, pyId) => como(k, async () => (await db.query(`select leer_gastos($1, true) r`, [pyId])).rows[0].r);
const enBase = async pyId => (await db.query(`select datos, version from proyecto_parte where proyecto_id=$1 and parte='gastos'`, [pyId])).rows[0];

/* ---------------------------------------------------------------------------
   La app, en un contexto con lo mínimo del navegador
   --------------------------------------------------------------------------- */
const store = {};
const fake = {innerHTML: '', insertAdjacentHTML(){}, scrollTop: 0, className: '', textContent: '', appendChild(){}, remove(){}, click(){}, addEventListener(){}, style: {}, href: '', download: ''};
const ctx = vm.createContext({
  console: {log(){}, warn(){}, error(){}}, setTimeout: () => 0, clearTimeout(){}, setInterval: () => 0, JSON, Math, Date, Promise, Object, Array, String, Number, Set, Map, RegExp, Error,
  encodeURIComponent, decodeURIComponent, parseFloat, parseInt, isFinite, Intl, URL, TextEncoder, TextDecoder, Uint8Array, Uint32Array, DataView, ArrayBuffer, atob, btoa,
  localStorage: {getItem: k => store[k] ?? null, setItem: (k, v) => store[k] = String(v), removeItem: k => { delete store[k]; }, key: i => Object.keys(store)[i] ?? null, get length(){ return Object.keys(store).length; }},
  document: {querySelector: () => fake, querySelectorAll: () => [], createElement: () => ({...fake, style: {}}), body: {appendChild(){}}, getElementById: () => fake},
  window: {print(){}, addEventListener(){}}, alert(){}, confirm: () => true, prompt: () => null,
});
const src = fs.readFileSync(path.join(AQUI, '..', 'clap.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
vm.runInContext(src, ctx);
/* el ejemplo CHICO de las pruebas (números fijos), no el de la app */
vm.runInContext(fs.readFileSync(path.join(AQUI, 'ejemplo-chico.js'), 'utf8'), ctx);
await new Promise(r => setTimeout(r, 200));
const run = js => vm.runInContext(js, ctx);
ctx.sbSesionViva = async () => true;
let pedidos = [];
const cols = c => c.split(',').map(x => x.trim()).filter(x => /^[a-z_]+$/.test(x)).join(',');
ctx.sbFetch = async (ruta, opts = {}) => {
  pedidos.push(ruta);
  return como(actual, async () => {
    if (ruta.startsWith('/rest/v1/proyecto_parte?')) {
      const u = new URLSearchParams(ruta.split('?')[1]);
      const py = u.get('proyecto_id').replace('eq.', ''), sel = cols(u.get('select'));
      const partes = u.get('parte') ? u.get('parte').replace(/^in\.\(|\)$/g, '').split(',') : null;
      return (await db.query(`select ${sel} from proyecto_parte where proyecto_id=$1 ${partes ? 'and parte = any($2)' : ''}`, partes ? [py, partes] : [py])).rows;
    }
    const b = opts.body ? JSON.parse(opts.body) : {};
    if (ruta === '/rest/v1/rpc/guardar_parte')
      return (await db.query(`select guardar_parte($1,$2,$3,$4) r`, [b.p_proyecto, b.p_parte, JSON.stringify(b.p_datos), b.p_base])).rows[0].r;
    if (ruta === '/rest/v1/rpc/leer_gastos')
      return (await db.query(`select leer_gastos($1,$2) r`, [b.p_proyecto, b.p_con_datos])).rows[0].r;
    return [];
  });
};
const entrar = k => { actual = k; run(`SB.url='https://x.test'; SB.anon='a'; SB.access='x'; SB.user={id:'${U[k]}', email:'${k}@ejemplo.com'};`); };
/* el proyecto de ejemplo con los ids de la base */
const MAPA = {produccion: 'jefe', asistprod: 'diego', arte: 'carla', equipo: 'sofia', admin: 'marta', ejecutivo: 'tomas', asistdir: 'paula'};
function armarCompu(k, pyId){
  for (const x in store) delete store[x];
  run(`DB = dbVacia(); sembrarChico(); SYNC = {}; _leerGastos = null;`);
  const pr = run('getPr()'); pr.id = prodId;
  pr.usuarios.forEach(u => { const kk = MAPA[u.rol]; run(`cambiarIdUsuario(getPr(), ${JSON.stringify(u.id)}, ${JSON.stringify(UID[kk])})`);
    Object.assign(u, {authUid: U[kk], email: kk + '@ejemplo.com'}); });
  const py = run('getPy()'); if (pyId) py.id = pyId; py.enServidor = true;
  run(`DB.ui.productoraId = '${prodId}'; DB.ui.proyectoId = '${py.id}';`);
  entrar(k);
  return {pr, py};
}

console.log('--- 1. EL JEFE SUBE EL PROYECTO, CON LOS GASTOS DE TODOS ---');
let {py} = armarCompu('jefe');
const PY = py.id;
await db.query(`insert into proyecto(id,productora_id,nombre) values($1,$2,$3)`, [PY, prodId, py.nombre]);
for (const k of ['jefe', 'diego', 'carla', 'sofia', 'paula']) await db.query(`insert into proyecto_persona(proyecto_id,usuario_id) values($1,$2)`, [PY, UID[k]]);
/* un fondo de arte para Carla, con un ticket, y un comprobante suelto suyo */
run(`(() => { const py = getPy();
  const cj = nuevaCaja({nombre: 'Compras de arte', responsable: '${UID.carla}', adelantos: [{id: 'ad-carla', fecha: hoy(), importe: 80000, circuito: 'efectivo', entregadoPor: '${UID.jefe}'}]});
  cj.id = 'cj-carla'; py.cajas.push(cj);
  const c1 = nuevoComprobante({rubro: '06', proveedor: 'Pinturería de prueba', importe: 12000, tipo: 'ticket', cajaId: 'cj-carla', cargadoPor: '${UID.carla}', estado: 'cargado'}); c1.id = 'cp-carla-1';
  const c2 = nuevoComprobante({rubro: '06', proveedor: 'Telas de prueba', importe: 9000, tipo: 'facBC', cargadoPor: '${UID.carla}', estado: 'cargado'}); c2.id = 'cp-carla-suelto';
  py.comprobantes.push(c1, c2); })()`);
const CATERING = run(`getPy().comprobantes.find(c => c.proveedor === 'Catering La Mesa').id`);
ok('el jefe ve la plata', run('vePlata()') === true);
await run('sincronizarPartes(getPy())');
let g = await enBase(PY);
ok('subieron los gastos enteros', g && g.datos.comprobantes.length === run('getPy().comprobantes.length') && g.datos.cajas.length === 3, g && g.datos.comprobantes.length + ' comprobantes');
const TODOS = g.datos.comprobantes.length;

console.log('\n--- 2. QUÉ LE LLEGA A CADA UNO ---');
let r = await q1('carla', `select parte from proyecto_parte where proyecto_id=$1 and parte='gastos'`, [PY]);
ok('Carla (arte) no puede leer la parte "gastos" de la tabla', r.length === 0);
let L = await leerComo('carla', PY);
const ids = o => (o || []).map(x => x.id).sort().join(',');
ok('leer_gastos le trae sólo su fondo y sus comprobantes', ids(L.datos.cajas) === 'cj-carla' && ids(L.datos.comprobantes) === 'cp-carla-1,cp-carla-suelto', ids(L.datos.comprobantes));
ok('ni las órdenes de compra, ni el comprobante de $ 448.000 del jefe', !('ocs' in L.datos) && !JSON.stringify(L.datos).includes('448000') && !JSON.stringify(L.datos).includes('Catering'));
ok('con la versión, para saber si cambió', L.version === g.version);
L = await leerComo('diego', PY);
const deDiego = g.datos.comprobantes.filter(c => c.cargadoPor === UID.diego).length;
ok('Diego (asistente de producción) recibe lo suyo y lo de arte y el equipo, que revisa',
  L.datos.cajas.some(c => c.id === 'cj-carla') && L.datos.cajas.some(c => c.responsable === UID.diego) && L.datos.cajas.some(c => c.responsable === UID.sofia)
  && L.datos.comprobantes.length === deDiego + g.datos.comprobantes.filter(c => [UID.carla, UID.sofia].includes(c.cargadoPor)).length, L.datos.comprobantes.length + ' comprobantes');
ok('pero no los del jefe ni el cheque de Carla', !JSON.stringify(L.datos).includes('Catering') && L.datos.cheques.every(c => c.pedidoPor === UID.diego));
L = await leerComo('paula', PY);
ok('la asistente de dirección no recibe ningún gasto', L.datos.comprobantes.length === 0 && L.datos.cajas.length === 0);
L = await leerComo('marta', PY);
ok('Administración recibe todo', L.datos.comprobantes.length === TODOS && L.datos.cajas.length === 3);
r = await como('carla', async () => { try { await db.query(`update proyecto_parte set datos='{}' where proyecto_id=$1 and parte='gastos'`, [PY]); return 'pudo'; } catch (e) { return e.message; } });
ok('nadie escribe la tabla directo (salteando los controles)', r !== 'pudo', r);
r = await como('jefe', async () => { try { await db.query(`insert into proyecto_parte(proyecto_id,parte,datos) values($1,'tareas','{}')`, [PY]); return 'pudo'; } catch (e) { return e.message; } });
ok('ni siquiera el jefe: todo pasa por guardar_parte', r !== 'pudo', r);

console.log('\n--- 3. LA COMPU DE CARLA, CON LA APP ---');
({py} = armarCompu('carla', PY));
ok('Carla no ve la plata', run('vePlata()') === false && run('gastosFiltrados()') === true);
await run('sincronizarPartes(getPy())');
let local = run('JSON.stringify({c: getPy().comprobantes, k: getPy().cajas, q: getPy().cheques})');
ok('le llegan sólo su fondo y sus comprobantes', run('getPy().comprobantes.map(c => c.id).sort().join(",")') === 'cp-carla-1,cp-carla-suelto' && run('getPy().cajas.length') === 1,
  run('getPy().comprobantes.length') + ' comprobantes');
run('guardar()');
ok('en su compu no queda nada de los demás (ni en lo guardado)', !local.includes(CATERING) && !Object.values(store).some(x => String(x).includes(CATERING)));
ok('pidió los gastos por leer_gastos', pedidos.some(p => p === '/rest/v1/rpc/leer_gastos'));
/* carga un ticket y manda la rendición a producción */
run(`(() => { const cj = getCajas()[0]; const c = nuevoGastoRend(cj, {fecha: hoy(), proveedor: 'Ferretería de prueba', rubro: '06', tipo: 'ticket', importe: 5500, concepto: 'Clavos'}); c.id = 'cp-carla-2'; })()`);
await run('sincronizarPartes(getPy())');
g = await enBase(PY);
ok('su ticket sube y la base lo junta con lo de los demás', g.datos.comprobantes.length === TODOS + 1 && g.datos.comprobantes.some(c => c.id === 'cp-carla-2') && g.datos.comprobantes.some(c => c.proveedor === 'Catering La Mesa'));
ok('las órdenes de compra quedan como estaban', JSON.stringify(g.datos.ocs || null) === JSON.stringify((await leerComo('marta', PY)).datos.ocs || null));
run(`enviarRend('cj-carla')`);
ok('en la app, la manda "a producción"', run(`estadoRend(cajaPorId('cj-carla'))`) === 'aProduccion');
await run('sincronizarPartes(getPy())');
g = await enBase(PY);
ok('y en la base queda en producción', g.datos.cajas.find(c => c.id === 'cj-carla').rendicion.estado === 'aProduccion');

console.log('\n--- 4. LO QUE LA BASE NO DEJA ---');
const vis = async k => { const x = await leerComo(k, PY); return {d: x.datos, v: x.version}; };
const clon = x => JSON.parse(JSON.stringify(x));
let V = await vis('carla'), x = clon(V.d);
x.cajas[0].rendicion.estado = 'enviada';
r = await guardarComo('carla', PY, x, V.v); ok('arte no la manda directo al jefe', !!r.error, r.error);
x = clon(V.d); x.comprobantes.push({id: g.datos.comprobantes.find(c => c.proveedor === 'Catering La Mesa').id, cargadoPor: UID.carla, estado: 'cargado', importe: 1});
r = await guardarComo('carla', PY, x, V.v); ok('no pisa un comprobante ajeno con el mismo id', !!r.error, r.error);
x = clon(V.d); x.comprobantes.find(c => c.id === 'cp-carla-suelto').cargadoPor = UID.diego;
r = await guardarComo('carla', PY, x, V.v); ok('no le pasa un comprobante suyo a otra persona', !!r.error, r.error);
V = await vis('marta'); x = clon(V.d);
x.cajas.find(c => c.id === 'cj-carla').rendicion.estado = 'aprobada';
r = await guardarComo('marta', PY, x, V.v); ok('Administración no la aprueba salteando al jefe', !!r.error, r.error);
x = clon(V.d); Object.assign(x.cajas.find(c => c.id === 'cj-carla'), {estado: 'rendida'}); x.cajas.find(c => c.id === 'cj-carla').rendicion.estado = 'cerrada';
r = await guardarComo('marta', PY, x, V.v); ok('ni la cierra antes de que la eleve el jefe', !!r.error, r.error);
x = clon(V.d); x.comprobantes.find(c => c.id === 'cp-carla-suelto').estado = 'revisado';
r = await guardarComo('marta', PY, x, V.v); ok('ni revisa un gasto suelto de arte salteando producción', !!r.error, r.error);
V = await vis('diego'); x = clon(V.d);
x.cajas.find(c => c.id === 'cj-carla').rendicion.estado = 'aprobada';
r = await guardarComo('diego', PY, x, V.v); ok('el asistente de producción no la eleva (eso es del jefe)', !!r.error, r.error);
x = clon(V.d); x.cajas.find(c => c.id === 'cj-carla').adelantos.push({id: 'ad-x', importe: 1});
r = await guardarComo('diego', PY, x, V.v); ok('ni toca la plata que se le dio', !!r.error, r.error);
x = clon(V.d); x.comprobantes.find(c => c.id === 'cp-carla-1').importe = 1;
r = await guardarComo('diego', PY, x, V.v); ok('ni cambia los tickets de Carla', !!r.error, r.error);

console.log('\n--- 5. EL CAMINO: ARTE → PRODUCCIÓN → JEFE → ADMINISTRACIÓN ---');
({py} = armarCompu('diego', PY));
await run('sincronizarPartes(getPy())');
ok('Diego la tiene para revisar', run(`esperaDe(cajaPorId('cj-carla'))`) === true && run(`asistRevisa(cajaPorId('cj-carla'))`) === true);
ok('no le llegan los gastos del jefe', !run('JSON.stringify(getPy().comprobantes)').includes('Catering'));
run(`comentarRend('cj-carla', 'Revisado: falta el ticket de la cinta, pero está bien')`);
run(`pasarJefeRend('cj-carla')`);
run(`accionComprobante('cp-carla-suelto', 'pasar')`);
await run('sincronizarPartes(getPy())');
g = await enBase(PY);
let cjC = g.datos.cajas.find(c => c.id === 'cj-carla');
ok('Diego comentó y se la pasó al jefe', cjC.rendicion.estado === 'enviada' && cjC.rendicion.charla.some(m => /Revisado/.test(m.texto)), run('_sync.error') || '');
ok('y el gasto suelto de arte queda visto por producción', !!g.datos.comprobantes.find(c => c.id === 'cp-carla-suelto').vistoProd);
ok('lo de los demás sigue intacto', g.datos.comprobantes.length === TODOS + 1);
({py} = armarCompu('jefe', PY));
await run('sincronizarPartes(getPy())');
run(`elevarRend('cj-carla')`);
run(`accionComprobante('cp-carla-suelto', 'revisar')`);
await run('sincronizarPartes(getPy())');
g = await enBase(PY); cjC = g.datos.cajas.find(c => c.id === 'cj-carla');
ok('el jefe la eleva a Administración', cjC.rendicion.estado === 'aprobada', run('_sync.error') || '');
ok('y revisa el gasto suelto', g.datos.comprobantes.find(c => c.id === 'cp-carla-suelto').estado === 'revisado');
({py} = armarCompu('marta', PY));
await run('sincronizarPartes(getPy())');
const T = run(`totalesRend(getPy(), cajaPorId('cj-carla'))`);
run(`document.querySelectorAll = sel => String(sel).includes('[name]') ? [{name: 'monto', value: '${T.saldo}'}, {name: 'fecha', value: hoy()}, {name: 'notas', value: ''}] : []`);
run(`confirmarRendicion('cj-carla')`);
run(`document.querySelectorAll = () => []`);
await run('sincronizarPartes(getPy())');
g = await enBase(PY); cjC = g.datos.cajas.find(c => c.id === 'cj-carla');
ok('Administración la cierra y anota la devolución (el monto y la fecha, no cómo)', cjC.rendicion.estado === 'cerrada' && cjC.devuelto === T.saldo && !!cjC.cierre.fecha && !('circuito' in cjC.cierre), run('_sync.error') || JSON.stringify(cjC.cierre));

console.log('\n--- 6. EL CAMBIO: UNA COMPU QUE TENÍA LOS GASTOS ENTEROS ---');
({py} = armarCompu('sofia', PY));
/* como si antes del SQL nuevo hubiera bajado todo: la base vieja se lo mandaba */
const viejo = (await enBase(PY));
run(`PARTES_PY.gastos.pone(getPy(), ${JSON.stringify(viejo.datos)}); SYNC[getPy().id] = {gastos: {v: ${viejo.version}, h: canon(${JSON.stringify(viejo.datos)})}};`);
ok('(tenía los de todos)', run('getPy().comprobantes.length') === viejo.datos.comprobantes.length);
await run('sincronizarPartes(getPy())');
ok('al sincronizar le quedan sólo los suyos, aunque la versión sea la misma', run('getPy().comprobantes.every(c => c.cargadoPor === getUsuario().id || (getPy().cajas.find(k => k.id === c.cajaId) || {}).responsable === getUsuario().id)')
  && !run('JSON.stringify(getPy().comprobantes)').includes('Catering'), run('getPy().comprobantes.length') + ' comprobantes');
g = await enBase(PY);
ok('y no tocó nada en la base', g.version === viejo.version);

console.log('\n--- 7. LO DE SIEMPRE, CON LOS GASTOS FILTRADOS ---');
V = await vis('diego'); x = clon(V.d);
const fd = x.cajas.find(c => c.responsable === UID.diego);
x.cajas.push({id: 'cj-nueva', responsable: UID.diego, estado: 'abierta', adelantos: []});
r = await guardarComo('diego', PY, x, V.v); ok('el asistente no se abre un fondo', !!r.error, r.error);
x = clon(V.d); x.cajas.find(c => c.id === fd.id).adelantos.push({id: 'ad-y', importe: 999});
r = await guardarComo('diego', PY, x, V.v); ok('ni se anota adelantos', !!r.error, r.error);
x = clon(V.d); x.cajas.find(c => c.id === fd.id).rendicion.estado = 'aprobada';
r = await guardarComo('diego', PY, x, V.v); ok('ni se aprueba solo', !!r.error, r.error);
x = clon(V.d); x.comprobantes.find(c => c.cajaId === fd.id).importe = 1;
r = await guardarComo('diego', PY, x, V.v); ok('su rendición ya mandada no se cambia', !!r.error, r.error);
x = clon(V.d); x.cheques.push({id: 'ch-x', pedidoPor: UID.carla, estado: 'pedido'});
r = await guardarComo('diego', PY, x, V.v); ok('no pide cheques a nombre de otro', !!r.error, r.error);
x = clon(V.d); x.cheques.push({id: 'ch-diego', pedidoPor: UID.diego, estado: 'pedido', a: 'Rental de prueba', monto: 5000});
r = await guardarComo('diego', PY, x, V.v); ok('pide un cheque a su nombre', r.ok === true, r.error || '');
g = await enBase(PY);
ok('y la base lo junta: los cheques de los demás siguen', g.datos.cheques.some(c => c.id === 'ch-diego') && g.datos.cheques.some(c => c.pedidoPor === UID.carla));
V = await vis('jefe'); x = clon(V.d);
const fx = x.cajas.find(c => c.id === fd.id); fx.rendicion.estado = 'cerrada'; fx.estado = 'rendida';
r = await guardarComo('jefe', PY, x, V.v); ok('el jefe no cierra', !!r.error, r.error);
x = clon(V.d); x.cajas.find(c => c.id === fd.id).rendicion.estado = 'aprobada';
r = await guardarComo('jefe', PY, x, V.v); ok('el jefe eleva la del asistente de producción (no pasa por nadie más)', r.ok === true, r.error || '');
V = await vis('carla');
r = await guardarComo('carla', PY, V.d, V.v - 1);
ok('si alguien guardó antes, a Carla le vuelve sólo lo suyo para juntar', r.ok === false && r.datos && !JSON.stringify(r.datos).includes(CATERING) && r.datos.cajas.every(c => c.responsable === UID.carla));

console.log('\n--- 8. QUIÉN ELEVA: SIN JEFE DE PRODUCCIÓN, LO DE ARTE LO ELEVA EL PE ---');
/* Administración da tres fondos: uno de Carla, ya en producción, y dos de Diego, mandados */
const fondo8 = (id, quien, estado) => ({id, nombre: 'Fondo ' + id, responsable: UID[quien], moneda: 'ARS', estado: 'abierta',
  adelantos: [{id: 'ad-' + id, fecha: '2026-10-01', importe: 10000, entregadoPor: UID.marta}], rendicion: {estado, pasos: [], charla: []}});
V = await vis('marta'); x = clon(V.d);
x.cajas.push(fondo8('cj-carla-8', 'carla', 'aProduccion'), fondo8('cj-diego-8a', 'diego', 'enviada'), fondo8('cj-diego-8b', 'diego', 'enviada'));
x.comprobantes.push({id: 'cp-carla-8', rubro: '06', proveedor: 'Kiosco de prueba', importe: 2000, tipo: 'ticket', cargadoPor: UID.carla, estado: 'cargado', historial: []});
r = await guardarComo('marta', PY, x, V.v); ok('(Administración da los fondos)', r.ok === true, r.error || '');
const elevar = async (k, id) => { const W = await vis(k), y = clon(W.d); y.cajas.find(c => c.id === id).rendicion.estado = 'aprobada'; return guardarComo(k, PY, y, W.v); };
const revisar = async (k, id) => { const W = await vis(k), y = clon(W.d); y.comprobantes.find(c => c.id === id).estado = 'revisado'; return guardarComo(k, PY, y, W.v); };
r = await elevar('tomas', 'cj-carla-8'); ok('con jefe en el proyecto, el PE no eleva lo de arte', !!r.error, r.error);
r = await revisar('tomas', 'cp-carla-8'); ok('ni revisa un gasto suelto de arte', !!r.error, r.error);
r = await elevar('jefe', 'cj-carla-8'); ok('el jefe tampoco la eleva mientras está en producción: primero la chequea el asistente', /asistente de producción/.test(r.error || ''), r.error);
r = await revisar('jefe', 'cp-carla-8'); ok('ni revisa el gasto suelto que el asistente todavía no le pasó', /asistente de producción/.test(r.error || ''), r.error);
{ const W = await vis('jefe'), y = clon(W.d); y.comprobantes.find(c => c.id === 'cp-carla-8').estado = 'rechazado';
  r = await guardarComo('jefe', PY, y, W.v); ok('ni lo rechaza salteándolo', /asistente de producción/.test(r.error || ''), r.error); }
{ const W = await vis('diego'), y = clon(W.d);
  y.cajas.find(c => c.id === 'cj-carla-8').rendicion.estado = 'enviada';
  y.comprobantes.find(c => c.id === 'cp-carla-8').vistoProd = {quien: 'Diego Sosa', cuando: '2026-10-01'};
  r = await guardarComo('diego', PY, y, W.v); ok('(el asistente de producción se los pasa al jefe)', r.ok === true, r.error || ''); }
r = await elevar('marta', 'cj-diego-8a'); ok('la del asistente de producción la eleva Administración', r.ok === true, r.error || '');
r = await elevar('tomas', 'cj-diego-8b'); ok('y el PE (como el jefe)', r.ok === true, r.error || '');
await db.query(`delete from proyecto_persona where proyecto_id=$1 and usuario_id=$2`, [PY, UID.jefe]);
ok('(el proyecto se queda sin jefe de producción)', (await db.query(`select proyecto_sin_jefe($1) s`, [PY])).rows[0].s === true);
r = await elevar('marta', 'cj-carla-8'); ok('sin jefe, Administración sigue sin elevar lo de arte', !!r.error, r.error);
r = await elevar('diego', 'cj-carla-8'); ok('ni el asistente de producción', !!r.error, r.error);
r = await elevar('tomas', 'cj-carla-8'); ok('sin jefe en el proyecto, el PE eleva lo de arte (ya pasado por el asistente)', r.ok === true, r.error || '');
r = await revisar('tomas', 'cp-carla-8'); ok('y revisa el gasto suelto de arte', r.ok === true, r.error || '');
g = await enBase(PY);
ok('en la base quedó elevada', g.datos.cajas.find(c => c.id === 'cj-carla-8').rendicion.estado === 'aprobada' && g.datos.comprobantes.find(c => c.id === 'cp-carla-8').estado === 'revisado');
/* sin asistente de producción en el proyecto, quien hace de jefe la toma directo */
{ const W = await vis('marta'), y = clon(W.d); y.cajas.push(fondo8('cj-carla-9', 'carla', 'aProduccion'));
  r = await guardarComo('marta', PY, y, W.v); ok('(otro fondo de Carla, en producción)', r.ok === true, r.error || ''); }
r = await elevar('tomas', 'cj-carla-9'); ok('con asistente en el proyecto, el PE (sin jefe) no la toma directo', !!r.error, r.error);
await db.query(`delete from proyecto_persona where proyecto_id=$1 and usuario_id=$2`, [PY, UID.diego]);
ok('(el proyecto se queda sin asistente de producción)', (await db.query(`select proyecto_sin_asist($1) s`, [PY])).rows[0].s === true);
r = await elevar('tomas', 'cj-carla-9'); ok('sin asistente de producción, la revisa y la eleva directo', r.ok === true, r.error || '');
await db.query(`insert into proyecto_persona(proyecto_id,usuario_id) values($1,$2)`, [PY, UID.diego]);
await db.query(`insert into proyecto_persona(proyecto_id,usuario_id) values($1,$2)`, [PY, UID.jefe]);
ok('(con el jefe de vuelta, el proyecto tiene jefe)', (await db.query(`select proyecto_sin_jefe($1) s`, [PY])).rows[0].s === false);

console.log('\n--- 9. QUIÉN INVITA (crear_invitacion) ---');
const invitar9 = async (k, rol) => { try { return {tok: (await q1(k, `select crear_invitacion($1, $2::rol_usuario) t`, [PY, rol]))[0].t}; } catch (e) { return {error: e.message}; } };
r = await invitar9('tomas', 'admin'); ok('el PE invita a Administración', !!r.tok, r.error || '');
ok('(ese link sirve para una persona)', (await db.query(`select usos_max from invitacion where token=$1`, [r.tok])).rows[0].usos_max === 1);
r = await invitar9('marta', 'admin'); ok('Administración también', !!r.tok, r.error || '');
r = await invitar9('jefe', 'asistprod'); ok('el jefe invita a su equipo (un asistente)', !!r.tok, r.error || '');
r = await invitar9('jefe', 'equipo'); ok('(y a alguien del equipo)', !!r.tok, r.error || '');
r = await invitar9('jefe', 'admin'); ok('el jefe no invita a Administración', !!r.error, r.error);
r = await invitar9('jefe', 'ejecutivo'); ok('ni al PE', !!r.error, r.error);
r = await invitar9('diego', 'equipo'); ok('los asistentes no invitan', !!r.error, r.error);
r = await invitar9('sofia', 'equipo'); ok('ni el equipo', !!r.error, r.error);

console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
process.exit(fallos ? 1 : 0);
