/* Quién soy yo cuando entro con mi mail.
   ---------------------------------------------------------------------------
   El caso que rompió: Willy entra con su mail, pide entrar como Productor
   Ejecutivo y queda esperando aprobación. El header le muestra el nombre de
   OTRA persona (una del equipo de ejemplo) y no aparece en el catálogo.

   Lo que lo destapa es que este Supabase de mentira respeta las políticas de
   lectura de verdad: `productora_mia` pasa por `mis_productoras()`, que exige
   `activo AND NOT pendiente`. O sea: mientras espero aprobación NO puedo leer
   la fila de mi productora, pero SÍ mi propia ficha (`usuario_ver_mia`).
   El doble anterior devolvía todo y por eso nunca se vio.                    */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

const TB = { organizacion: [], productora: [], usuario: [], catalogo_persona: [], proyecto: [], proyecto_persona: [] };
let SEQ = 0, SESION = 'auth-andres';
const nid = pre => `${pre}-${++SEQ}`;
const respu = (status, body) => ({
  ok: status >= 200 && status < 300, status, statusText: 'x',
  text: async () => body === undefined ? '' : JSON.stringify(body)
});

/* productoras_con_acceso(): la de verdad, copiada de backend/permisos.sql */
const misProductoras = () => TB.usuario
  .filter(u => u.auth_uid === SESION && u.activo && !u.pendiente)
  .filter(u => ['admin', 'ejecutivo'].includes(u.rol)
    || TB.proyecto_persona.some(pp => pp.usuario_id === u.id
      && TB.proyecto.some(pr => pr.id === pp.proyecto_id && pr.productora_id === u.productora_id)))
  .map(u => u.productora_id);

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
      nombre: cuerpo.p_mi_nombre || 'Yo', rol: cuerpo.p_rol || 'admin',
      area: cuerpo.p_area, tel: cuerpo.p_tel, email: 'admin@x.com', activo: true, pendiente: false });
    return respu(200, prod.id);
  }

  const m = u.match(/\/rest\/v1\/(\w+)/);
  if (!m) return respu(404, { msg: 'no such route' });
  const tabla = TB[m[1]];
  if (!tabla) return respu(404, { message: `relation "public.${m[1]}" does not exist` });

  if (met === 'POST') {
    const fila = { id: nid(m[1]), ...cuerpo };
    if (m[1] === 'usuario') {
      if (fila.auth_uid !== SESION)
        return respu(403, { message: 'new row violates row-level security policy' });
      const pr = TB.productora.find(x => x.id === fila.productora_id);
      const libre = ['equipo', 'produccion'].includes(fila.rol) && !(pr && pr.requiere_aprobacion);
      if (!fila.pendiente && !libre)
        return respu(403, { message: 'new row violates row-level security policy' });
    }
    tabla.push(fila);
    return respu(200, [fila]);
  }
  if (met === 'PATCH') {
    const eq = u.match(/[?&](\w+)=eq\.([^&]+)/);
    const objetivo = tabla.filter(f => String(f[eq[1]]) === decodeURIComponent(eq[2]));
    objetivo.forEach(f => Object.assign(f, cuerpo));
    return respu(200, objetivo);
  }

  /* ---- SELECT con las políticas puestas ---- */
  let filas = tabla.slice();
  const mias = misProductoras();
  if (m[1] === 'productora')                                    /* productora_mia */
    filas = filas.filter(f => mias.includes(f.id));
  if (m[1] === 'usuario')                    /* usuario_ver  OR  usuario_ver_mia  */
    filas = filas.filter(f => mias.includes(f.productora_id) || f.auth_uid === SESION);
  if (m[1] === 'catalogo_persona') {                             /* catalogo_mio */
    const orgs = TB.productora.filter(p => mias.includes(p.id)).map(p => p.org_id);
    filas = filas.filter(f => orgs.includes(f.org_id));
  }
  [...u.matchAll(/[?&](\w+)=eq\.([^&]+)/g)].forEach(f => {
    filas = filas.filter(x => String(x[f[1]]) === decodeURIComponent(f[2]));
  });
  return respu(200, filas);
};

const conectar = async (mail) => { sbOlvidar(); SB.url = 'https://x.supabase.co'; SB.anon = 'anon';
  sbGuardar(); await sbLogin(mail, 'secreto123'); };
const cargarForm = campos => {
  global.document.querySelectorAll = selector => /\[name\]/.test(selector)
    ? Object.entries(campos).map(([name, value]) => ({ name, value })) : [];
};

