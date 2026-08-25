let fallos=0;
const ok=(t,c,extra='')=>{ console.log((c?'  OK  ':'FALLA ')+t+(extra?'  -> '+extra:'')); if(!c)fallos++; };
const pr=getPr(), py=getPy(), v=getV();
ok('semilla: 1 productora', DB.productoras.length===1, pr.nombre);
ok('semilla: proyecto activo', !!py, py.nombre);
ok('semilla: 17 rubros', v.rubros.length===17, v.rubros.length);
const RR=calcular(v);
console.log('\n--- CALCULO ---');
RR.porRubro.filter(r=>r.total>0).forEach(r=>
  console.log('  '+r.codigo+' '+r.nombre.padEnd(38)+String(Math.round(r.total)).padStart(12)));
const li=(l,x)=>console.log('  '+l.padStart(45)+String(Math.round(x)).padStart(12));
li('Subtotal',RR.subtotal); li('Fee '+v.capas.fee+'% s/ '+Math.round(RR.baseFee),RR.fee);
li('Conting. '+v.capas.contingencia+'%',RR.contingencia); li('Neto',RR.neto);
li('IVA '+v.capas.iva+'%',RR.iva); li('TOTAL ARS',RR.total);
li('TOTAL USD',conv(RR.total,'ARS','USD',v.tc));
console.log('\n--- CHEQUEOS ---');
const elenco=v.rubros.find(r=>r.codigo==='09');
ok('elenco excluido del fee', Math.abs(RR.baseFee-(RR.subtotal-totalRubro(elenco,v)))<1,
   'subtotal '+Math.round(RR.subtotal)+' vs baseFee '+Math.round(RR.baseFee));
const buy=elenco.lineas.find(l=>l.concepto.includes('Buyout'));
ok('USD->ARS en linea', Math.round(totalLinea(buy,v))===1800*1420, Math.round(totalLinea(buy,v)));
const cat=v.rubros.find(r=>r.codigo==='13').lineas[0];
ok('cant x dias x valor', Math.round(totalLinea(cat,v))===32*1*14000, Math.round(totalLinea(cat,v)));
ok('total = neto + IVA', Math.abs(RR.total-(RR.neto+RR.neto*v.capas.iva/100))<0.01);
ok('neto = subtotal+fee+cont+iibb', Math.abs(RR.neto-(RR.subtotal+RR.fee+RR.contingencia+RR.iibb))<0.01);
const e=exposicion(v);
console.log('\n--- EXPOSICION ---');
console.log('  bancario '+Math.round(e.bancario)+' | efectivo '+Math.round(e.efectivo)+' | otro '+Math.round(e.otro));
console.log('  c/factura '+Math.round(e.facturado)+' | recibo simple '+Math.round(e.parcial)+' | sin comprob '+Math.round(e.sinRespaldo));
ok('canales suman el total', Math.abs((e.bancario+e.efectivo+e.otro)-RR.subtotal)<1);
ok('comprobantes suman el total', Math.abs((e.facturado+e.parcial+e.sinRespaldo+e.sinDefinir)-RR.subtotal)<1);
const antes=py.versiones.length;
duplicarVersion();
ok('duplicar crea version', py.versiones.length===antes+1, py.versiones.map(x=>x.nombre).join(','));
const v2=py.versiones[py.versiones.length-1];
ok('ids de rubro distintos', v2.rubros[0].id!==v.rubros[0].id);
ok('ids de linea distintos', v2.rubros[1].lineas[0].id!==v.rubros[1].lineas[0].id);
v2.rubros[1].lineas[0].valorUnit=999;
ok('editar v2 NO toca v1', v.rubros[1].lineas[0].valorUnit!==999, 'v1='+v.rubros[1].lineas[0].valorUnit);
ok('mismo total al duplicar', Math.abs(calcular(v).total-RR.total)<1);
try{ render(); ok('render() corre', true); }catch(err){ ok('render() corre', false, err.message); }
['catalogo','config','presu'].forEach(t=>{
  try{ setTab(t); ok('render solapa '+t, true); }catch(err){ ok('render solapa '+t, false, err.message); }});
try{ setVista('cliente'); render(); ok('render vista cliente', true); }catch(err){ ok('render vista cliente', false, err.message); }
setVista('interna');
try{ const csv=(()=>{let out=null; const _b=bajar; bajar=(n,c)=>out=c; expCSV(); bajar=_b; return out;})();
  ok('CSV se genera', csv && csv.split('\n').length>10, csv.split('\n').length+' filas');
}catch(err){ ok('CSV se genera', false, err.message); }
try{ DB.productoras=[]; DB.ui.productoraId=null; render(); ok('render sin productoras', true); }
catch(err){ ok('render sin productoras', false, err.message); }
console.log('\n'+(fallos?'>>> '+fallos+' FALLAS':'>>> TODO OK'));
process.exitCode = fallos?1:0;
