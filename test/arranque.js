/* Que la app NUNCA quede en blanco.
   ---------------------------------------------------------------------------
   Una app de una sola página que se rompe al arrancar no muestra un error:
   muestra nada. Y "no se abre" es lo único que puede decir la persona del otro
   lado — que es exactamente lo que no alcanza para arreglarlo.

   Y peor que quedar en blanco: arrancar de cero en silencio. Antes, si los
   datos guardados no se podían leer, la app sembraba la Productora Demo y la
   persona abría su presupuesto para encontrar que "se borró todo".          */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

/* `app` ya existe en la app; se usa el del propio programa */
const pintado = () => String(app.innerHTML || '');

console.log('--- 1. DATOS GUARDADOS ILEGIBLES ---');
localStorage.setItem('clap.db.v1', '{esto no es json valido');
_crudoGuardado = null; _fallaArranque = null;
cargar();
ok('no explota', true);
ok('registra que falló', !!_fallaArranque, _fallaArranque && _fallaArranque.donde);
ok('SE GUARDA LO QUE HABIA para poder devolverlo', _crudoGuardado === '{esto no es json valido');
ok('NO siembra la demo encima', !DB.productoras.some(p => p.nombre === 'Productora Demo'),
  DB.productoras.map(p => p.nombre).join(',') || '(ninguna)');

pantallaDeError(_fallaArranque.error, _fallaArranque.donde);
let h = pintado();
ok('muestra una pantalla, no queda en blanco', h.length > 200, h.length + ' chars');
ok('dice que no pudo abrir', /La app no pudo abrir/.test(h));
ok('AVISA QUE LOS DATOS SIGUEN AHI', /Tus datos siguen guardados/.test(h));
ok('ofrece bajarlos', /bajarRespaldoCrudo\(\)/.test(h));
ok('y reintentar', /location\.reload\(\)/.test(h));
ok('y empezar de cero, pero al final', h.indexOf('bajarRespaldoCrudo') < h.indexOf('empezarDeCero'));
ok('trae el detalle técnico', /Detalle técnico/.test(h));

/* Lo más importante de todo: con el arranque fallado, NADA puede escribir
   encima. Si no, salir de la pantalla de error borra lo único que quedaba. */
ok('guardar() NO pisa los datos mientras haya falla', (() => {
  const antes = localStorage.getItem('clap.db.v1');
  guardar();
  return localStorage.getItem('clap.db.v1') === antes;
})(), 'lo guardado sigue intacto');

console.log('\n--- 2. SIN DATOS GUARDADOS ARRANCA COMO SIEMPRE ---');
localStorage.removeItem('clap.db.v1'); localStorage.removeItem('cuadro.db.v1');
_crudoGuardado = null; _fallaArranque = null;
cargar();
ok('no marca falla', !_fallaArranque);
ok('siembra el ejemplo', DB.productoras.some(p => p.nombre === 'Productora Demo'));
ok('render anda', renderSeguro('probar') === true);
ok('y dibujó la app', /CLAP/.test(pintado()));

console.log('\n--- 3. UNA BASE VIEJA MIGRA, NO SE PIERDE ---');
const vieja = {schemaVersion:1, catalogo:{personas:[]}, ui:{tab:'resumen'},
  productoras:[{id:'pr-1', nombre:'La Mía', feeDefault:15, contingenciaDefault:5,
    ivaDefault:21, iibbDefault:0,
    proyectos:[{id:'py-1', nombre:'Spot viejo', tipo:'publicidad', jornadas:1,
      versiones:[{id:'v-1', nombre:'v1', estado:'borrador', monedaBase:'ARS', tc:1000,
        tcFecha:'2026-01-01', tcNombre:'MEP', capas:{fee:15,contingencia:5,iibb:0,iva:21},
        rubros:[{id:'rb-1', codigo:'04', nombre:'Fotografía', aplicaFee:true,
          lineas:[{id:'ln-1', concepto:'DF', cantidad:1, dias:1, valorUnit:500000,
            moneda:'ARS', unidad:'jornada'}]}]}]}]}]};
localStorage.setItem('clap.db.v1', JSON.stringify(vieja));
_crudoGuardado = null; _fallaArranque = null;
cargar();
ok('no marca falla', !_fallaArranque);
ok('CONSERVA la productora', DB.productoras[0].nombre === 'La Mía', DB.productoras[0].nombre);
ok('y el proyecto', DB.productoras[0].proyectos[0].nombre === 'Spot viejo');
ok('le pone el array de piezas', Array.isArray(DB.productoras[0].proyectos[0].piezas));
DB.ui.productoraId = DB.productoras[0].id;
DB.ui.proyectoId = DB.productoras[0].proyectos[0].id;
DB.ui.versionId = DB.productoras[0].proyectos[0].versiones[0].id;
ok('el total sigue siendo el suyo', calcular(getV()).subtotal === 500000, fmt(calcular(getV()).subtotal));
ok('render anda con datos viejos', renderSeguro('probar') === true);

console.log('\n--- 4. SI EL RENDER SE ROMPE, SE VE EL ERROR ---');
const renderBueno = render;
render = () => { throw new Error('explotó a propósito'); };
app.innerHTML = '';
ok('renderSeguro avisa que falló', renderSeguro('dibujar la pantalla') === false);
h = pintado();
ok('y pinta la pantalla de error', /La app no pudo abrir/.test(h));
ok('con el motivo', /explotó a propósito/.test(h));
ok('y el lugar', /dibujar la pantalla/.test(h));
render = renderBueno;

console.log('\n--- 5. EL RESPALDO SALE AUNQUE TODO ESTE ROTO ---');
let bajado = null;
const _crear = document.createElement;
document.createElement = t => t === 'a'
  ? {set href(v){}, get href(){return 'x'}, set download(v){bajado = v}, click(){}}
  : _crear(t);
global.URL = {createObjectURL: () => 'blob:x', revokeObjectURL(){}};
global.Blob = class { constructor(p){ this.p = p; } };
_crudoGuardado = '{"algo":"mio"}';
bajarRespaldoCrudo();
ok('baja un archivo', !!bajado, bajado);
ok('con nombre reconocible', /clap-respaldo-\d{4}-\d{2}-\d{2}\.json/.test(bajado || ''), bajado);
document.createElement = _crear;

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