(async () => {
  /* --- 1. alguien crea la productora, para que haya a qué sumarse -------- */
  console.log('--- 1. LA PRODUCTORA YA EXISTE ---');
  SESION = 'auth-andres';
  await conectar('andres@x.com');
  cargarForm({ nombre: 'Andrés', tel: '', productoraId: '__nueva',
    productoraNombre: 'Nuestra Productora', rol: 'admin', area: 'produccion' });
  await confirmarAlta();
  ok('la productora quedó creada', TB.productora.length === 1, TB.productora[0].nombre);

  /* --- 2. Willy entra y pide ser Productor Ejecutivo --------------------- */
  console.log('\n--- 2. WILLY PIDE ENTRAR COMO PRODUCTOR EJECUTIVO ---');
  SESION = 'auth-willy';
  await conectar('santyno@gmail.com');
  _miFicha = null; _miProductora = null;
  _prodsElegibles = await sbProductorasParaElegir();
  cargarForm({ nombre: 'Willy De Rose', tel: '11 4444-2222',
    productoraId: TB.productora[0].id, productoraNombre: '', rol: 'ejecutivo', area: 'produccion' });
  await confirmarAlta();

  const w = await sbMiFicha();
  ok('su ficha existe en el servidor', !!w, w && w.nombre);
  ok('con SU nombre', w.nombre === 'Willy De Rose', w.nombre);
  ok('y queda esperando aprobación', w.pendiente === true);
  ok('no puede leer la productora todavía',
    (await sbFetch(`/rest/v1/productora?select=id,nombre&id=eq.${w.productora_id}`)).length === 0);

  /* --- 3. ACÁ ESTABA EL BUG: quién dice la pantalla que soy -------------- */
  console.log('\n--- 3. LA PANTALLA TIENE QUE DECIR QUE SOY YO ---');
  const mio = getUsuarios().find(x => x.authUid === 'auth-willy');
  ok('quedé en el equipo de este navegador', !!mio, mio && mio.nombre);
  ok('con mi nombre', mio && mio.nombre === 'Willy De Rose', mio && mio.nombre);
  ok('con el rol que pedí', mio && mio.rol === 'ejecutivo', mio && mio.rol);
  ok('marcado como pendiente', mio && mio.pendiente === true);

  const yo = getUsuario();
  ok('getUsuario() me devuelve a MÍ', yo && yo.authUid === 'auth-willy', yo && yo.nombre);
  ok('y NO a alguien del equipo de ejemplo', !yo || yo.nombre === 'Willy De Rose', yo && yo.nombre);

  render();
  const pantalla = app.innerHTML;
  ok('mi nombre está en la pantalla', pantalla.includes('Willy De Rose'));
  ok('no figura el nombre de otro como si fuera yo',
    !/Soy[\s\S]{0,400}?Sofía Roldán/.test(pantalla));
  ok('sigue avisando que espera aprobación', /esperando aprobación/.test(pantalla));

  /* --- 4. y tengo que estar en el catálogo ------------------------------- */
  console.log('\n--- 4. Y TENGO QUE ESTAR EN EL CATALOGO ---');
  const enCat = DB.catalogo.personas.find(p => norm(p.email) === 'santyno@gmail.com');
  ok('estoy en el catálogo', !!enCat, enCat && enCat.nombre);
  ok('con mi nombre', enCat && enCat.nombre === 'Willy De Rose', enCat && enCat.nombre);
  ok('y mi teléfono', enCat && enCat.tel === '11 4444-2222', enCat && enCat.tel);
  ok('el usuario quedó enlazado a esa ficha', mio && mio.personaId === (enCat && enCat.id));

  /* --- 5. pendiente no significa con permisos ---------------------------- */
  console.log('\n--- 5. PENDIENTE NO DA PERMISOS ---');
  ok('no puede aprobar mientras espera', !puede(yo, 'aprobar'));
  ok('ni pagar', !puede(yo, 'pagar'));
  ok('ni cargar', !puede(yo, 'cargar'));

  /* --- 6. cuando lo aprueban, entra ------------------------------------- */
  console.log('\n--- 6. CUANDO LO APRUEBAN ---');
  TB.usuario.find(x => x.auth_uid === 'auth-willy').pendiente = false;
  await revisarAlta();
  const yo2 = getUsuario();
  ok('sigo siendo yo', yo2 && yo2.authUid === 'auth-willy', yo2 && yo2.nombre);
  ok('ya no estoy pendiente', yo2 && !yo2.pendiente);
  ok('ahora sí puede aprobar', puede(yo2, 'aprobar'));
  ok('la productora aparece con su nombre real',
    getPr() && getPr().nombre === 'Nuestra Productora', getPr() && getPr().nombre);
  render();
  ok('el aviso de aprobación se apagó', !/esperando aprobación/.test(app.innerHTML));

  /* --- 7. relogin: no se duplica ni se pierde ---------------------------- */
  console.log('\n--- 7. VOLVER A ENTRAR ---');
  await conectar('santyno@gmail.com');
  _miFicha = null; _miProductora = null;
  await revisarAlta();
  ok('no me duplicó en el equipo',
    getUsuarios().filter(x => x.authUid === 'auth-willy').length === 1);
  ok('ni en el catálogo',
    DB.catalogo.personas.filter(p => norm(p.email) === 'santyno@gmail.com').length === 1);
  ok('y sigo siendo yo', getUsuario() && getUsuario().nombre === 'Willy De Rose');

  /* --- 8. EL CASO REAL: navegador nuevo, entrando mientras espera ---------
     Willy abrió la app en su máquina. Ese navegador nunca lo vio: sólo tiene
     la Productora Demo del ejemplo. Se loguea y su alta está pendiente, así
     que la base no le deja leer su productora. Antes de arreglarlo, acá el
     header se quedaba con la Demo y mostraba a Sofía Roldán.                */
  console.log('\n--- 8. NAVEGADOR NUEVO, ALTA PENDIENTE ---');
  TB.usuario.find(x => x.auth_uid === 'auth-willy').pendiente = true;
  DB = dbVacia(); sembrar();                       /* navegador recién abierto */
  ok('arranca con la Demo y su gente de ejemplo',
    getPr().nombre === 'Productora Demo' && getUsuarios().some(x => x.nombre === 'Sofía Roldán'));

  SESION = 'auth-willy';
  await conectar('santyno@gmail.com');
  _miFicha = null; _miProductora = null;
  await revisarAlta();

  const yo3 = getUsuario();
  ok('me reconoce por mi mail', yo3 && yo3.authUid === 'auth-willy', yo3 && yo3.nombre);
  ok('NO me confunde con la del ejemplo', yo3 && yo3.nombre === 'Willy De Rose', yo3 && yo3.nombre);
  ok('me llevó a MI productora, no a la Demo',
    getPr() && getPr().id === TB.productora[0].id, getPr() && getPr().nombre);
  ok('y estoy en el catálogo de este navegador',
    !!DB.catalogo.personas.find(p => norm(p.email) === 'santyno@gmail.com'));

  render();
  const p8 = app.innerHTML;
  ok('la pantalla dice mi nombre', p8.includes('Willy De Rose'));
  ok('y no el de Sofía Roldán como si fuera yo', !/Soy[\s\S]{0,400}?Sofía Roldán/.test(p8));
  ok('avisa que espera aprobación', /esperando aprobación/.test(p8));
  ok('dice el rol que pedí', /Productor Ejecutivo/.test(p8));

  /* --- 9. sin ficha local no se suplanta a nadie -------------------------- */
  console.log('\n--- 9. SIN FICHA NO SOY OTRO ---');
  DB = dbVacia(); sembrar();       /* logueado, pero todavía sin espejar nada */
  ok('el equipo de ejemplo está', getUsuarios().length > 0);
  ok('pero getUsuario() no me da a un desconocido', getUsuario() === null,
    getUsuario() && getUsuario().nombre);
  ok('y sin usuario no hay permisos', !puede(getUsuario(), 'cargar'));

  /* --- 10. si no puedo traer la lista, decirlo ---------------------------
     "La lista vino vacía" y "no pude traerla" son dos cosas distintas.
     Confundirlas manda a la persona a crear una productora que ya existe, y
     el equipo termina partido en dos que no se hablan.                     */
  console.log('\n--- 10. SI FALLA LA LISTA, NO DECIR QUE NO HAY NINGUNA ---');
  const fetchBueno = global.fetch;
  global.fetch = async (url, opts) => String(url).includes('productoras_para_elegir')
    ? respu(500, { message: 'se cayó la conexión' })
    : fetchBueno(url, opts);
  SESION = 'auth-nuevo';
  await conectar('nuevo@x.com');
  modal = null; await abrirAlta();
  ok('avisa que no pudo traer la lista', /No pude traer la lista/.test(modal));
  ok('NO dice que no hay ninguna productora', !/Todav[ií]a no hay ninguna productora/.test(modal));
  ok('avisa del riesgo de duplicar', /partido|separadas|no crees una nueva/i.test(modal));
  ok('ofrece reintentar', /Reintentar/.test(modal));

  global.fetch = fetchBueno;
  modal = null; await abrirAlta();
  ok('al reintentar aparece la productora', /Nuestra Productora/.test(modal));
  ok('y ya no muestra el error', !/No pude traer la lista/.test(modal));

  console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
  process.exitCode = fallos ? 1 : 0;
})();
