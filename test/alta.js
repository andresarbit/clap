/* Primera vez: una cuenta sola no ve nada. O te invitan (eso se prueba en
   invitar-link.js) o creás tu propia productora, que nace vacía. Nadie se
   anota solo en una productora ajena y nadie aprueba a mano
   (backend/privado.sql).
   Se prueba contra un Supabase de mentira que respeta las mismas reglas que
   las políticas de la base. */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

/* --- Supabase de mentira, con tablas de verdad --------------------------- */
const TB = { organizacion: [], productora: [], usuario: [], catalogo_persona: [] };
let SEQ = 0, SESION = 'auth-andres';
const nid = pre => `${pre}-${++SEQ}`;
const respu = (status, body) => ({
  ok: status >= 200 && status < 300, status, statusText: 'x',
  text: async () => body === undefined ? '' : JSON.stringify(body)
});

global.fetch = async (url, opts = {}) => {
  const u = String(url), met = opts.method || 'GET';
  const cuerpo = opts.body ? JSON.parse(opts.body) : null;

  if (u.includes('/auth/v1/settings')) return respu(200, { external: {} });
  if (u.includes('grant_type=password'))
    return respu(200, { access_token: 'tok', refresh_token: 'ref', expires_in: 3600,
      user: { id: SESION, email: cuerpo.email } });
  if (u.includes('/auth/v1/logout')) return respu(204);

  /* --- las funciones ---------------------------------------------------- */
  /* privado.sql: sólo las mías */
  if (u.includes('/rpc/productoras_para_elegir'))
    return respu(200, TB.productora.filter(p => TB.usuario.some(x => x.productora_id === p.id && x.auth_uid === SESION))
      .map(p => ({ id: p.id, nombre: p.nombre })));
  if (u.includes('/rpc/productora_pide_aprobacion')) {
    const pr = TB.productora.find(x => x.id === cuerpo.p);
    return respu(200, !!(pr && pr.requiere_aprobacion));
  }
  /* El arranque lo hace la base de una sola vez, con permisos de dueño: crea
     la organizacion si hace falta, la productora, y da de alta al que la pidio
     como admin. Es lo que evita el 403 al no poder releer lo recien creado. */
  if (u.includes('/rpc/crear_mi_productora')) {
    if (!SESION) return respu(401, { message: 'Hay que iniciar sesion' });
    if (!String(cuerpo.p_nombre || '').trim())
      return respu(400, { message: 'La productora necesita un nombre' });
    /* reusa una organización sólo si ya la administra */
    let org = TB.organizacion.find(o => TB.productora.some(p =>
      p.org_id === o.id && TB.usuario.some(x => x.productora_id === p.id && x.auth_uid === SESION && x.rol === 'admin')));
    if (!org) { org = { id: nid('organizacion'), nombre: cuerpo.p_mi_nombre || 'Mi estudio' };
      TB.organizacion.push(org); }
    const prod = { id: nid('productora'), org_id: org.id, nombre: String(cuerpo.p_nombre).trim(),
      requiere_aprobacion: false };
    TB.productora.push(prod);
    TB.usuario.push({ id: nid('usuario'), auth_uid: SESION, productora_id: prod.id,
      nombre: cuerpo.p_mi_nombre || 'Yo', rol: 'admin',
      area: cuerpo.p_area, tel: cuerpo.p_tel, email: 'a@b.com', activo: true, pendiente: false });
    return respu(200, prod.id);
  }

  /* Actualiza mi ficha de usuario Y la del catalogo, y las enlaza. Del lado de
     la base porque alguien recien sumado todavia no puede escribir en el
     catalogo de la organizacion. */
  if (u.includes('/rpc/guardar_mis_datos')) {
    const mia = TB.usuario.find(x => x.auth_uid === SESION);
    if (!mia) return respu(400, { message: 'Todavía no completaste tu alta' });
    const c = cuerpo;
    if (c.p_nombre) mia.nombre = c.p_nombre;
    if (c.p_tel != null) mia.tel = c.p_tel;
    if (c.p_area != null) mia.area = c.p_area;
    /* el rol NO se toca desde acá: lo da la invitación o un administrador */
    const pr = TB.productora.find(x => x.id === mia.productora_id) || {};
    let cat = TB.catalogo_persona.find(x => x.id === mia.catalogo_id)
      || TB.catalogo_persona.find(x => mia.email && x.email === mia.email);
    if (!cat) { cat = { id: nid('catalogo_persona'), org_id: pr.org_id, tipo: 'persona' };
      TB.catalogo_persona.push(cat); }
    Object.assign(cat, {
      nombre: c.p_nombre || cat.nombre, funcion: c.p_funcion || cat.funcion,
      rubro: c.p_rubro || cat.rubro, dni: c.p_dni || cat.dni, cuit: c.p_cuit || cat.cuit,
      condicion: c.p_condicion || cat.condicion, tel: c.p_tel || cat.tel,
      email: cat.email || mia.email, banco: c.p_banco || cat.banco,
      alias: c.p_alias || cat.alias });
    mia.catalogo_id = cat.id;
    return respu(200, cat.id);
  }

  const m = u.match(/\/rest\/v1\/(\w+)/);
  if (!m) return respu(404, { msg: 'no such route' });
  const tabla = TB[m[1]];
  if (!tabla) return respu(404, { message: `relation "public.${m[1]}" does not exist` });

  if (met === 'POST') {
    const fila = { id: nid(m[1]), ...cuerpo };
    /* privado.sql: no hay política de alta propia. Una ficha nace de una
       invitación o de crear la productora propia, que no pasan por acá. */
    if (m[1] === 'usuario')
      return respu(403, { message: 'new row violates row-level security policy' });
    tabla.push(fila);
    return respu(200, [fila]);
  }
  if (met === 'PATCH') {
    const eq = u.match(/[?&](\w+)=eq\.([^&]+)/);
    const objetivo = tabla.filter(f => String(f[eq[1]]) === decodeURIComponent(eq[2]));
    objetivo.forEach(f => Object.assign(f, cuerpo));
    return respu(200, objetivo);
  }
  let filas = tabla.slice();
  [...u.matchAll(/[?&](\w+)=eq\.([^&]+)/g)].forEach(f => {
    filas = filas.filter(x => String(x[f[1]]) === decodeURIComponent(f[2]));
  });
  return respu(200, filas);
};

