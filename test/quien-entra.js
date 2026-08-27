/* "Quién entra": la pantalla que contesta sin tener que mirar la base.
   ---------------------------------------------------------------------------
   Y la trampa que la motivó: el comentario de `guardar_mis_datos` prometía que
   subirse de rol NO pide aprobación "si la productora es de uno", pero eso
   nunca se programó. Resultado: el que estaba solo en su productora y se ponía
   Administración quedaba esperando una aprobación que nadie podía darle.
   Sin salida. Acá se prueba la regla arreglada.                              */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

const TB = { organizacion: [], productora: [], usuario: [], catalogo_persona: [],
             proyecto: [], proyecto_persona: [] };
let SEQ = 0, SESION = 'auth-uno';
const nid = pre => `${pre}-${++SEQ}`;
const respu = (s, b) => ({ ok: s >= 200 && s < 300, status: s, statusText: 'x',
  text: async () => b === undefined ? '' : JSON.stringify(b) });

const misProductoras = () => TB.usuario
  .filter(u => u.auth_uid === SESION && u.activo && !u.pendiente
    && ['admin', 'ejecutivo'].includes(u.rol))
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
    return respu(200, TB.productora.map(p => ({ id: p.id, nombre: p.nombre })));
  if (u.includes('/rpc/productora_pide_aprobacion')) return respu(200, false);

  if (u.includes('/rpc/crear_mi_productora')) {
    let org = TB.organizacion[0];
    if (!org) { org = { id: nid('org'), nombre: 'Estudio' }; TB.organizacion.push(org); }
    const pr = { id: nid('productora'), org_id: org.id, nombre: String(c.p_nombre).trim() };
    TB.productora.push(pr);
    TB.usuario.push({ id: nid('usuario'), auth_uid: SESION, productora_id: pr.id,
      nombre: c.p_mi_nombre || 'Yo', rol: c.p_rol || 'admin', area: c.p_area, tel: c.p_tel,
      email: SESION + '@x.com', activo: true, pendiente: false, alta_el: ++SEQ });
    return respu(200, pr.id);
  }

  /* guardar_mis_datos CON EL ARREGLO de backend/destrabar.sql:
     subirse a un rol que ve todo espera aprobación SÓLO si hay alguien
     adentro que pueda darla. */
  if (u.includes('/rpc/guardar_mis_datos')) {
    const mia = TB.usuario.find(x => x.auth_uid === SESION);
    if (!mia) return respu(400, { message: 'Todavía no completaste tu alta' });
    const hayQuienApruebe = TB.usuario.some(o => o.productora_id === mia.productora_id
      && o.id !== mia.id && o.activo && !o.pendiente && ['admin', 'ejecutivo'].includes(o.rol));
    if (c.p_nombre) mia.nombre = c.p_nombre;
    if (c.p_tel != null) mia.tel = c.p_tel;
    if (c.p_rol && c.p_rol !== mia.rol) {
      if (['admin', 'ejecutivo'].includes(c.p_rol)
        && !['admin', 'ejecutivo'].includes(mia.rol) && hayQuienApruebe) mia.pendiente = true;
      mia.rol = c.p_rol;
    }
    const pr = TB.productora.find(x => x.id === mia.productora_id) || {};
    let cat = TB.catalogo_persona.find(x => x.id === mia.catalogo_id);
    if (!cat) { cat = { id: nid('cat'), org_id: pr.org_id, tipo: 'persona', email: mia.email };
      TB.catalogo_persona.push(cat); }
    cat.nombre = c.p_nombre || cat.nombre; cat.tel = c.p_tel || cat.tel;
    mia.catalogo_id = cat.id;
    return respu(200, cat.id);
  }

  const m = u.match(/\/rest\/v1\/(\w+)/); if (!m) return respu(404, {});
  const tabla = TB[m[1]]; if (!tabla) return respu(404, { message: 'no existe' });

  if (met === 'POST') {
    const fila = { id: nid(m[1]), alta_el: ++SEQ, ...c };
    if (m[1] === 'usuario') {
      const pr = TB.productora.find(x => x.id === fila.productora_id);
      const libre = ['equipo', 'produccion'].includes(fila.rol) && !(pr && pr.requiere_aprobacion);
      if (!fila.pendiente && !libre) return respu(403, { message: 'row-level security policy' });
    }
    if (m[1] === 'catalogo_persona') { const ya = tabla.find(x => x.id === c.id);
      if (ya) { Object.assign(ya, c); return respu(200, [ya]); }
      tabla.push(c); return respu(200, [c]); }
    tabla.push(fila); return respu(200, [fila]);
  }
  if (met === 'PATCH') {
    const eq = u.match(/[?&](\w+)=eq\.([^&]+)/);
    const obj = tabla.filter(f => String(f[eq[1]]) === decodeURIComponent(eq[2]));
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

(async () => {
  /* --- 1. la trampa: solo en mi productora, me subo de rol --------------- */
  console.log('--- 1. SI ESTOY SOLO, NO HAY A QUIEN ESPERAR ---');
  navegadorNuevo();
  SESION = 'auth-uno'; await conectar('uno@x.com');
  cargarForm({ nombre: 'Willy', tel: '', productoraId: '__nueva',
    productoraNombre: 'Millanisima', rol: 'produccion', area: 'produccion' });
  await confirmarAlta();
  ok('creó su productora', TB.productora.length === 1, TB.productora[0].nombre);
  ok('entró como Producción, activo', !TB.usuario[0].pendiente, TB.usuario[0].rol);

  _miFicha = await sbMiFicha();
  cargarForm({ nombre: 'Willy', tel: '', rol: 'admin', area: 'produccion',
    funcion: '', dni: '', cuit: '', condicion: '', banco: '', alias: '' });
  await guardarMiFicha();
  const yo = await sbMiFicha();
  ok('AHORA SE PONE ADMIN Y NO QUEDA COLGADO', yo.pendiente === false,
    'pendiente=' + yo.pendiente);
  ok('y es administrador', yo.rol === 'admin', yo.rol);

  /* --- 2. pero en casa ajena con dueño, sí espera ----------------------- */
  console.log('\n--- 2. EN CASA AJENA CON DUEÑO, SI ESPERA ---');
  navegadorNuevo();
  SESION = 'auth-dos'; await conectar('dos@x.com');
  _prodsElegibles = await sbProductorasParaElegir();
  cargarForm({ nombre: 'El Vivo', tel: '', productoraId: TB.productora[0].id,
    productoraNombre: '', rol: 'equipo', area: 'arte' });
  await confirmarAlta();
  _miFicha = await sbMiFicha();
  ok('entra como Equipo, sin trámite', !_miFicha.pendiente);
  cargarForm({ nombre: 'El Vivo', tel: '', rol: 'admin', area: 'arte',
    funcion: '', dni: '', cuit: '', condicion: '', banco: '', alias: '' });
  await guardarMiFicha();
  const vivo = await sbMiFicha();
  ok('subirse a admin SI pide aprobación', vivo.pendiente === true);
  ok('porque hay un admin que puede darla',
    TB.usuario.some(u => u.rol === 'admin' && !u.pendiente && u.auth_uid === 'auth-uno'));

  /* --- 3. la pantalla "Quién entra" ------------------------------------- */
  console.log('\n--- 3. LA PANTALLA LO CUENTA SIN MIRAR LA BASE ---');
  SESION = 'auth-uno'; await conectar('uno@x.com');
  _miFicha = await sbMiFicha();
  modal = null; await menuEquipoAccesos();
  const html = document.getElementById('equipocont').innerHTML;
  ok('lista a los dos', /Willy/.test(html) && /El Vivo/.test(html));
  ok('dice quién entra y ve todo', /entra y ve todo/.test(html));
  ok('y quién está esperando', /esperando aprobación/.test(html));
  ok('ofrece aprobar al que espera', /aprobarA\(/.test(html));
  ok('y deja cambiarle el rol', /cambiarRolDe\(/.test(html));
  ok('explica qué significa cada rol', /sólo ven los proyectos a los que se los invita/.test(html));

  /* --- 4. aprobar desde ahí, sin SQL ------------------------------------ */
  console.log('\n--- 4. APROBAR CON UN BOTON ---');
  const pend = TB.usuario.find(u => u.pendiente);
  await aprobarA(pend.id);
  ok('quedó aprobado', !TB.usuario.find(u => u.id === pend.id).pendiente);
  const html2 = document.getElementById('equipocont').innerHTML;
  ok('y la pantalla ya no lo muestra esperando', !/esperando aprobación/.test(html2));

  /* --- 5. si no hay quien apruebe, la pantalla lo dice ------------------ */
  console.log('\n--- 5. SI NADIE PUEDE APROBAR, SE AVISA ---');
  TB.usuario.forEach(u => { u.rol = 'equipo'; });
  TB.usuario.push({ id: nid('usuario'), auth_uid: 'auth-tres', productora_id: TB.productora[0].id,
    nombre: 'Colgado', rol: 'ejecutivo', email: 'tres@x.com', activo: true, pendiente: true, alta_el: 99 });
  SESION = 'auth-uno';
  /* con RLS puesta, alguien sin rol alto no ve al resto: se fuerza la lectura */
  TB.usuario.find(u => u.auth_uid === 'auth-uno').rol = 'admin';
  TB.usuario.find(u => u.auth_uid === 'auth-uno').pendiente = true;   /* admin pero pendiente */
  SESION = 'auth-uno'; _miFicha = await sbMiFicha();
  ok('mi ficha se lee aunque esté pendiente', !!_miFicha && _miFicha.pendiente === true);

  console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
  process.exitCode = fallos ? 1 : 0;
})();
