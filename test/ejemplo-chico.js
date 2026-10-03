/* El ejemplo CHICO de las pruebas: el "Spot Verano — 30″" de siempre (una
   jornada, siete líneas por rubro, números redondos). No es el ejemplo de la
   app (ese es Brisa, en sembrar() de clap.html): es un dato fijo para las
   pruebas de la lógica (cálculo, desglose, callsheet, rodaje…), que no tienen
   por qué cambiar cada vez que se mejora el proyecto de ejemplo.
   test/run.js lo carga antes de cada prueba; se usa con
       DB = dbVacia(); sembrarChico();                                       */
function sembrarChico(){
  const cat = [
    nuevaPersona({nombre:'Martín Bevilacqua', funcion:'Director de Fotografía', rubro:'04', tarifaRef:450000, condicion:'Monotributista', cuit:'20-28456789-3', dni:'28456789'}),
    nuevaPersona({nombre:'Lucía Ferrer',      funcion:'Jefa de Producción',      rubro:'03', tarifaRef:320000, condicion:'Monotributista', cuit:'27-31222444-8', dni:'31222444'}),
    nuevaPersona({nombre:'Diego Roldán',      funcion:'Gaffer',                  rubro:'05', tarifaRef:280000, condicion:'Monotributista', dni:'30111222'}),
    nuevaPersona({nombre:'Casa de alquiler — Cinecolor', funcion:'Paquete cámara + ópticas', rubro:'11', tarifaRef:900000, condicion:'Responsable Inscripto', tipo:'proveedor'}),
    nuevaPersona({nombre:'Catering La Mesa',   funcion:'Almuerzo',               rubro:'13', tarifaRef:14000, unidad:'persona', condicion:'Monotributista', tipo:'proveedor'}),
  ];
  DB.catalogo.personas = cat;

  const v = nuevaVersion({nombre:'v1', tc:1420, tcNombre:'MEP'});
  const set = (cod, lineas)=>{ const r = v.rubros.find(x=>x.codigo===cod); r.lineas = lineas; r.abierto = true; };
  set('02',[ nuevaLinea({concepto:'Director', valorUnit:600000, dias:1, circuito:'transferencia', comprobante:'facBC'}),
             nuevaLinea({concepto:'Ayudante de Dirección (1° AD)', valorUnit:280000, dias:1, circuito:'transferencia', comprobante:'facBC'}) ]);
  set('03',[ nuevaLinea({concepto:'Jefa de Producción', refId:cat[1].id, refTipo:'persona', valorUnit:320000, dias:3, circuito:'transferencia', comprobante:'facBC'}),
             nuevaLinea({concepto:'Asistente de Producción', valorUnit:150000, dias:2, circuito:'efectivo', comprobante:'reciboS'}),
             nuevaLinea({concepto:'Fijador', valorUnit:90000, dias:1, unidad:'global', circuito:'efectivo', comprobante:'ninguno'}),
             /* la caja chica de producción: de ahí salen los fondos (💵 Dar fondo) */
             nuevaLinea({concepto:'Caja chica de producción', valorUnit:300000, unidad:'global', circuito:'efectivo', comprobante:'ninguno'}) ]);
  set('04',[ nuevaLinea({concepto:'Director de Fotografía', refId:cat[0].id, refTipo:'persona', valorUnit:450000, dias:1, circuito:'transferencia', comprobante:'facBC'}),
             nuevaLinea({concepto:'Foquista', valorUnit:190000, dias:1, circuito:'transferencia', comprobante:'facBC'}) ]);
  set('11',[ nuevaLinea({concepto:'Paquete cámara + ópticas', refId:cat[3].id, refTipo:'persona', valorUnit:900000, dias:1, circuito:'transferencia', comprobante:'facA'}),
             nuevaLinea({concepto:'Paquete de luces', valorUnit:520000, dias:1, circuito:'transferencia', comprobante:'facA'}) ]);
  set('13',[ nuevaLinea({concepto:'Almuerzo', refId:cat[4].id, refTipo:'persona', cantidad:32, dias:1, unidad:'persona', valorUnit:14000, circuito:'efectivo', comprobante:'reciboS'}) ]);
  set('09',[ nuevaLinea({concepto:'Actor Principal', valorUnit:1200, moneda:'USD', dias:1, circuito:'transferencia', comprobante:'facBC'}),
             nuevaLinea({concepto:'Buyout / Cesión de derechos — Digital 12 meses AR', valorUnit:1800, moneda:'USD', unidad:'global', circuito:'transferencia', comprobante:'facBC'}) ]);

  const py = nuevoProyecto({nombre:'Spot Verano — 30"', cliente:'Marca X', agencia:'Agencia Y',
    producto:'Bebida', jornadas:1, versiones:[v]});
  const pr = nuevaProductora({nombre:'Productora Demo', cuit:'30-71234567-9', proyectos:[py]});
  DB.productoras = [pr];
  DB.ui.productoraId = pr.id; DB.ui.proyectoId = py.id; DB.ui.versionId = v.id;

  /* Equipo de ejemplo: uno por rol, para que el circuito se pueda probar de
     entrada sin tener que cargar gente antes de ver nada.                    */
  pr.usuarios = [
    nuevoUsuario({nombre:'Sofía Roldán',  rol:'equipo',     depto:'Arte',           tel:'11 5555-1001', email:'sofia@ejemplo.com'}),
    nuevoUsuario({nombre:'Lucía Ferrer',  rol:'produccion', depto:'Producción',     tel:'11 5555-1002', email:'lucia@ejemplo.com'}),
    nuevoUsuario({nombre:'Tomás Vidal',   rol:'ejecutivo',  depto:'Producción',     tel:'11 5555-1003', email:'tomas@ejemplo.com'}),
    nuevoUsuario({nombre:'Marta Giles',   rol:'admin',      depto:'Administración', tel:'11 5555-1004', email:'marta@ejemplo.com'}),
    nuevoUsuario({nombre:'Paula Ríos',    rol:'asistdir',   depto:'Dirección',      tel:'11 5555-1005', email:'paula@ejemplo.com'}),
    nuevoUsuario({nombre:'Diego Sosa',    rol:'asistprod',  depto:'Producción',     tel:'11 5555-1006', email:'diego@ejemplo.com'}),
    nuevoUsuario({nombre:'Carla Méndez',  rol:'arte',       depto:'Arte',           tel:'11 5555-1007', email:'carla@ejemplo.com'}),
  ];
  const [uArte, uProd, uEjec, uAdmin, , uAsistP, uAsistA] = pr.usuarios;
  DB.ui.usuarioId = uEjec.id;
  py.invitados = pr.usuarios.map(u => u.id);
  /* una tarea encargada y un cheque pedido, para ver el circuito */
  py.tareas = [nuevaTarea({titulo:'Pedir tres cotizaciones de cámara', detalle:'Para las jornadas del plan; que incluyan seguro',
    asignadoA:uAsistP.id, creadaPor:uProd.id})];
  py.cheques = [nuevoCheque({a:'Utilería El Baúl', monto:150000, motivo:'Garantía del alquiler de utilería',
    pedidoPor:uAsistA.id, historial:[{a:'pedido', quien:uAsistA.nombre, cuando:hoy()}]})];

  /* Un movimiento de cada tipo, para que ninguna pantalla arranque vacía. */
  const oc = nuevaOC({numero:'OC-0001', rubro:'11', subrubro:'Paquete de luces',
    proveedor:'Rental Sur', importe:520000, estado:'emitida', emitidaPor:uEjec.id,
    condicion:'50% anticipo, 50% contra entrega',
    historial:[{a:'emitida', usuario:uEjec.nombre, fecha:hoy()}]});
  py.ocs = [oc];

  const caja = nuevaCaja({nombre:'Caja de arte', responsable:uArte.id, jornada:1,
    adelantos:[{id:uid('ad'), fecha:hoy(), importe:200000, circuito:'efectivo',
      entregadoPor:uProd.id, nota:'Adelanto para compras'}]});
  py.cajas = [caja];

  const paso = (de,a,accion,usr) => ({de, a, accion, usuario:usr.nombre, usuarioId:usr.id,
    rol:usr.rol, fecha:hoy(), nota:''});
  py.comprobantes = [
    nuevoComprobante({rubro:'11', subrubro:'Paquete de luces', proveedor:'Rental Sur',
      cuit:'30-70111222-3', tipo:'facA', numero:'0001-00009911', importe:300000,
      circuito:'transferencia', ocId:oc.id, estado:'revisado', cargadoPor:uProd.id,
      historial:[paso(null,'cargado','cargar',uProd), paso('cargado','revisado','revisar',uProd)]}),
    nuevoComprobante({rubro:'06', subrubro:'Compras de arte', proveedor:'Pinturería Norte',
      tipo:'facBC', numero:'0003-00000455', importe:45000, circuito:'efectivo',
      cajaId:caja.id, estado:'cargado', cargadoPor:uArte.id, notas:'Telas y pintura',
      historial:[paso(null,'cargado','cargar',uArte)]}),
    nuevoComprobante({rubro:'06', subrubro:'Utilero', proveedor:'Feria de Once',
      tipo:'ninguno', importe:30000, circuito:'efectivo', cajaId:caja.id,
      estado:'cargado', cargadoPor:uArte.id, notas:'Sin comprobante, se pagó en la feria',
      historial:[paso(null,'cargado','cargar',uArte)]}),
    nuevoComprobante({rubro:'13', subrubro:'Almuerzo', proveedor:'Catering La Mesa',
      tipo:'facBC', numero:'0002-00001180', importe:448000, circuito:'transferencia',
      estado:'pagado', cargadoPor:uProd.id,
      historial:[paso(null,'cargado','cargar',uProd), paso('cargado','revisado','revisar',uProd),
        paso('revisado','aprobado','aprobar',uEjec), paso('aprobado','pagado','pagar',uAdmin)]}),
  ];

  /* Una rendición de ejemplo, ya mandada al jefe: el asistente de producción
     recibió $ 150.000 y rinde cinco tickets (todo inventado). */
  const uJefe = uProd;
  /* el fondo sale de la caja chica de producción del presupuesto */
  const lCaja = v.rubros.find(x => x.codigo === '03').lineas.find(l => l.concepto === 'Caja chica de producción');
  const fondo = nuevaCaja({nombre:'Fondo de producción', responsable:uAsistP.id, jornada:null, lineaId:lCaja.id,
    adelantos:[{id:uid('ad'), fecha:hoyMas(-4), importe:150000, entregadoPor:uJefe.id, nota:'Para el scouting y la preproducción', lineaId:lCaja.id}]});
  fondo.rendicion = {estado:'enviada',
    pasos:[{id:uid('rp'), de:'borrador', a:'enviada', quienId:uAsistP.id, quien:uAsistP.nombre, rol:uAsistP.rol, cuando:hoy()+' 18:40', nota:''}],
    charla:[{id:uid('rm'), quienId:uAsistP.id, quien:uAsistP.nombre, rol:uAsistP.rol, cuando:hoy()+' 18:41', gastoId:null,
      texto:'La descarga del camión fue sin comprobante: le pagué en mano al changarín.'}]};
  py.cajas.push(fondo);
  const tk = (o) => nuevoComprobante({moneda:'ARS', circuito:'efectivo', cajaId:fondo.id, estado:'cargado', cargadoPor:uAsistP.id,
    area:'produccion', historial:[paso(null,'cargado','cargar',uAsistP)], ...o,
    adjunto: o.tipo === 'ninguno' ? null : {nombre:`ticket-${norm(o.proveedor).replace(/[^a-z]+/g,'-').replace(/^-|-$/g,'')}.svg`, tipo:'image/svg+xml',
      dataUrl:ticketDeEjemplo(o), bytes:1200, w:300, h:440}});
  py.comprobantes.push(
    tk({rubro:'12', concepto:'Nafta para el scouting', proveedor:'Estación de servicio Ruta 2 (ejemplo)', cuit:'30-71234567-1',
        tipo:'facBC', numero:'00012-00004521', fecha:hoyMas(-4), importe:42000}),
    tk({rubro:'12', concepto:'Peaje', proveedor:'Autopista del Sol (ejemplo)', cuit:'30-70999888-5',
        tipo:'ticket', numero:'0003-00981234', fecha:hoyMas(-4), importe:3450}),
    tk({rubro:'03', concepto:'Cinta, precintos y pilas', proveedor:'Ferretería del Centro (ejemplo)', cuit:'20-33444555-1',
        tipo:'facBC', numero:'00002-00001877', fecha:hoyMas(-3), importe:18500}),
    tk({rubro:'13', concepto:'Desayuno del equipo de scouting', proveedor:'Panadería La Espiga (ejemplo)', cuit:'30-71555666-5',
        tipo:'ticket', numero:'0001-00045210', fecha:hoyMas(-3), importe:24300}),
    tk({rubro:'03', concepto:'Descarga del camión (changarín)', proveedor:'', tipo:'ninguno', fecha:hoyMas(-2), importe:50000}));
}

