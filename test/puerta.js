/* La puerta: en la web, sin sesión no se ve nada.
   ---------------------------------------------------------------------------
   Pedido de Andrés: "que si no están logueados con su mail no puedan ver
   nada, que sea una especie de home vacía con el cuadro para el login".
   Y sin tener que autorizar a mano a cada usuario nuevo: una cuenta sola no
   ve nada, se entra con una invitación (backend/privado.sql).

   Lo que se cuida:
     - sin sesión: ni el ejemplo, ni lo guardado en el navegador
     - con sesión y sin productora: una pantalla que explica qué hacer
     - sin señal en el rodaje, el que ya había entrado sigue trabajando
     - dos personas en la misma compu: cada una ve lo suyo, nada se borra   */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

const TB = { organizacion: [{ id: 'org-1' }], productora: [], usuario: [], catalogo_persona: [],
             proyecto: [], proyecto_persona: [] };
let SEQ = 0, SESION = null, SIN_SENAL = false, REFRESH_VENCIDO = false;
const CUENTAS = { 'andres@x.com': 'auth-andres', 'otra@x.com': 'auth-otra', 'nuevo@x.com': 'auth-nuevo' };
const respu = (s, b) => ({ ok: s >= 200 && s < 300, status: s, statusText: 'x',
  text: async () => b === undefined ? '' : JSON.stringify(b) });
const mias = () => TB.usuario.filter(u => u.auth_uid === SESION && u.activo && !u.pendiente).map(u => u.productora_id);

global.fetch = async (url, o = {}) => {
  if (SIN_SENAL) throw new Error('Failed to fetch');
  const u = String(url), met = o.method || 'GET', c = o.body ? JSON.parse(o.body) : null;
  if (u.includes('grant_type=password')) {
    const id = CUENTAS[c.email];
    if (!id || c.password !== 'secreto123') return respu(400, { error_description: 'Invalid login credentials' });
    SESION = id;
    return respu(200, { access_token: 't', refresh_token: 'r', expires_in: 3600, user: { id, email: c.email } });
  }
  if (u.includes('grant_type=refresh_token')) {
    if (REFRESH_VENCIDO) return respu(400, { error_description: 'Invalid Refresh Token: Refresh Token Not Found' });
    return respu(200, { access_token: 't2', refresh_token: 'r2', expires_in: 3600, user: { id: SESION, email: 'x' } });
  }
  if (u.includes('/auth/v1/signup')) {
    return respu(200, { user: { id: 'auth-nuevo', email: c.email } });   /* pide confirmar el mail */
  }
  if (u.includes('/auth/v1/logout')) return respu(204);
  if (u.includes('/rpc/productoras_para_elegir'))
    return respu(200, TB.productora.filter(p => mias().includes(p.id)).map(p => ({ id: p.id, nombre: p.nombre })));
  if (u.includes('/rpc/crear_mi_productora')) {
    const pr = { id: 'prod-' + (++SEQ), org_id: 'org-1', nombre: c.p_nombre };
    TB.productora.push(pr);
    TB.usuario.push({ id: 'u-' + (++SEQ), auth_uid: SESION, productora_id: pr.id, nombre: c.p_mi_nombre,
      rol: 'admin', activo: true, pendiente: false, email: 'x' });
    return respu(200, pr.id);
  }
  if (u.includes('/rpc/')) return respu(200, null);
  const m = u.match(/\/rest\/v1\/(\w+)/); if (!m) return respu(404, {});
  const tabla = TB[m[1]] || [];
  if (met !== 'GET') return respu(200, []);
  let filas = tabla.slice();
  if (m[1] === 'productora') filas = filas.filter(f => mias().includes(f.id));
  if (m[1] === 'proyecto') filas = filas.filter(f => mias().includes(f.productora_id));
  if (m[1] === 'usuario') filas = filas.filter(f => f.auth_uid === SESION);
  if (m[1] === 'catalogo_persona') filas = mias().length ? filas : [];
  return respu(200, filas);
};
global.location = { origin: 'https://clap.test', pathname: '/clap/', search: '', hash: '', protocol: 'https:' };
global.history = { replaceState() {} };
const cargarForm = campos => { global.document.querySelectorAll = s =>
  /\[name\]/.test(s) ? Object.entries(campos).map(([name, value]) => ({ name, value })) : []; };