const conectar = async (mail = 'a@b.com') => {
  sbOlvidar(); SB.url = 'https://x.supabase.co'; SB.anon = 'anon'; sbGuardar();
  await sbLogin(mail, 'secreto123');
};
/* lo que devolvería el formulario si alguien lo llenara */
const cargarForm = campos => {
  global.document.querySelectorAll = selector =>
    /\[name\]/.test(selector)
      ? Object.entries(campos).map(([name, value]) => ({ name, value }))
      : [];
};

(async () => {
  /* --- 1. el primero de todos ------------------------------------------- */
  console.log('--- 1. EL PRIMERO CREA SU PRODUCTORA ---');
  await conectar();
  ok('todavía no tiene ficha', (await sbMiFicha()) === null);
  ok('no hay productoras para elegir', (await sbProductorasParaElegir()).length === 0);

  modal = null; formAlta();
  ok('pide el nombre de la productora y el suyo',
    /name="nombre"/.test(modal) && /name="productoraNombre"/.test(modal));
  ok('no pregunta el rol: quien la crea es Administración',
    !/name="rol"/.test(modal) && /quedás como su <b>Administración<\/b>/.test(modal));
  ok('avisa que no la cree si trabaja para otra', /pediles que te inviten/.test(modal));
  ok('deja elegir área', /name="area"/.test(modal) && modal.includes(areaLbl('arte')));

  cargarForm({ nombre: 'Andrés', tel: '11 5555-1234',
    productoraNombre: 'Plata o Mierda', area: 'produccion' });
  await confirmarAlta();

  ok('creó la organización', TB.organizacion.length === 1, TB.organizacion.length + '');
  ok('creó la productora', TB.productora.length === 1 && TB.productora[0].nombre === 'Plata o Mierda');
  ok('el candado arranca abierto', !TB.productora[0].requiere_aprobacion);
  const yo = await sbMiFicha();
  ok('quedó dado de alta', !!yo);
  ok('con su nombre, no con el mail', yo && yo.nombre === 'Andrés', yo && yo.nombre);
  ok('como administrador', yo.rol === 'admin', yo.rol);
  ok('activo, sin esperar a nadie', yo.activo && !yo.pendiente);
  ok('guardó área y teléfono', yo.area === 'produccion' && yo.tel === '11 5555-1234',
    yo.area + ' · ' + yo.tel);
  ok('no quedaron dos fichas', TB.usuario.length === 1, TB.usuario.length + ' fichas');

  /* --- 2. el espejo local ----------------------------------------------- */
  console.log('\n--- 2. SE ESPEJA AL EQUIPO LOCAL ---');
  const uLoc = getPr().usuarios.find(x => x.authUid === 'auth-andres');
  ok('aparece en el equipo de este navegador', !!uLoc);
  ok('con el mismo rol', uLoc && uLoc.rol === 'admin');
  ok('y el área traducida', uLoc && uLoc.depto === areaLbl('produccion'), uLoc && uLoc.depto);
  ok('queda seleccionado como "soy yo"', DB.ui.usuarioId === uLoc.id);
  ok('y con eso puede pagar', puede(uLoc, 'pagar'));
  espejarFichaLocal(yo); espejarFichaLocal(yo);
  ok('repetirlo no lo duplica',
    getPr().usuarios.filter(x => x.authUid === 'auth-andres').length === 1);

  /* --- 3. el segundo NO se puede sumar solo -------------------------------- */
  console.log('\n--- 3. SIN INVITACION NO SE ENTRA A UNA AJENA ---');
  SESION = 'auth-lucia';
  await conectar('lucia@x.com');
  ok('la lista para elegir NO trae la productora de Andrés', (await sbProductorasParaElegir()).length === 0);
  _miFicha = null; await revisarAlta();
  ok('queda sin ninguna productora', _miFicha === false);
  ok('no se le abre ningún formulario solo', modal === null);
  render();
  ok('el menú de arriba no ofrece sumarse a nada', !/sumar:/.test(app.innerHTML));
  const atajo = await sbFetch('/rest/v1/usuario', { method: 'POST',
    body: JSON.stringify({ auth_uid: SESION, productora_id: TB.productora[0].id,
      nombre: 'Lucía', rol: 'equipo', activo: true, pendiente: true }) })
    .then(() => 'pasó').catch(e => e.message);
  ok('la base rechaza anotarse a mano (ni como equipo, ni esperando)', /no te deja/.test(atajo), atajo);
  ok('sumarmeAProductora no la mete', (await sumarmeAProductora(TB.productora[0].id, {avisar:false})) === false
    && !TB.usuario.some(x => x.auth_uid === 'auth-lucia'));
  const suplanta = await sbFetch('/rest/v1/usuario', { method: 'POST',
    body: JSON.stringify({ auth_uid: 'auth-andres', productora_id: TB.productora[0].id,
      nombre: 'Yo Soy Andrés', rol: 'admin', pendiente: true }) })
    .then(() => 'pasó').catch(e => e.message);
  ok('ni darse de alta por otro', /no te deja/.test(suplanta), suplanta);

  /* --- 4. con la puerta: la pantalla de sin acceso ------------------------ */
  console.log('\n--- 4. LA PANTALLA DE SIN ACCESO ---');
  PUERTA = true; render();
  ok('en la web no ve la app: ve la pantalla de sin acceso', /Todavía no estás en ninguna productora/.test(app.innerHTML)
    && !/class="tabs"/.test(app.innerHTML));
  ok('le explica que lo inviten', /✉ Invitar/.test(app.innerHTML));
  ok('y le ofrece crear la suya', /Crear mi productora/.test(app.innerHTML));
  ok('y cerrar sesión', /sbCerrarSesion\(\)/.test(app.innerHTML));
  /* crea la suya: nace en una organización nueva, no en la de Andrés */
  cargarForm({ nombre: 'Lucía Ferrer', tel: '', productoraNombre: 'Lucía Films', area: 'produccion' });
  await confirmarAlta();
  const luci = await sbMiFicha();
  ok('creó la suya y es su Administración', !!luci && luci.rol === 'admin' && !luci.pendiente);
  const prLuci = TB.productora.find(p => p.nombre === 'Lucía Films');
  ok('en otra organización', prLuci && prLuci.org_id !== TB.productora[0].org_id);
  render();
  ok('y ahora ve la app', /class="tabs"/.test(app.innerHTML) && /Lucía Films/.test(app.innerHTML));
  PUERTA = false;

  /* --- 6. volver a entrar ------------------------------------------------ */
  console.log('\n--- 6. VOLVER A ENTRAR ---');
  SESION = 'auth-andres';
  await conectar();
  modal = null;
  await pantallaAlta();
  ok('al que ya está no le vuelve a preguntar', modal === null, String(modal).slice(0, 40));
  ok('sigue siendo el mismo', (await sbMiFicha()).nombre === 'Andrés');

  /* --- 6b. no quedarse en el pozo del alta a medias ---------------------- */
  console.log('\n--- 6b. CUENTA CREADA PERO ALTA SIN TERMINAR ---');
  /* Le pasó a Andrés: la cuenta quedó hecha, la productora no, y la pantalla
     del alta salía una sola vez. Al recargar no volvía nunca. */
  SESION = 'auth-colgado';
  await conectar('colgado@x.com');
  _miFicha = null;
  await revisarAlta();
  ok('al abrir detecta que no está en ninguna', _miFicha === false);
  const barra = avisoAlta();
  ok('deja un aviso fijo en el header', /Todavía no estás en ninguna productora/.test(barra));
  ok('con un botón para crear la suya', /Crear mi productora/.test(barra));
  ok('y le dice que lo inviten', /inviten/.test(barra));
  /* el que ya está no ve ningún aviso */
  SESION = 'auth-andres';
  await conectar();
  _miFicha = null; await revisarAlta();
  ok('al que ya completó no le muestra nada', avisoAlta() === '', avisoAlta().slice(0, 40));
  ok('y no le vuelve a abrir el formulario', modal === null);

  console.log('\n--- 6c. CORREGIR MIS DATOS DESPUES ---');
  /* con await: ahora el alta deja `catalogo_id` puesto, así que editarMiFicha
     va de verdad al servidor a buscar la ficha del catálogo antes de dibujar. */
  modal = null; await editarMiFicha();
  ok('la pantalla de mis datos abre', /Mis datos/.test(modal || ''));
  ok('trae mi nombre cargado', new RegExp('value="' + _miFicha.nombre + '"').test(modal));
  ok('muestra el rol pero no deja cambiarlo', !/name="rol"/.test(modal) && /Administración/.test(modal) && /Quién entra/.test(modal));
  ok('y el área', /name="area"/.test(modal));
  cargarForm({ nombre: 'Andrés Arbit', tel: '11 6112-1250', rol: 'admin', area: 'produccion' });
  await guardarMiFicha();
  const corregida = await sbMiFicha();
  ok('guardó el nombre nuevo', corregida.nombre === 'Andrés Arbit', corregida.nombre);
  ok('y el teléfono', corregida.tel === '11 6112-1250');
  ok('sin duplicar la ficha', TB.usuario.filter(u => u.auth_uid === 'auth-andres').length === 1);

  /* --- 6e. mi productora aparece en el menu ------------------------------ */
  console.log('\n--- 6e. MI PRODUCTORA, EN EL MENU DE ARRIBA ---');
  /* Le pasó a Andrés: creó Neto Films, pero el menú seguía mostrando sólo la
     Productora Demo del ejemplo. El alta lo sumaba a la que estuviera
     seleccionada en vez de traer la suya. */
  SESION = 'auth-andres';
  await conectar();
  _miFicha = null; _miProductora = null;
  await revisarAlta();
  const miPr = DB.productoras.find(p => p.id === _miFicha.productora_id);
  ok('la productora del servidor está en este navegador', !!miPr);
  ok('con su nombre de verdad', miPr && miPr.nombre === 'Plata o Mierda', miPr && miPr.nombre);
  ok('y con el MISMO id que en el servidor', miPr && miPr.id === _miFicha.productora_id);
  ok('queda seleccionada', DB.ui.productoraId === miPr.id);
  ok('aparece en el menú de arriba', new RegExp(miPr.nombre).test(header(getPr(), getPy(), getV())));
  ok('la Demo sigue estando, no se borró nada',
    DB.productoras.some(p => p.nombre === 'Productora Demo'));
  ok('estoy en el equipo de la mía, no en la Demo',
    miPr.usuarios.some(u => u.authUid === 'auth-andres'));
  /* repetirlo no crea otra */
  await revisarAlta();
  ok('revisar de nuevo no duplica la productora',
    DB.productoras.filter(p => p.id === _miFicha.productora_id).length === 1);

  /* --- 6d. quien entra queda en el catalogo ------------------------------ */
  console.log('\n--- 6d. QUIEN ENTRA QUEDA EN EL CATALOGO ---');
  const enCat = n => DB.catalogo.personas.find(p => p.nombre === n);
  ok('el que se dio de alta ya está en el catálogo', !!enCat('Andrés Arbit'),
    DB.catalogo.personas.map(p => p.nombre).join(', '));
  ok('con su mail', (enCat('Andrés Arbit') || {}).email === 'a@b.com');
  ok('y su teléfono', (enCat('Andrés Arbit') || {}).tel === '11 6112-1250');
  ok('sin duplicarse al repetir', (espejarFichaLocal(_miFicha),
    DB.catalogo.personas.filter(p => norm(p.email) === 'a@b.com').length === 1));

  /* los datos de pago no se piden en el alta: van en Mis datos */
  modal = null; formAlta();
  ok('el alta NO pide CUIT', !/name="cuit"/.test(modal));
  ok('ni datos bancarios', !/name="alias"/.test(modal) && !/name="banco"/.test(modal));
  ok('el alta pide sólo lo indispensable',
    /name="nombre"/.test(modal) && /name="productoraNombre"/.test(modal) && /name="area"/.test(modal));
  cerrar();

  modal = null; await editarMiFicha();
  ok('Mis datos sí pide CUIT', /name="cuit"/.test(modal || ''));
  ok('y alias o CBU', /name="alias"/.test(modal));
  ok('y condición frente a AFIP', /name="condicion"/.test(modal) && /Monotributista/.test(modal));
  ok('explica para qué sirve', /orden de pago/i.test(modal));

  cargarForm({ nombre: 'Andrés Arbit', tel: '11 6112-1250', rol: 'admin', area: 'produccion',
    funcion: 'Productor Ejecutivo', condicion: 'Responsable Inscripto',
    cuit: '20-12345678-9', dni: '12345678', banco: 'Galicia', alias: 'andres.clap' });
  await guardarMiFicha();
  const yoCat = enCat('Andrés Arbit');
  ok('el CUIT llegó al catálogo', yoCat.cuit === '20-12345678-9', yoCat.cuit);
  ok('el alias también', yoCat.alias === 'andres.clap');
  ok('la condición también', yoCat.condicion === 'Responsable Inscripto');
  ok('y la función', yoCat.funcion === 'Productor Ejecutivo');
  ok('sigue habiendo una sola ficha suya',
    DB.catalogo.personas.filter(p => norm(p.email) === 'a@b.com').length === 1);
  ok('el usuario quedó enlazado a su ficha',
    getPr().usuarios.some(u => u.personaId === yoCat.id));

  /* --- 7. si falta arranque.sql, que lo diga ------------------------------ */
  console.log('\n--- 7. SI FALTA arranque.sql, EL MENSAJE AYUDA ---');
  const fetchBueno = global.fetch;
  global.fetch = async (url, opts) => String(url).includes('crear_mi_productora')
    ? respu(404, { message: 'Could not find the function public.crear_mi_productora' })
    : fetchBueno(url, opts);

  let textoError = '';
  const caja = { appendChild() {}, style: {},
    set innerHTML(v) { textoError = v; }, get innerHTML() { return textoError; } };
  document.getElementById = () => caja;

  SESION = 'auth-nuevo';
  await conectar('nuevo@x.com');
  cargarForm({ nombre: 'Alguien', tel: '', productoraNombre: 'Neto Films', area: '' });
  await confirmarAlta();

  const plano = textoError.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  ok('avisa que falta correr arranque.sql', /arranque\.sql/.test(textoError), plano.slice(0, 95));
  ok('y dice dónde correrlo', /SQL Editor/.test(textoError));
  ok('no dice que salió bien', !/Bienvenido/.test(textoError));
  ok('no dejó una productora a medias', !TB.productora.some(p => p.nombre === 'Neto Films'));
  global.fetch = fetchBueno;

  console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
  process.exitCode = fallos ? 1 : 0;
})();