/* El guion de antes de "Probar con un guion de ejemplo" (Lucía, el perro, la
   plaza): las pruebas del callsheet, el rodaje y los contactos cuentan con sus
   personajes y sus cuatro escenas. */
const GUION_CHICO = `1. INT. COCINA DEPARTAMENTO - DÍA

Luz de mañana. LUCÍA (32) revuelve un mate mientras mira el celular
apoyado contra una taza. Sobre la mesa hay un diario abierto y las
llaves del auto.

LUCÍA
(sin levantar la vista)
Otra vez treinta y ocho grados.

Del pasillo llega un ladrido. El PERRO entra corriendo y se frena
en seco frente a la heladera.

CORTE A:

2. EXT. CALLE DEL BARRIO - DÍA

Lucía sale con la bicicleta. Un COLECTIVO pasa levantando polvo.
En la vereda hay GENTE haciendo cola frente a un kiosco. Un CARTEL
descolorido anuncia helados.

VECINO
¡Buen día!

Lucía saluda con la mano. Lleva anteojos de sol y una campera liviana.

3. EXT. PLAZA - ATARDECER

Un DRON sobrevuela la plaza. Cae una lluvia fina de los aspersores.
Lucía se moja la cara.

LUCÍA
Ahora sí.

4. INT. COCINA DEPARTAMENTO - NOCHE

Lucía abre la heladera y saca una botella. El perro la mira.

LUCÍA
Salud.

FIN`;
function guionChico(){ importarGuion(GUION_CHICO); }
