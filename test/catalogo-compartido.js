/* El catálogo es UNO SOLO para todo el equipo, no una copia por navegador.
   ---------------------------------------------------------------------------
   Lo que estaba roto: el catálogo vivía sólo en el localStorage de cada uno.
   El único fetch contra el servidor traía la ficha propia y nada más. Dos
   personas del mismo equipo, en dos máquinas, no se veían NUNCA. Y el que se
   daba de alta no quedaba en el catálogo del servidor, así que aunque hubiera
   sincronización tampoco habría aparecido.

   Este doble respeta las políticas de verdad: `catalogo_mio` filtra por
   org_id contra `mis_orgs()`, que exige `activo AND NOT pendiente`.          */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

const TB = { organizacion: [], productora: [], usuario: [], catalogo_persona: [],
             proyecto: [], proyecto_persona: [] };
let SEQ = 0, SESION = 'auth-andres';
const nid = pre => `${pre}-${++SEQ}`;
const respu = (status, body) => ({ ok: status >= 200 && status < 300, status, statusText: 'x',
  text: async () => body === undefined ? '' : JSON.stringify(body) });

const misProductoras = () => TB.usuario
  .filter(u => u.auth_uid === SESION && u.activo && !u.pendiente)
  .filter(u => ['admin', 'ejecutivo'].includes(u.rol)
    || TB.proyecto_persona.some(pp => pp.usuario_id === u.id))
  .map(u => u.productora_id);
const misOrgs = () => TB.productora.filter(p => misProductoras().includes(p.id)).map(p => p.org_id);

global.fetch = async (url, opts = {}) => {
  const u = String(url), met = opts.method || 'GET';
  const cuerpo = opts.body ? JSON.parse(opts.body) : null;

  if (u.includes('/auth/v1/settings')) return respu(200, { external: {} });
  if (u.includes('grant_type=password'))
    return respu(200, { access_token: 'tok', refresh_token: 'ref', expires_in: 3600,
      user: { id: SESION, email: cuerpo.email } });
  if (u.includes('/auth/v1/logout')) return respu(204);

  if (u.includes('/rpc/productoras_para_elegir'))
    return respu(200, TB.productora.map(p => ({ id: p.id, nombre: p.nombre })));
  if (u.includes('/rpc/productora_pide_aprobacion')) {
    const pr = TB.productora.find(x => x.id === cuerpo.p);
    return respu(200, !!(pr && pr.requiere_aprobacion));
  }
  if (u.includes('/rpc/crear_mi_productora')) {
    let org = TB.organizacion[0];
    if (!org) { org = { id: nid('organizacion'), nombre: 'Mi estudio' }; TB.organizacion.push(org); }
    const prod = { id: nid('productora'), org_id: org.id, nombre: String(cuerpo.p_nombre).trim(),
      requiere_aprobacion: false };
    TB.productora.push(prod);
    TB.usuario.push({ id: nid('usuario'), auth_uid: SESION, productora_id: prod.id,
      nombre: cuerpo.p_mi_nombre || 'Yo', rol: cuerpo.p_rol || 'admin', area: cuerpo.p_area,
      tel: cuerpo.p_tel, email: SESION + '@x.com', activo: true, pendiente: false });
    return respu(200, prod.id);
  }
  /* security definer: escribe el catálogo aunque el que llama esté pendiente */
  if (u.includes('/rpc/guardar_mis_datos')) {
    const mia = TB.usuario.find(x => x.auth_uid === SESION);
    if (!mia) return respu(400, { message: 'Todavía no completaste tu alta' });
    const c = cuerpo, pr = TB.productora.find(x => x.id === mia.productora_id) || {};
    if (c.p_nombre) mia.nombre = c.p_nombre;
    if (c.p_tel != null) mia.tel = c.p_tel;
    let cat = TB.catalogo_persona.find(x => x.id === mia.catalogo_id)
      || TB.catalogo_persona.find(x => mia.email && x.email === mia.email);
    if (!cat) { cat = { id: nid('catalogo_persona'), org_id: pr.org_id, tipo: 'persona' };
      TB.catalogo_persona.push(cat); }
    Object.assign(cat, { nombre: c.p_nombre || cat.nombre, funcion: c.p_funcion || cat.funcion,
      rubro: c.p_rubro || cat.rubro, tel: c.p_tel || cat.tel, email: cat.email || mia.email });
    mia.catalogo_id = cat.id;
    return respu(200, cat.id);
  }

  const m = u.match(/\/rest\/v1\/(\w+)/);
  if (!m) return respu(404, { msg: 'no such route' });
  const tabla = TB[m[1]];
  if (!tabla) return respu(404, { message: `relation "public.${m[1]}" does not exist` });

  if (met === 'POST') {
    const fila = { id: nid(m[1]), ...cuerpo };
    if (m[1] === 'usuario') {
      if (fila.auth_uid !== SESION) return respu(403, { message: 'row-level security policy' });
      const pr = TB.productora.find(x => x.id === fila.productora_id);
      const libre = ['equipo', 'produccion'].includes(fila.rol) && !(pr && pr.requiere_aprobacion);
      if (!fila.pendiente && !libre) return respu(403, { message: 'row-level security policy' });
    }
    if (m[1] === 'catalogo_persona') {          /* política catalogo_mio */
      if (!misOrgs().includes(cuerpo.org_id))
        return respu(403, { message: 'new row violates row-level security policy' });
      const ya = tabla.find(x => x.id === cuerpo.id);      /* upsert por id */
      if (ya) { Object.assign(ya, cuerpo); return respu(200, [ya]); }
      tabla.push(cuerpo); return respu(200, [cuerpo]);
    }
    tabla.push(fila);
    return respu(200, [fila]);
  }
  if (met === 'PATCH') {
    const eq = u.match(/[?&](\w+)=eq\.([^&]+)/);
    const obj = tabla.filter(f => String(f[eq[1]]) === decodeURIComponent(eq[2]));
    obj.forEach(f => Object.assign(f, cuerpo));
    return respu(200, obj);
  }
  if (met === 'DELETE') {
    const eq = u.match(/[?&](\w+)=eq\.([^&]+)/);
    const orgs = misOrgs();
    for (let i = tabla.length - 1; i >= 0; i--)
      if (String(tabla[i][eq[1]]) === decodeURIComponent(eq[2])
        && (m[1] !== 'catalogo_persona' || orgs.includes(tabla[i].org_id))) tabla.splice(i, 1);
    return respu(204);
  }

  let filas = tabla.slice();
  const mias = misProductoras(), orgs = misOrgs();
  if (m[1] === 'productora')       filas = filas.filter(f => mias.includes(f.id));
  if (m[1] === 'usuario')          filas = filas.filter(f => mias.includes(f.productora_id) || f.auth_uid === SESION);
  if (m[1] === 'catalogo_persona') filas = filas.filter(f => orgs.includes(f.org_id));
  [...u.matchAll(/[?&](\w+)=eq\.([^&]+)/g)].forEach(f => {
    filas = filas.filter(x => String(x[f[1]]) === decodeURIComponent(f[2]));
  });
  return respu(200, filas);
};

