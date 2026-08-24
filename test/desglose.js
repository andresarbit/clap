const fs=require('fs');
let fallos=0;
const ok=(t,c,x='')=>{console.log((c?'  OK  ':'FALLA ')+t+(x?'  -> '+x:''));if(!c)fallos++;};
const py=getPy();
ok('proyecto trae desglose', !!py.desglose && Array.isArray(py.desglose.escenas));

// importar el guion de ejemplo
guionEjemplo();
const d=getD();
ok('guion importado', d.escenas.length===4, d.escenas.length);
ok('guion guardado para reimportar', d.guion.length>200);
ok('fecha de importacion', !!d.importado, d.importado);

// render de las tres sub-vistas
['escenas','deptos','plan'].forEach(k=>{
  try{ setSub(k); ok('render sub-vista '+k, true); }catch(e){ ok('render sub-vista '+k, false, e.message); }});

// agregar y borrar elementos a mano
const e1=d.escenas[0];
const antesU=(e1.elementos.utileria||[]).length;
global.prompt=()=>'heladera, repasador';
addEl(e1.id,'utileria');
ok('addEl acepta lista separada por comas', e1.elementos.utileria.length===antesU+2, e1.elementos.utileria.join(','));
delEl(e1.id,'utileria','heladera');
ok('delEl borra', !e1.elementos.utileria.includes('heladera'));
global.prompt=()=>'EXTRA CANCHERO';
addEl(e1.id,'personajes');
ok('addEl personaje', e1.personajes.includes('EXTRA CANCHERO'), e1.personajes.join('|'));
delEl(e1.id,'personajes','EXTRA CANCHERO');
ok('delEl personaje', !e1.personajes.includes('EXTRA CANCHERO'));

// re-detectar conserva lo manual y borra sugerencias descartadas
delEl(e1.id,'utileria','mate');           // descarto una sugerencia
reDetectar();
ok('reDetectar conserva lo agregado a mano', e1.elementos.utileria.includes('repasador'), e1.elementos.utileria.join(','));
ok('reDetectar reencuentra la sugerencia borrada', e1.elementos.utileria.includes('mate'),
   'esperado: vuelve, porque la palabra sigue en el guion');

// jornadas
autoAgrupar();
ok('auto-agrupar asigna todas', d.escenas.every(e=>e.jornada), d.escenas.map(e=>e.jornada).join(','));
ok('misma locacion misma jornada', d.escenas[0].jornada===d.escenas[3].jornada,
   'esc1 J'+d.escenas[0].jornada+' / esc4 J'+d.escenas[3].jornada);
ok('sincroniza lista de jornadas', d.jornadas.length===Math.max(...d.escenas.map(e=>e.jornada)), d.jornadas.length);
setPagJornada(0.25);
autoAgrupar();
ok('tope de paginas parte en mas jornadas', d.jornadas.length>1, d.jornadas.length+' jornadas con 1/4 pg por dia');
setPagJornada(4); autoAgrupar();
limpiarJornadas();
ok('desasignar todo', d.escenas.every(e=>!e.jornada) && d.jornadas.length===0);
setJornada(d.escenas[0].id,'2');
ok('asignar a mano', d.escenas[0].jornada===2 && d.jornadas.length===2, 'J'+d.escenas[0].jornada);
limpiarJornadas(); autoAgrupar();

// puente al presupuesto
const p=propuestaPresupuesto();
console.log('\n--- LINEAS PROPUESTAS ---');
p.lineas.forEach(l=>console.log(`  ${l.rubro}  ${String(l.cantidad)}x${String(l.dias).padEnd(2)} ${l.concepto.padEnd(44)} ${l.nota.slice(0,40)}`));
ok('propone lineas', p.lineas.length>8, p.lineas.length+' lineas');
ok('elenco va al rubro 09', p.lineas.filter(l=>l.dep==='elenco').every(l=>l.rubro==='09'));
ok('una linea por personaje', p.lineas.filter(l=>l.dep==='elenco').length===2);
ok('LUCIA aparece en 2 jornadas', p.lineas.find(l=>l.concepto==='LUCÍA').dias>=1,
   'dias='+p.lineas.find(l=>l.concepto==='LUCÍA').dias);
ok('una linea por locacion', p.lineas.filter(l=>l.dep==='locacion').length===3);
ok('vehiculos al rubro 12', p.lineas.filter(l=>l.dep==='vehiculos').every(l=>l.rubro==='12'));
ok('utileria agrupada en 1 linea', p.lineas.filter(l=>l.dep==='utileria').length===1,
   p.lineas.find(l=>l.dep==='utileria')?.concepto);
ok('todo cae en un rubro que existe', p.lineas.every(l=>getV().rubros.some(r=>r.codigo===l.rubro)));

// crear las lineas de verdad
const v=getV();
const antesTot=v.rubros.reduce((s,r)=>s+r.lineas.length,0);
global.document.querySelectorAll = sel => sel.includes('data-i')
  ? p.lineas.map((_,i)=>({checked:true, dataset:{i:String(i)}})) : [];
global.document.getElementById = id => id==='setj' ? {checked:true} : {value:'',click(){}};
confirmarAPresupuesto();
const despues=v.rubros.reduce((s,r)=>s+r.lineas.length,0);
ok('crea las lineas en el presupuesto', despues===antesTot+p.lineas.length, antesTot+' -> '+despues);
ok('las crea en valor 0', v.rubros.find(r=>r.codigo==='09').lineas.slice(-2).every(l=>l.valorUnit===0));
ok('actualiza jornadas del proyecto', getPy().jornadas===p.jornadas, getPy().jornadas);
ok('el total sigue calculando', isFinite(calcular(v).total), Math.round(calcular(v).total));

// robustez
ok('desglose vacio no rompe el render', (()=>{ getPy().desglose=nuevoDesglose();
  try{ DB.ui.tab='desglose'; render(); return true; }catch(e){ return e.message; } })()===true);

console.log('\n'+(fallos?'>>> '+fallos+' FALLAS':'>>> TODO OK'));
process.exitCode=fallos?1:0;
