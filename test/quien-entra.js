/* "Quién entra": la pantalla que contesta sin tener que mirar la base.
   ---------------------------------------------------------------------------
   Con CLAP privado (backend/privado.sql) el rol lo da la invitación o un
   administrador, nunca uno mismo. Acá se prueba eso, y que desde la pantalla
   el administrador pueda cambiar roles y dar de baja sin tocar SQL.         */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

const TB = { organizacion: [], productora: [], usuario: [], catalogo_persona: [],
             proyecto: [], proyecto_persona: [] };
let SEQ = 0, SESION = 'auth-uno';
const nid = pre => `${pre}-${++SEQ}`;
const respu = (s, b) => ({ ok: s >= 200 && s < 300, status: s, statusText: 'x',
  text: async () => b === undefined ? '' : JSON.stringify(b) });

const miRol = prod => (TB.usuario.find(u => u.auth_uid === SESION && u.productora_id === prod
  && u.activo && !u.pendiente) || {}).rol;
const misProductoras = () => TB.usuario
  .filter(u => u.auth_uid === SESION && u.activo && !u.pendiente)
  .map(u => u.productora_id);

global.fetch = async (url, opts = {}) => {
  const u = String(url), met = opts.method || 'GET';
  const c = opts.body ? JSON.parse(opts.body) : null;

  if (u.includes('/auth/v1/settings')) return respu(200, { external: {} });
  if (u.includes('grant_type=password'))
    return respu(200, { access_token: 'tok', refresh_token: 'r', expires_in: 3600,
      user: { id: SESION, email: c.email } });
  if (u.includes('/auth/v1/logout')) return respu(204);
  if (u.includes('/rpc/productoras_para_elegir'))
    return respu(200, TB.productora.filter(p => TB.usuario.some(x => x.auth_uid === SESION && x.productora_id === p.id))
      .map(p => ({ id: p.id, nombre: p.nombre })));

  if (u.includes('/rpc/crear_mi_productora')) {
    let org = TB.organizacion[0];
    if (!org) { org = { id: nid('org'), nombre: 'Estudio' }; TB.organizacion.push(org); }
    const pr = { id: nid('productora'), org_id: org.id, nombre: String(c.p_nombre).trim() };
    TB.productora.push(pr);
    TB.usuario.push({ id: nid('usuario'), auth_uid: SESION, productora_id: pr.id,
      nombre: c.p_mi_nombre || 'Yo', rol: 'admin', area: c.p_area, tel: c.p_tel,
      email: SESION + '@x.com', activo: true, pendiente: false, alta_el: ++SEQ });
    return respu(200, pr.id);
  }
  /* guardar_mis_datos de privado.sql: el rol NO se toca */
  if (u.includes('/rpc/guardar_mis_datos')) {
    const mias = TB.usuario.filter(x => x.auth_uid === SESION);
    if (!mias.length) return respu(400, { message: 'Todavía no estás en ninguna productora' });
    mias.forEach(mia => {
      if (c.p_nombre) mia.nombre = c.p_nombre;
      if (c.p_tel != null) mia.tel = c.p_tel;
    });
    return respu(200, 'cat-x');
  }

  const m = u.match(/\/rest\/v1\/(\w+)/); if (!m) return respu(404, {});
  const tabla = TB[m[1]]; if (!tabla) return respu(404, { message: 'no existe' });

  if (met === 'POST') {
    if (m[1] === 'usuario') return respu(403, { message: 'new row violates row-level security policy' });
    const fila = { id: nid(m[1]), ...c }; tabla.push(fila); return respu(200, [fila]);
  }
  if (met === 'PATCH') {
    const eq = u.match(/[?&](\w+)=eq\.([^&]+)/);
    let obj = tabla.filter(f => String(f[eq[1]]) === decodeURIComponent(eq[2]));
    /* usuario_editar: sólo admin o ejecutivo de esa productora (y no hay
       usuario_editar_mia: uno no se cambia el rol a sí mismo) */
    if (m[1] === 'usuario') obj = obj.filter(f => ['admin', 'ejecutivo'].includes(miRol(f.productora_id)));
    obj.forEach(f => Object.assign(f, c)); return respu(200, obj);
  }
  let filas = tabla.slice();
  const mias = misProductoras();
  if (m[1] === 'productora') filas = filas.filter(f => mias.includes(f.id));
  if (m[1] === 'usuario')    filas = filas.filter(f => mias.includes(f.productora_id) || f.auth_uid === SESION);
  [...u.matchAll(/[?&](\w+)=eq\.([^&]+)/g)].forEach(f => {
    filas = filas.filter(x => String(x[f[1]]) === decodeURIComponent(f[2])); });
  return respu(200, filas);
};