const conectar = async mail => { sbOlvidar(); SB.url = 'https://x.supabase.co'; SB.anon = 'anon';
  sbGuardar(); await sbLogin(mail, 'secreto123'); SB.orgId = null; };
const cargarForm = campos => { global.document.querySelectorAll = sel =>
  /\[name\]/.test(sel) ? Object.entries(campos).map(([name, value]) => ({ name, value })) : []; };
/* cada "navegador" arranca con su propia base local */
const navegadorNuevo = () => { DB = dbVacia(); sembrar(); _miFicha = null; _miProductora = null; };

(async () => {
  /* --- 1. Andrés crea la productora y queda en el catálogo --------------- */
  console.log('--- 1. EL QUE CREA LA PRODUCTORA QUEDA EN EL CATALOGO ---');
  navegadorNuevo();
  SESION = 'auth-andres'; await conectar('andres@x.com');
  cargarForm({ nombre: 'Andrés', tel: '11 1111-1111', productoraId: '__nueva',
    productoraNombre: 'Nuestra Productora', rol: 'admin', area: 'produccion' });
  await confirmarAlta();
  ok('quedó su ficha en el servidor', TB.usuario.length === 1, TB.usuario[0].nombre);
  ok('Y QUEDO EN EL CATALOGO DEL SERVIDOR', TB.catalogo_persona.length === 1,
    TB.catalogo_persona.length + ' filas');
  ok('con su nombre', TB.catalogo_persona[0] && TB.catalogo_persona[0].nombre === 'Andrés',
    TB.catalogo_persona[0] && TB.catalogo_persona[0].nombre);
  ok('y su usuario quedó enlazado', !!TB.usuario[0].catalogo_id);

  /* --- 2. Andrés carga un técnico y sube solo ---------------------------
     Nombre a propósito raro: la semilla del ejemplo ya trae gente, y si uso
     uno de esos nombres la prueba se aprueba sola sin haber sincronizado
     nada. Me pasó y por eso está anotado.                                  */
  console.log('\n--- 2. LO QUE CARGA A MANO TAMBIEN SUBE ---');
  const TEC = 'Ramiro Quiroga Ithurbide';
  cargarForm({ nombre: TEC, funcion: 'Gaffer', rubro: '05', tipo: 'persona',
    tarifaRef: '280000', moneda: 'ARS', unidad: 'jornada', tel: '11 3333-3333',
    email: 'ramiro@x.com', dni: '30111222', cuit: '', condicion: 'Monotributista',
    banco: '', alias: '', fechaNac: '' });
  savePersona();
  await new Promise(r => setTimeout(r, 30));
  const enServidor = TB.catalogo_persona.find(x => x.nombre === TEC);
  ok('el técnico llegó al servidor', !!enServidor, enServidor && enServidor.funcion);
  ok('con su tarifa', enServidor && Number(enServidor.tarifa_ref) === 280000,
    enServidor && String(enServidor.tarifa_ref));
  ok('y con el mismo id que acá',
    !!DB.catalogo.personas.find(p => p.id === (enServidor || {}).id));

  /* --- 3. Willy entra en otra máquina y pide ser administrador ---------- */
  console.log('\n--- 3. WILLY ENTRA EN OTRA MAQUINA ---');
  navegadorNuevo();                       /* otra computadora, base local limpia */
  SESION = 'auth-willy'; await conectar('santyno@gmail.com');
  ok('su navegador arranca sin el técnico de Andrés',
    !DB.catalogo.personas.some(p => p.nombre === TEC));
  _prodsElegibles = await sbProductorasParaElegir();
  ok('ve la productora de Andrés en la lista', _prodsElegibles.length === 1,
    _prodsElegibles[0] && _prodsElegibles[0].nombre);
  cargarForm({ nombre: 'Willy De Rose', tel: '11 4444-2222',
    productoraId: TB.productora[0].id, productoraNombre: '', rol: 'admin', area: 'produccion' });
  await confirmarAlta();

  const wServ = TB.catalogo_persona.find(x => x.nombre === 'Willy De Rose');
  ok('WILLY QUEDO EN EL CATALOGO DEL SERVIDOR', !!wServ, wServ && wServ.email);
  ok('y en el catálogo de su navegador',
    !!DB.catalogo.personas.find(p => norm(p.email) === 'santyno@gmail.com'));
  ok('pero pidió admin, así que espera aprobación', (await sbMiFicha()).pendiente === true);
  ok('y mientras espera NO ve el catálogo del equipo',
    !DB.catalogo.personas.some(p => p.nombre === TEC));
  DB.ui.tab = 'catalogo'; render();
  ok('la pantalla le explica por qué',
    /Hasta que un administrador apruebe tu alta/.test(app.innerHTML));

  /* --- 4. Lo aprueban y ahí sí ve todo --------------------------------- */
  console.log('\n--- 4. LO APRUEBAN Y VE EL CATALOGO DEL EQUIPO ---');
  TB.usuario.find(x => x.auth_uid === 'auth-willy').pendiente = false;
  await revisarAlta();
  ok('ahora VE al técnico que cargó Andrés',
    !!DB.catalogo.personas.find(p => p.nombre === TEC));
  const dl = DB.catalogo.personas.find(p => p.nombre === TEC);
  ok('con la tarifa que le puso Andrés', dl && n(dl.tarifaRef) === 280000, dl && String(dl.tarifaRef));
  ok('y la función', dl && dl.funcion === 'Gaffer', dl && dl.funcion);
  ok('y VE A ANDRES', !!DB.catalogo.personas.find(p => p.nombre === 'Andrés'));

  /* --- 5. Andrés ve a Willy ------------------------------------------- */
  console.log('\n--- 5. Y ANDRES VE A WILLY ---');
  navegadorNuevo();
  SESION = 'auth-andres'; await conectar('andres@x.com');
  await revisarAlta();
  const wLocal = DB.catalogo.personas.find(p => norm(p.email) === 'santyno@gmail.com');
  ok('WILLY APARECE EN EL CATALOGO DE ANDRES', !!wLocal, wLocal && wLocal.nombre);
  ok('con su nombre', wLocal && wLocal.nombre === 'Willy De Rose', wLocal && wLocal.nombre);
  ok('y su teléfono', wLocal && wLocal.tel === '11 4444-2222', wLocal && wLocal.tel);
  ok('sin duplicarse',
    DB.catalogo.personas.filter(p => norm(p.email) === 'santyno@gmail.com').length === 1);
  ok('y sin duplicar al técnico',
    DB.catalogo.personas.filter(p => p.nombre === TEC).length === 1);

  /* --- 6. entrar dos veces no duplica nada ----------------------------- */
  console.log('\n--- 6. ENTRAR DE NUEVO NO DUPLICA ---');
  const antes = DB.catalogo.personas.length;
  await revisarAlta(); await revisarAlta();
  ok('el catálogo no crece solo', DB.catalogo.personas.length === antes,
    antes + ' -> ' + DB.catalogo.personas.length);

  /* --- 7. sin sesión, se avisa que es local ---------------------------- */
  console.log('\n--- 7. SIN SESION, SE AVISA ---');
  SB.access = null; SB.user = null;
  DB.ui.tab = 'catalogo'; render();
  ok('dice que el catálogo es sólo de esta computadora',
    /vive sólo en esta computadora/.test(app.innerHTML));
  ok('y no ofrece el botón de sincronizar', !/Sincronizar/.test(app.innerHTML));

  console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
  process.exitCode = fallos ? 1 : 0;
})();
