/* Me olvidé la contraseña.
   ---------------------------------------------------------------------------
   Andrés no se acordaba la contraseña de CLAP y no había forma de recuperarla
   sin entrar a la base. Tiene que ser sencillo:
     - en la ventana de entrar hay "Me olvidé la contraseña": con el mail
       escrito, pide el mail de Supabase
     - el link del mail vuelve a CLAP (con la conexión adentro) y pide la
       contraseña nueva; al guardarla, ya está adentro
     - si el link venció, lo dice y ofrece pedir otro
     - estando adentro, "Cambiar mi contraseña"
     - si la sesión se cayó con la base pausada, se recupera sola           */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
const form = campos => { global.document.querySelectorAll = s =>
  /\[name\]/.test(s) ? Object.entries(campos).map(([name, value]) => ({name, value})) : []; };
const diag = {innerHTML: '', appendChild(){}, querySelector(){ return null; }, style: {}};
global.document.getElementById = id => (id === 'sbdiag' || id === 'clavediag') ? diag : {innerHTML: '', style: {}};

let pedidos = [], CLAVE = 'vieja123', REFRESH_OK = true;
const respu = (s, b) => ({ ok: s >= 200 && s < 300, status: s, statusText: 'x',
  text: async () => b === undefined ? '' : JSON.stringify(b) });
global.fetch = async (url, o = {}) => {
  const u = String(url), met = o.method || 'GET', c = o.body ? JSON.parse(o.body) : null;
  pedidos.push({u, met, c, auth: (o.headers || {}).Authorization || ''});
  if (u.includes('/auth/v1/recover')) {
    if (c.email === 'apurado@ejemplo.com') return respu(429, {msg: 'For security purposes, you can only request this after 60 seconds.'});
    return respu(200, {});
  }
  if (u.includes('/auth/v1/user') && met === 'GET') return respu(200, {id: 'auth-andres', email: 'andres@ejemplo.com'});
  if (u.includes('/auth/v1/user') && met === 'PUT') {
    if (c.password === CLAVE) return respu(422, {msg: 'New password should be different from the old password.'});
    CLAVE = c.password; return respu(200, {id: 'auth-andres', email: 'andres@ejemplo.com'});
  }
  if (u.includes('grant_type=password')) {
    if (c.password !== CLAVE) return respu(400, {error_description: 'Invalid login credentials'});
    return respu(200, {access_token: 'acc-login', refresh_token: 'ref-login', expires_in: 3600, user: {id: 'auth-andres', email: c.email}});
  }
  if (u.includes('grant_type=refresh_token')) {
    if (!REFRESH_OK) return respu(503, {message: 'paused'});
    return respu(200, {access_token: 'acc-renovado', refresh_token: 'ref-2', expires_in: 3600, user: {id: 'auth-andres', email: 'andres@ejemplo.com'}});
  }
  if (u.includes('/auth/v1/settings')) return respu(200, {external: {}});
  return respu(200, []);
};
global.location = {origin: 'https://clap.test', pathname: '/clap.html', search: '', hash: '', href: 'https://clap.test/clap.html'};
let barra = null;
global.history = {replaceState(_, __, url){ barra = url; global.location.hash = ''; }};