let diag = '';
document.getElementById = id => id === 'sbdiag'
  ? { set innerHTML(v) { diag = v; }, get innerHTML() { return diag; } } : null;
const pantalla = () => app.innerHTML;
const esLaApp = () => /class="tabs"/.test(pantalla());

(async () => {
  /* --- 1. la web, sin sesión ------------------------------------------- */
  console.log('--- 1. SIN SESION NO SE VE NADA ---');
  PUERTA = true;
  for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
  sbOlvidar(); cargar();
  ok('en la web no se siembra el ejemplo', DB.productoras.length === 0);
  render();
  ok('sin conexión configurada: no muestra la app', !esLaApp());
  ok('pide abrir el link de la productora', /Abrí el link que te mandó tu productora/.test(pantalla()));
  ok('y deja cargar los datos de conexión a mano', /name="sburl"/.test(pantalla()) && /name="sbanon"/.test(pantalla()));

  SB.url = 'https://x.supabase.co'; SB.anon = 'anon'; sbGuardar();
  /* un navegador donde alguien ya trabajó (y no hay sesión) */
  DB = dbVacia(); sembrar(); render();
  ok('con datos guardados en el navegador, igual no los muestra',
    !esLaApp() && !/Productora Demo/.test(pantalla()) && !/Sofía Roldán/.test(pantalla()));
  ok('muestra el cuadro para entrar', /name="sbmail"/.test(pantalla()) && /name="sbpass"/.test(pantalla()));
  ok('con Entrar y "me olvidé la contraseña"', /puertaEntrar\('entrar'\)/.test(pantalla()) && /olvideClave\(\)/.test(pantalla()));
  ok('Enter en la contraseña entra', /onkeydown="if\(event.key==='Enter'\)puertaEntrar\('entrar'\)"/.test(pantalla()));
  ok('explica cómo es la primera vez', /Si te invitaron, abrí el link/.test(pantalla()));
  ok('sin el selector "Viendo como" de la gente de ejemplo', !/Viendo como/.test(pantalla()));

  /* --- 2. entrar mal y bien -------------------------------------------- */
  console.log('\n--- 2. ENTRAR ---');
  cargarForm({ sbmail: 'andres@x.com', sbpass: 'mal' });
  await puertaEntrar('entrar');
  ok('contraseña mal: lo dice y sigue afuera', /Mail o contraseña incorrectos/.test(diag) && !esLaApp(), diag.replace(/<[^>]+>/g, ''));
  cargarForm({ sbmail: '', sbpass: '' });
  await puertaEntrar('entrar');
  ok('vacío: pide los datos', /Poné tu mail y tu contraseña/.test(diag));

  /* --- 3. una cuenta sin productora ------------------------------------ */
  console.log('\n--- 3. UNA CUENTA SOLA NO VE NADA ---');
  DB = dbVacia();
  cargarForm({ sbmail: 'otra@x.com', sbpass: 'secreto123' });
  await puertaEntrar('entrar');
  ok('entró', sbConectado());
  ok('pero no ve la app', !esLaApp());
  ok('le dice que no está en ninguna productora', /Todavía no estás en ninguna productora/.test(pantalla()));
  ok('y le explica que lo inviten', /✉ Invitar/.test(pantalla()));
  ok('ofrece crear la suya', /Crear mi productora/.test(pantalla()));
  cargarForm({ nombre: 'Otra', tel: '', productoraNombre: 'Otra Films', area: '' });
  await confirmarAlta();
  ok('al crearla, ve la app', esLaApp() && /Otra Films/.test(pantalla()));
  ok('y la productora es suya: queda anotada como dueña de estos datos', DB.dueno === 'auth-otra');

  /* --- 4. cerrar sesión ------------------------------------------------ */
  console.log('\n--- 4. CERRAR SESION ---');
  await sbCerrarSesion();
  ok('vuelve la puerta', !esLaApp() && /name="sbmail"/.test(pantalla()));
  await new Promise(r => setTimeout(r, 200));
  const guardado = JSON.parse(localStorage.getItem(KEY) || '{}');
  ok('lo guardado NO se borró (presupuestos y plan viven sólo acá)',
    (guardado.productoras || []).some(p => p.nombre === 'Otra Films'));

  /* --- 5. otra persona en la misma compu ------------------------------ */
  console.log('\n--- 5. OTRA PERSONA, MISMA COMPU ---');
  TB.productora.push({ id: 'prod-neto', org_id: 'org-1', nombre: 'Neto Films' });
  TB.usuario.push({ id: 'u-andres', auth_uid: 'auth-andres', productora_id: 'prod-neto', nombre: 'Andrés',
    rol: 'admin', activo: true, pendiente: false, email: 'andres@x.com' });
  cargarForm({ sbmail: 'andres@x.com', sbpass: 'secreto123' });
  await puertaEntrar('entrar');
  ok('Andrés entra y ve SU productora', esLaApp() && /Neto Films/.test(pantalla()));
  ok('y NO la de la otra persona', !/Otra Films/.test(pantalla()), DB.productoras.map(p => p.nombre).join());
  ok('lo de ella quedó apartado, no borrado', /Otra Films/.test(localStorage.getItem(KEY + '@auth-otra') || ''));
  await sbCerrarSesion();
  cargarForm({ sbmail: 'otra@x.com', sbpass: 'secreto123' });
  await puertaEntrar('entrar');
  ok('cuando ella vuelve, recupera lo suyo', esLaApp() && /Otra Films/.test(pantalla()) && !/Neto Films/.test(pantalla()));
  ok('y lo de Andrés queda apartado para él', /Neto Films/.test(localStorage.getItem(KEY + '@auth-andres') || ''));

  /* --- 6. sin señal ---------------------------------------------------- */
  console.log('\n--- 6. EN EL RODAJE, SIN SEÑAL ---');
  SB.expira = 0; SIN_SENAL = true;
  const viva = await sbSesionViva();
  ok('la sesión no se pudo renovar', viva === false && !sbConectado());
  render();
  ok('pero la puerta sigue abierta: trabaja con lo que tiene', esLaApp() && /Otra Films/.test(pantalla()));
  SIN_SENAL = false;
  ok('al volver la señal, la sesión se renueva sola', await sbSesionViva() === true && sbConectado());

  /* --- 7. la sesión que venció de verdad ------------------------------- */
  console.log('\n--- 7. SESION VENCIDA DE VERDAD ---');
  SB.expira = 0; REFRESH_VENCIDO = true;
  await sbSesionViva();
  render();
  ok('si el servidor dice que ya no vale, se cierra la puerta', !esLaApp() && /name="sbmail"/.test(pantalla()));
  REFRESH_VENCIDO = false;

  /* --- 8. crear cuenta sin invitación ---------------------------------- */
  console.log('\n--- 8. CREAR CUENTA ---');
  cargarForm({ sbmail: 'nuevo@x.com', sbpass: 'secreto123' });
  await puertaEntrar('registrar');
  ok('si hay que confirmar el mail, lo dice', /confirmar la dirección/.test(diag), diag.replace(/<[^>]+>/g, '').slice(0, 120));
  ok('y sigue afuera hasta confirmarlo', !esLaApp());

  /* --- 9. desde el disco no hay puerta -------------------------------- */
  console.log('\n--- 9. ABIERTO DESDE EL DISCO ---');
  PUERTA = false; DB = dbVacia(); sembrar(); render();
  ok('se ve la app con el ejemplo, para probar', esLaApp() && /Productora Demo/.test(pantalla()));

  console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
  process.exitCode = fallos ? 1 : 0;
})();
