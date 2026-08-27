/* Modo prueba: el que entra elige su rol y entra al toque.
   ---------------------------------------------------------------------------
   La clave es DÓNDE se decide. Antes el navegador decidía solo
   (`VE_TODO.includes(rol)` marcaba pendiente siempre), así que aunque en la
   base se abriera la puerta, el navegador igual te dejaba esperando.
   Ahora pide entrar derecho y sólo si la base lo rechaza reintenta esperando.
   Un mismo navegador tiene que funcionar con la base abierta Y con la cerrada. */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

const TB = { organizacion: [], productora: [], usuario: [], catalogo_persona: [] };
let SEQ = 0, SESION = 'auth-a', MODO_PRUEBA = false;
const nid = p => `${p}-${++SEQ}`;
const respu = (s, b) => ({ ok: s >= 200 && s < 300, status: s, statusText: 'x',
  text: async () => b === undefined ? '' : JSON.stringify(b) });

global.fetch = async (url, opts = {}) => {
  const u = String(url), met = opts.method || 'GET';
  const c = opts.body ? JSON.parse(opts.body) : null;
  if (u.includes('/auth/v1/settings')) return respu(200, { external: {} });
  if (u.includes('grant_type=password'))
    return respu(200, { access_token: 't', refresh_token: 'r', expires_in: 3600,
      user: { id: SESION, email: c.email } });
  if (u.includes('/auth/v1/logout')) return respu(204);
  if (u.includes('/rpc/productoras_para_elegir'))
    return respu(200, TB.productora.map(p => ({ id: p.id, nombre: p.nombre })));
  if (u.includes('/rpc/productora_pide_aprobacion')) {
    const pr = TB.productora.find(x => x.id === c.p);
    return respu(200, !!(pr && pr.requiere_aprobacion));
  }
  if (u.includes('/rpc/crear_mi_productora')) {
    let org = TB.organizacion[0];
    if (!org) { org = { id: nid('org') }; TB.organizacion.push(org); }
    const pr = { id: nid('productora'), org_id: org.id, nombre: c.p_nombre, requiere_aprobacion: false };
    TB.productora.push(pr);
    TB.usuario.push({ id: nid('usuario'), auth_uid: SESION, productora_id: pr.id,
      nombre: c.p_mi_nombre, rol: c.p_rol || 'admin', email: SESION + '@x.com',
      activo: true, pendiente: false, alta_el: ++SEQ });
    return respu(200, pr.id);
  }
  if (u.includes('/rpc/guardar_mis_datos')) {
    const mia = TB.usuario.find(x => x.auth_uid === SESION);
    if (!mia) return respu(400, { message: 'Todavía no completaste tu alta' });
    if (c.p_nombre) mia.nombre = c.p_nombre;
    if (MODO_PRUEBA) mia.pendiente = false;
    return respu(200, 'cat-x');
  }

  const m = u.match(/\/rest\/v1\/(\w+)/); if (!m) return respu(404, {});
  const tabla = TB[m[1]]; if (!tabla) return respu(404, { message: 'no existe' });

  if (met === 'POST' && m[1] === 'usuario') {
    const fila = { id: nid('usuario'), alta_el: ++SEQ, ...c };
    if (fila.auth_uid !== SESION)
      return respu(403, { message: 'new row violates row-level security policy' });
    if (!MODO_PRUEBA) {
      /* política vieja: sólo pendiente=true, o candado abierto con rol bajo */
      const pr = TB.productora.find(x => x.id === fila.productora_id);
      const libre = ['equipo', 'produccion'].includes(fila.rol) && !(pr && pr.requiere_aprobacion);
      if (!fila.pendiente && !libre)
        return respu(403, { message: 'new row violates row-level security policy' });
    }
    tabla.push(fila); return respu(200, [fila]);
  }
  if (met === 'POST') { const f = { id: nid(m[1]), ...c }; tabla.push(f); return respu(200, [f]); }
  if (met === 'PATCH') {
    const eq = u.match(/[?&](\w+)=eq\.([^&]+)/);
    const o = tabla.filter(f => String(f[eq[1]]) === decodeURIComponent(eq[2]));
    o.forEach(f => Object.assign(f, c)); return respu(200, o);
  }
  let filas = tabla.slice();
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
  /* --- 1. el formulario propone Administración -------------------------- */
  console.log('--- 1. EL FORMULARIO PROPONE ADMINISTRACION ---');
  navegadorNuevo();
  SESION = 'auth-a'; await conectar('andres@x.com');
  _prodsElegibles = []; modal = null; formAlta();
  ok('el rol que viene puesto es Administración',
    /name="rol"[\s\S]*?<option value="admin" selected/.test(modal));

  cargarForm({ nombre: 'Andrés', tel: '', productoraId: '__nueva',
    productoraNombre: 'Neto Films', rol: 'admin', area: 'produccion' });
  await confirmarAlta();
  ok('creó la productora', TB.productora.length === 1, TB.productora[0].nombre);
  ok('y entró como admin activo',
    TB.usuario[0].rol === 'admin' && !TB.usuario[0].pendiente);

  /* --- 2. CON LA BASE CERRADA: el segundo espera ------------------------ */
  console.log('\n--- 2. BASE CERRADA: SUMARSE COMO ADMIN ESPERA ---');
  MODO_PRUEBA = false;
  navegadorNuevo();
  SESION = 'auth-w'; await conectar('santyno@gmail.com');
  _prodsElegibles = await sbProductorasParaElegir();
  cargarForm({ nombre: 'Willy De Rose', tel: '11 4444-2222',
    productoraId: TB.productora[0].id, productoraNombre: '', rol: 'admin', area: 'produccion' });
  await confirmarAlta();
  let w = await sbMiFicha();
  ok('entró, pero esperando aprobación', !!w && w.pendiente === true);
  ok('con el rol que pidió', w.rol === 'admin', w.rol);
  ok('no quedaron dos fichas suyas',
    TB.usuario.filter(x => x.auth_uid === 'auth-w').length === 1);

  /* --- 3. CON MODO PRUEBA: el mismo navegador lo deja entrar derecho ---- */
  console.log('\n--- 3. MODO PRUEBA: EL MISMO NAVEGADOR LO DEJA ENTRAR ---');
  MODO_PRUEBA = true;
  TB.usuario = TB.usuario.filter(x => x.auth_uid !== 'auth-w');   /* como si no hubiera entrado */
  navegadorNuevo();
  SESION = 'auth-w'; await conectar('santyno@gmail.com');
  _prodsElegibles = await sbProductorasParaElegir();
  cargarForm({ nombre: 'Willy De Rose', tel: '11 4444-2222',
    productoraId: TB.productora[0].id, productoraNombre: '', rol: 'admin', area: 'produccion' });
  await confirmarAlta();
  w = await sbMiFicha();
  ok('ENTRA DERECHO, sin esperar a nadie', !!w && w.pendiente === false,
    'pendiente=' + (w && w.pendiente));
  ok('como Administración', w.rol === 'admin', w.rol);
  const yo = getUsuario();
  ok('la app lo reconoce', yo && yo.nombre === 'Willy De Rose', yo && yo.nombre);
  ok('y tiene permisos para todo',
    puede(yo, 'cargar') && puede(yo, 'revisar') && puede(yo, 'aprobar') && puede(yo, 'pagar'));
  ok('ve todo sin que lo inviten a un proyecto', veTodo(yo));
  render();
  ok('no le aparece el cartel de esperar aprobación',
    !/esperando aprobación/.test(app.innerHTML));

  /* --- 4. un tercero cualquiera, también --------------------------------- */
  console.log('\n--- 4. Y CUALQUIERA QUE ENTRE AHORA, IGUAL ---');
  navegadorNuevo();
  SESION = 'auth-t'; await conectar('tercero@x.com');
  _prodsElegibles = await sbProductorasParaElegir();
  cargarForm({ nombre: 'Mariano', tel: '', productoraId: TB.productora[0].id,
    productoraNombre: '', rol: 'ejecutivo', area: 'produccion' });
  await confirmarAlta();
  const t = await sbMiFicha();
  ok('entra derecho', t && !t.pendiente);
  ok('con permisos para todo', puede(getUsuario(), 'pagar'));

  /* --- 5. nadie puede darse de alta POR OTRO ---------------------------- */
  console.log('\n--- 5. LO QUE SIGUE PROHIBIDO: ENTRAR POR OTRO ---');
  const suplanta = await sbFetch('/rest/v1/usuario', { method: 'POST',
    body: JSON.stringify({ auth_uid: 'auth-a', productora_id: TB.productora[0].id,
      nombre: 'Me hago pasar por Andrés', rol: 'admin', activo: true, pendiente: false }) })
    .then(() => 'pasó').catch(e => e.message);
  ok('la base lo rechaza igual', /no te deja|policy|security/i.test(suplanta), suplanta);

  console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
  process.exitCode = fallos ? 1 : 0;
})();