const conectar = async mail => { sbOlvidar(); SB.url = 'https://x.supabase.co'; SB.anon = 'a';
  sbGuardar(); await sbLogin(mail, 'secreto123'); SB.orgId = null; };
const cargarForm = campos => { global.document.querySelectorAll = s =>
  /\[name\]/.test(s) ? Object.entries(campos).map(([name, value]) => ({ name, value })) : []; };
const navegadorNuevo = () => { DB = dbVacia(); sembrar(); _miFicha = null; _miProductora = null; };
let pantalla = '';
document.getElementById = id => id === 'equipocont'
  ? { set innerHTML(v) { pantalla = v; }, get innerHTML() { return pantalla; } } : null;

(async () => {
  /* --- 1. quien crea la productora es su administrador ------------------- */
  console.log('--- 1. LA PRODUCTORA PROPIA ---');
  navegadorNuevo();
  SESION = 'auth-uno'; await conectar('uno@x.com');
  cargarForm({ nombre: 'Willy', tel: '', productoraNombre: 'Millanisima', area: 'produccion' });
  await confirmarAlta();
  ok('creó su productora', TB.productora.length === 1, TB.productora[0].nombre);
  ok('y es su administrador, activo', TB.usuario[0].rol === 'admin' && !TB.usuario[0].pendiente);

  /* --- 2. el invitado no se sube de rol solo ----------------------------- */
  console.log('\n--- 2. EL ROL NO SE LO PONE UNO ---');
  /* entró por una invitación de Equipo (eso lo hace aceptar_invitacion) */
  TB.usuario.push({ id: nid('usuario'), auth_uid: 'auth-dos', productora_id: TB.productora[0].id,
    nombre: 'El Vivo', rol: 'equipo', email: 'dos@x.com', activo: true, pendiente: false, alta_el: ++SEQ });
  navegadorNuevo();
  SESION = 'auth-dos'; await conectar('dos@x.com');
  _miFicha = await sbMiFicha();
  modal = null; await editarMiFicha();
  ok('Mis datos no tiene selector de rol', !/name="rol"/.test(modal || ''));
  cargarForm({ nombre: 'El Vivo', tel: '', rol: 'admin', area: 'arte',
    funcion: '', dni: '', cuit: '', condicion: '', banco: '', alias: '' });
  await guardarMiFicha();
  ok('aunque mande rol=admin, sigue siendo Equipo', (await sbMiFicha()).rol === 'equipo');
  const atajo = await sbFetch(`/rest/v1/usuario?id=eq.${_miFicha.id}`, { method: 'PATCH',
    headers: { 'Prefer': 'return=representation' }, body: JSON.stringify({ rol: 'admin' }) });
  ok('y un PATCH directo no cambia nada', atajo.length === 0 && (await sbMiFicha()).rol === 'equipo');

  /* --- 3. la pantalla "Quién entra" ------------------------------------- */
  console.log('\n--- 3. LA PANTALLA LO CUENTA SIN MIRAR LA BASE ---');
  SESION = 'auth-uno'; await conectar('uno@x.com');
  _miFicha = await sbMiFicha();
  modal = null; await menuEquipoAccesos();
  ok('lista a los dos', /Willy/.test(pantalla) && /El Vivo/.test(pantalla));
  ok('el admin ve toda la productora', /ve toda la productora/.test(pantalla));
  ok('el de Equipo, sólo donde lo invitaron', /ve donde lo invitaron/.test(pantalla));
  ok('nadie figura "esperando aprobación"', !/esperando aprobación/.test(pantalla));
  ok('no aparece el aviso viejo de destrabar.sql', !/destrabar\.sql/.test(pantalla));
  ok('deja cambiarle el rol', /cambiarRolDe\(/.test(pantalla));
  ok('y darlo de baja', /darDeBajaA\(/.test(pantalla) && /Dar de baja/.test(pantalla));
  ok('explica qué ve cada rol', /sólo ven los proyectos a los que se los invita/.test(pantalla));

  /* --- 4. cambiar el rol y dar de baja, con un botón -------------------- */
  console.log('\n--- 4. CAMBIAR EL ROL Y DAR DE BAJA ---');
  const vivo = TB.usuario.find(u => u.nombre === 'El Vivo');
  await cambiarRolDe(vivo.id, 'produccion');
  ok('el admin le cambió el rol', vivo.rol === 'produccion');
  await darDeBajaA(vivo.id, false);
  ok('lo dio de baja', vivo.activo === false);
  ok('la pantalla lo muestra dado de baja, con Reactivar', /dado de baja/.test(pantalla) && /Reactivar/.test(pantalla));
  await darDeBajaA(vivo.id, true);
  ok('y lo puede reactivar', vivo.activo === true);

  console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
  process.exitCode = fallos ? 1 : 0;
})();
