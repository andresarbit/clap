const fs=require('fs');
let fallos=0;
const ok=(t,c,x='')=>{console.log((c?'  OK  ':'FALLA ')+t+(x?'  -> '+x:''));if(!c)fallos++;};
const txt=fs.readFileSync('D:/Cuadro/test/guion-ejemplo.txt','utf8');
const ESC=parseGuion(txt);

console.log('--- ESCENAS ---');
ESC.forEach(e=>{
  console.log(`  ${String(e.numero).padStart(2)} ${e.intExt.padEnd(7)} ${e.locacion.padEnd(26)} ${e.momento.padEnd(10)} ${octavosATexto(e.octavos).padStart(5)} pg`);
  console.log(`     elenco: ${e.personajes.join(', ')||'—'}`);
  Object.entries(e.elementos).forEach(([k,v])=>console.log(`     ${DEPTO(k).l.padEnd(20)} ${v.join(', ')}`));
});

console.log('\n--- CHEQUEOS ---');
ok('4 escenas', ESC.length===4, ESC.length);
ok('numeracion', ESC.map(e=>e.numero).join(',')==='1,2,3,4', ESC.map(e=>e.numero).join(','));
ok('INT/EXT', ESC.map(e=>e.intExt).join(',')==='INT,EXT,EXT,INT', ESC.map(e=>e.intExt).join(','));
ok('momentos', ESC.map(e=>e.momento).join(',')==='DÍA,DÍA,ATARDECER,NOCHE', ESC.map(e=>e.momento).join(','));
ok('locacion sin momento pegado', ESC[0].locacion==='COCINA DEPARTAMENTO', ESC[0].locacion);
ok('locacion repetida = misma', ESC[0].locacion===ESC[3].locacion);
ok('personaje LUCIA detectado', ESC[0].personajes.includes('LUCÍA'), ESC[0].personajes.join('|'));
ok('CONT\'D no duplica personaje', ESC[0].personajes.filter(p=>p.startsWith('LUC')).length===1, ESC[0].personajes.join('|'));
ok('VECINO detectado en ESC 2', ESC[1].personajes.includes('VECINO'), ESC[1].personajes.join('|'));
ok('accion NO se cuela como personaje', !ESC[0].personajes.some(p=>p.includes('Luz')), ESC[0].personajes.join('|'));
ok('transicion CORTE A ignorada', !ESC.some(e=>e.personajes.some(p=>/CORTE/.test(p))));
ok('utileria: mate/taza/diario/llaves', ['mate','taza','diario','llaves'].every(x=>ESC[0].elementos.utileria?.includes(x)), (ESC[0].elementos.utileria||[]).join(','));
ok('animal: perro', ESC[0].elementos.animales?.includes('perro'));
ok('vehiculo: bicicleta+colectivo', ['bicicleta','colectivo'].every(x=>ESC[1].elementos.vehiculos?.includes(x)), (ESC[1].elementos.vehiculos||[]).join(','));
ok('extras: gente', ESC[1].elementos.extras?.includes('gente'));
ok('equipo especial: dron', ESC[2].elementos.equipo?.includes('dron'), (ESC[2].elementos.equipo||[]).join(','));
ok('sfx: lluvia', ESC[2].elementos.sfx?.includes('lluvia'), (ESC[2].elementos.sfx||[]).join(','));
ok('vestuario esc2', (ESC[1].elementos.vestuario||[]).length>0, (ESC[1].elementos.vestuario||[]).join(','));
ok('deteccion sin acentos (LUCIA/lucia)', norm('LUCÍA')==='lucia', norm('LUCÍA'));
ok('marca auto vs confirmado', !!ESC[0].auto.utileria);

const d=nuevoDesglose({escenas:ESC});
const r=resumenDesglose(d);
console.log('\n--- RESUMEN ---');
console.log('  escenas',r.escenas,'| paginas',r.paginas.toFixed(2),'('+octavosATexto(r.octavos)+')');
console.log('  personajes:',r.personajes.join(', '));
console.log('  locaciones:',r.locaciones.join(' | '));
console.log('  noches',r.noches,'| exteriores',r.ext,'| jornadas estimadas',r.jornadasEstimadas);
Object.entries(r.porDepto).forEach(([k,m])=>
  console.log('  '+DEPTO(k).l.padEnd(20)+[...m.values()].map(v=>v.nombre+'('+v.escenas.join(',')+')').join(' ')));
ok('3 locaciones unicas', r.locaciones.length===3, r.locaciones.join('|'));
ok('personajes unicos', r.personajes.length===2, r.personajes.join('|'));
ok('agrega escenas por elemento', r.porDepto.animales && [...r.porDepto.animales.values()][0].escenas.length===2,
   r.porDepto.animales?[...r.porDepto.animales.values()].map(v=>v.nombre+':'+v.escenas).join(' '):'—');
ok('jornadas estimadas >=1', r.jornadasEstimadas>=1, r.jornadasEstimadas);

// robustez
ok('guion vacio no explota', parseGuion('').length===0);
ok('texto sin encabezados no explota', parseGuion('hola\nque tal\n').length===0);
ok('encabezado sin numero', parseGuion('INT. BAR - NOCHE\nAlguien entra.\n')[0].numero==='1');
ok('formato INT./EXT.', parseGuion('INT./EXT. AUTO - DIA\nManeja.\n')[0].intExt==='INT/EXT',
   parseGuion('INT./EXT. AUTO - DIA\nManeja.\n')[0].intExt);
ok('sin momento -> DIA por defecto', parseGuion('EXT. RUTA\nCorre.\n')[0].momento==='DÍA');

console.log('\n'+(fallos?'>>> '+fallos+' FALLAS':'>>> TODO OK'));
process.exitCode=fallos?1:0;
