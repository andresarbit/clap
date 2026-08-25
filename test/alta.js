/* El alta propia: el que entra por primera vez dice quién es, a qué productora
   se suma y qué hace. Con el candado abierto queda activo; con el candado
   cerrado queda esperando aprobación y no ve nada hasta que lo aprueben.
   Se prueba contra un Supabase de mentira que respeta las mismas reglas que
   las políticas de la base. */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

/* --- Supabase de mentira, con tablas de verdad --------------------------- */
const TB = { organizacion: [], productora: [], usuario: [] };
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
  if (u.includes('/rpc/productoras_para_elegir'))
    return respu(200, TB.productora.map(p => ({ id: p.id, nombre: p.nombre })));
  if (u.includes('/rpc/productora_pide_aprobacion')) {
    const pr = TB.productora.find(x => x.id === cuerpo.p);
    return respu(200, !!(pr && pr.requiere_aprobacion));
  }

  const m = u.match(/\/rest\/v1\/(\w+)/);
  if (!m) return respu(404, { msg: 'no such route' });
  const tabla = TB[m[1]];
  if (!tabla) return respu(404, { message: `relation "public.${m[1]}" does not exist` });

  if (met === 'POST') {
    const fila = { id: nid(m[1]), ...cuerpo };
    /* la política usuario_autoalta, tal cual está escrita en el SQL */
    if (m[1] === 'usuario') {
      if (fila.auth_uid !== SESION)
        return respu(403, { message: 'new row violates row-level security policy' });
      const pr = TB.productora.find(x => x.id === fila.productora_id);
      if (!fila.pendiente && pr && pr.requiere_aprobacion)
        return respu(403, { message: 'new row violates row-level security policy' });
    }
    tabla.push(fila);
    /* el trigger: el que crea la productora queda admin, sin esperar a nadie */
    if (m[1] === 'productora' && !TB.usuario.some(x => x.productora_id === fila.id))
      TB.usuario.push({ id: nid('usuario'), auth_uid: SESION, productora_id: fila.id,
        nombre: 'a@b.com', rol: 'admin', email: 'a@b.com', activo: true, pendiente: false });
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

  _prodsElegibles = await sbProductorasParaElegir();
  modal = null; formAlta();
  ok('pide nombre, productora y rol',
    /name="nombre"/.test(modal) && /name="productoraNombre"/.test(modal) && /name="rol"/.test(modal));
  ok('ofrece Administración desde el principio', /Administración/.test(modal));
  ok('están los cuatro roles', ROLES.every(r => modal.includes(r.l)));
  ok('explica qué hace cada uno', /Aprueba y ejecuta el pago/.test(modal));
  ok('avisa que la primera productora la crea él', /La primera la creás vos/.test(modal));
  ok('deja elegir área', /name="area"/.test(modal) && modal.includes(areaLbl('arte')));

  cargarForm({ nombre: 'Andrés', tel: '11 5555-1234', productoraId: '__nueva',
    productoraNombre: 'Plata o Mierda', rol: 'admin', area: 'produccion' });
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

  /* --- 3. el segundo, candado abierto ----------------------------------- */
  console.log('\n--- 3. EL SEGUNDO SE SUMA, CANDADO ABIERTO ---');
  SESION = 'auth-lucia';
  await conectar('lucia@x.com');
  _prodsElegibles = await sbProductorasParaElegir();
  ok('la productora ya está para elegir', _prodsElegibles.length === 1);
  ok('la función sólo devuelve id y nombre',
    Object.keys(_prodsElegibles[0]).sort().join(',') === 'id,nombre');
  modal = null; formAlta();
  ok('la ofrece en la lista', /Plata o Mierda/.test(modal));
  ok('y deja crear otra igual', /Crear una productora nueva/.test(modal));

  cargarForm({ nombre: 'Lucía Ferrer', tel: '', productoraId: TB.productora[0].id,
    productoraNombre: '', rol: 'produccion', area: 'produccion' });
  await confirmarAlta();
  const luci = await sbMiFicha();
  ok('entra directo, sin esperar', !!luci && luci.activo && !luci.pendiente);
  ok('con el rol que declaró', luci.rol === 'produccion', luci.rol);
  ok('no creó otra productora', TB.productora.length === 1);

  /* --- 4. candado cerrado ----------------------------------------------- */
  console.log('\n--- 4. CANDADO CERRADO ---');
  TB.productora[0].requiere_aprobacion = true;
  SESION = 'auth-colado';
  await conectar('colado@x.com');
  _prodsElegibles = await sbProductorasParaElegir();
  cargarForm({ nombre: 'El Colado', tel: '', productoraId: TB.productora[0].id,
    productoraNombre: '', rol: 'admin', area: '' });
  await confirmarAlta();
  const col = await sbMiFicha();
  ok('lo deja pedir, pero queda pendiente', !!col && col.pendiente === true);
  modal = null; await pantallaAlta();
  ok('no le vuelve a abrir el formulario', modal === null);

  /* la base no lo deja entrar activo aunque el navegador mienta */
  const trampa = await sbFetch('/rest/v1/usuario', { method: 'POST',
    body: JSON.stringify({ auth_uid: SESION, productora_id: TB.productora[0].id,
      nombre: 'Trampa', rol: 'admin', activo: true, pendiente: false }) })
    .then(() => 'pasó').catch(e => e.message);
  ok('la base rechaza el atajo', /no te deja/.test(trampa), trampa);

  const suplanta = await sbFetch('/rest/v1/usuario', { method: 'POST',
    body: JSON.stringify({ auth_uid: 'auth-andres', productora_id: TB.productora[0].id,
      nombre: 'Yo Soy Andrés', rol: 'admin', pendiente: true }) })
    .then(() => 'pasó').catch(e => e.message);
  ok('ni darse de alta por otro', /no te deja/.test(suplanta), suplanta);

  /* --- 5. la cola de aprobación ----------------------------------------- */
  console.log('\n--- 5. LA COLA DE APROBACION ---');
  SESION = 'auth-andres';
  await conectar();
  const cola = await sbPendientes();
  ok('el admin ve al que espera', cola.length === 1 && cola[0].nombre === 'El Colado',
    cola.map(c => c.nombre).join(','));
  modal = null; await menuPendientes();
  ok('la pantalla lo lista', /Altas esperando aprobación/.test(modal));
  await sbAprobar(cola[0].id);
  ok('aprobado, sale de la cola', (await sbPendientes()).length === 0);
  const colAhora = TB.usuario.find(u => u.nombre === 'El Colado');
  ok('y queda activo', colAhora.activo && !colAhora.pendiente);
  ok('con el rol que había pedido', colAhora.rol === 'admin', colAhora.rol);

  /* --- 6. volver a entrar ------------------------------------------------ */
  console.log('\n--- 6. VOLVER A ENTRAR ---');
  modal = null;
  await pantallaAlta();
  ok('al que ya está no le vuelve a preguntar', modal === null, String(modal).slice(0, 40));
  ok('sigue siendo el mismo', (await sbMiFicha()).nombre === 'Andrés');

  console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
  process.exitCode = fallos ? 1 : 0;
})();