(async () => {
  DB = dbVacia(); sembrar();
  SB.url = 'https://base.test'; SB.anon = 'sb_publishable_x'; SB.access = null; SB.refresh = null; SB.user = null;

  console.log('--- 1. PEDIR EL MAIL ---');
  modal = null; menuNube();
  ok('la ventana de entrar tiene "Me olvidé la contraseña"', /olvideClave\(\)/.test(modal || '') && /Me olvidé la contraseña/.test(modal || ''));
  form({sbmail: '', sbpass: ''}); diag.innerHTML = '';
  await olvideClave();
  ok('sin mail escrito, pide que lo escriba', /Escribí tu mail arriba/.test(diag.innerHTML));
  ok('y no manda nada', !pedidos.some(p => p.u.includes('/recover')));
  form({sbmail: 'andres@ejemplo.com', sbpass: ''});
  await olvideClave();
  const rec = pedidos.find(p => p.u.includes('/auth/v1/recover'));
  ok('con el mail, le pide a Supabase el mail de recuperación', rec && rec.c.email === 'andres@ejemplo.com');
  const vuelta = rec && decodeURIComponent(rec.u.split('redirect_to=')[1] || '');
  ok('el link vuelve a CLAP', vuelta.startsWith('https://clap.test/clap.html'), vuelta);
  ok('con la conexión adentro (sirve en otro aparato)', /sb=https%3A%2F%2Fbase\.test/.test(vuelta) && /k=sb_publishable_x/.test(vuelta));
  ok('y le dice que revise el mail', /Te mandamos un mail a andres@ejemplo\.com/.test(diag.innerHTML));
  form({sbmail: 'apurado@ejemplo.com', sbpass: ''});
  await olvideClave();
  ok('si lo pide dos veces seguidas, se lo explica en castellano', /Esperá un minuto/.test(diag.innerHTML), diag.innerHTML.replace(/<[^>]+>/g, '').slice(0, 90));

  console.log('\n--- 2. VOLVER DEL MAIL Y PONER LA NUEVA ---');
  global.location.hash = '#access_token=acc-mail&expires_in=3600&refresh_token=ref-mail&token_type=bearer&type=recovery';
  modal = null;
  const seHizoCargo = await atenderVueltaDeMail();
  ok('reconoce la vuelta del link', seHizoCargo === true);
  ok('se borra de la barra (no queda la sesión a la vista)', global.location.hash === '' && barra === '/clap.html');
  ok('queda con la sesión del mail', SB.access === 'acc-mail' && SB.refresh === 'ref-mail');
  ok('y sabe quién es', SB.user && SB.user.email === 'andres@ejemplo.com');
  ok('pide la contraseña nueva', /Poné tu contraseña nueva/.test(modal || '') && /andres@ejemplo\.com/.test(modal || ''));
  ok('sin botón de cancelar (tiene que ponerla)', !/>Cancelar</.test(modal || ''));
  form({clave1: '123', clave2: '123'}); diag.innerHTML = '';
  await guardarClaveNueva(true);
  ok('corta: la rechaza', /al menos 6 caracteres/.test(diag.innerHTML));
  form({clave1: 'nueva-2026', clave2: 'nueva-2O26'});
  await guardarClaveNueva(true);
  ok('distintas: avisa', /no coinciden/.test(diag.innerHTML));
  form({clave1: 'vieja123', clave2: 'vieja123'});
  await guardarClaveNueva(true);
  ok('igual a la anterior: lo explica', /distinta de la contraseña anterior/.test(diag.innerHTML));
  form({clave1: 'nueva-2026', clave2: 'nueva-2026'});
  modal = 'abierto'; await guardarClaveNueva(true);
  const put = pedidos.filter(p => p.u.includes('/auth/v1/user') && p.met === 'PUT').pop();
  ok('la guarda en Supabase con la sesión del mail', put && put.c.password === 'nueva-2026' && put.auth === 'Bearer acc-mail');
  ok('y cierra la ventana', modal === null);
  SB.access = null; SB.refresh = null; SB.user = null;
  form({sbmail: 'andres@ejemplo.com', sbpass: 'nueva-2026'});
  await sbAccion('entrar');
  ok('después entra con la contraseña nueva', sbConectado() && SB.access === 'acc-login');

  console.log('\n--- 3. LINK VENCIDO ---');
  global.location.hash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
  modal = null;
  ok('lo reconoce', await atenderVueltaDeMail() === true);
  ok('dice que el link ya no sirve', /Ese link ya no sirve/.test(modal || '') && /dura una hora/.test(modal || ''));
  ok('y ofrece pedir otro', /Pedir otro/.test(modal || '') && /menuNube\(\)/.test(modal || ''));
  global.location.hash = '#seccion-cualquiera';
  ok('un # que no es del mail no se toca', await atenderVueltaDeMail() === false && global.location.hash === '#seccion-cualquiera');
  global.location.hash = '';

  console.log('\n--- 4. CONFIRMAR EL ALTA DESDE EL MAIL ---');
  SB.access = null; SB.user = null;
  global.location.hash = '#access_token=acc-alta&expires_in=3600&refresh_token=ref-alta&type=signup';
  const sigue = await atenderVueltaDeMail();
  ok('el link de confirmación deja adentro y sigue el arranque', sigue === false && SB.access === 'acc-alta' && sbConectado());

  console.log('\n--- 5. CAMBIAR LA CONTRASEÑA ESTANDO ADENTRO ---');
  modal = null; menuNube();
  ok('conectado, está "Cambiar mi contraseña"', /pedirClaveNueva\(false\)/.test(modal || ''));
  modal = null; pedirClaveNueva(false);
  ok('abre el formulario, con cancelar', /Cambiar mi contraseña/.test(modal || '') && />Cancelar</.test(modal || ''));
  form({clave1: 'otra-clave', clave2: 'otra-clave'});
  await guardarClaveNueva(false);
  ok('la guarda', CLAVE === 'otra-clave');

  console.log('\n--- 6. LA SESIÓN SE RECUPERA SOLA ---');
  SB.access = null; SB.user = null; SB.refresh = 'ref-guardado'; SB.expira = 0;
  REFRESH_OK = true;
  ok('sin access pero con refresh, renueva en vez de pedir la contraseña', await sbSesionViva() === true && SB.access === 'acc-renovado');
  SB.access = null; SB.refresh = 'ref-guardado'; REFRESH_OK = false;
  ok('si la base no responde, no la da por buena', await sbSesionViva() === false);
  ok('pero guarda el refresh para la próxima', SB.refresh === 'ref-guardado');
  SB.access = null; SB.refresh = null;
  ok('sin nada, no hay sesión', await sbSesionViva() === false);

  console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
  process.exitCode = fallos ? 1 : 0;
})();
