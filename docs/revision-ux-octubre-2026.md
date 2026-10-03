# Revisión de uso de CLAP · octubre de 2026

*Para Andrés. Qué se miró, qué andaba mal, qué se arregló y qué queda para decidir.
Se probó con el proyecto de ejemplo (Brisa — «Respirá») en las vistas por rol, en la
compu (1440 px) y en el celular (375 px), tocando las pantallas de verdad: dar un
fondo, subir tickets, mandar, revisar, elevar, cerrar, bajar el Excel y el PDF,
cargar comprobantes, citar, repartir tareas e invitar.*

**Cómo se hizo.** Dos miradas por separado: una revisión de diseño y de uso (la de
este documento) y una medición automática, pantalla por pantalla y rol por rol, de
contraste, tamaño de lo que se toca con el dedo, teclado, nombres para lectores de
pantalla y desbordes en el celu (124 pantallas). El detector de patrones de diseño
encontró una sola cosa y es una falsa alarma: el rayado de los bloques del plan de
rodaje, que marca un estado.

**No se cambió el aspecto.** Colores, letra, tarjetas y botones son los mismos.
Lo que cambió es orden, textos, avisos y comportamiento.

---

## 1. La nota

### Las diez reglas de uso (de 0 a 4)

| # | Regla | Antes | Después | Lo principal |
|---|---|---|---|---|
| 1 | Se ve qué está pasando | 3 | 3 | Buenos avisos con «Deshacer»; faltaban en los cheques y al volver una tarea a pendiente. |
| 2 | Habla como el medio | 3 | 4 | Rioplatense y con la jerga justa; se colaban claves internas («tareas · cheque») y «sin rendir» donde ya estaba rendido. |
| 3 | Se puede volver atrás | 3 | 3 | Deshacer en casi todo y Escape cierra; un comprobante rechazado era un callejón sin salida. |
| 4 | Lo mismo se hace igual en todos lados | 2 | 3 | Subir un ticket en la rendición lo leía; subirlo en «Cargar comprobante» no. El resumen del jefe estaba ordenado distinto al de Administración y el PE. Los avisos decían 2 y mostraban 3. |
| 5 | Evita el error antes de que pase | 2 | 3 | El mismo ticket subido dos veces se sumaba dos veces sin aviso. El jefe veía montos con el fee en las solapas de las piezas. |
| 6 | Se reconoce, no hay que acordarse | 3 | 3 | Bandejas «esperan algo» con número y flecha; bien. |
| 7 | Atajos para el que ya sabe | 3 | 3 | Enter pasa al campo siguiente en la planilla, links directos, filtros. |
| 8 | Sólo lo necesario | 3 | 3 | Denso pero ordenado; en el celu el encabezado se come un tercio de la pantalla. |
| 9 | Ayuda a salir del error | 2 | 3 | El motivo del rechazo no se veía en la lista ni en el panel; errores con ventanitas del navegador. |
| 10 | Ayuda y explicación | 3 | 3 | El Instructivo y las explicaciones al pie de cada bloque están bien. |
| | **Total** | **27/40** (aceptable) | **31/40** (bien) | |

### La parte técnica (de 0 a 4)

| | Antes | Después | Lo principal |
|---|---|---|---|
| Accesibilidad | 2 | 3 | Las ventanas no se llevaban el teclado; filas con transparencia ilegibles; botones «+» sin nombre. |
| Rendimiento | 3 | 3 | Una sola página grande, pero lo pesado (leer PDF, OCR) se baja recién cuando hace falta. |
| Celular | 2 | 3 | La hora de las citaciones se cortaba («06:3»); solapas de 39 px de alto. |
| Colores y estilos | 3 | 3 | Ordenados con variables; no hay modo oscuro (no hace falta hoy). |
| Coherencia | 3 | 3 | El sistema se nota pensado para esto; un patrón (las ventanitas del navegador) desentona. |
| **Total** | **13/20** | **15/20** | |

---

## 2. Lo que se encontró, de lo más grave a lo menos

**P0** frena el trabajo · **P1** confunde o hace perder plata o tiempo · **P2** molesta, hay
forma de esquivarlo · **P3** detalle.

### P0 — arreglados

| Pantalla | Qué pasaba | Por qué importa | Qué se hizo |
|---|---|---|---|
| Presupuesto (jefe) | Las solapas de las piezas (General, Spot 30″…) mostraban $ 119–121 M: el total con fee e IVA. | El jefe no tiene que ver nada que salga del margen. Se filtraba por ahí. | Ahora muestran el costo de producción ($ 89.093.890 el General), igual que la barra de abajo. El PE y Administración siguen viendo el total. |

### P1 — arreglados

| Pantalla | Qué pasaba | Por qué importa | Qué se hizo |
|---|---|---|---|
| Rendición (planilla) | El mismo ticket subido dos veces (la foto y el PDF, o dos fotos) se sumaba dos veces sin decir nada. | Es plata: el asistente rinde de más y el jefe no lo ve. | La fila dice «¿Repetido? Es igual al ticket 1: si es el mismo, borrá uno» (mismo archivo, mismo número de factura —aunque tenga otros ceros adelante— o mismo importe, fecha y proveedor). Lo repite al mandar y al elevar. No borra nada solo. |
| Gastos → Cargar comprobante | Subir la foto no leía nada (en la rendición sí), y en el celu la foto estaba al fondo, después de 15 campos. | Lo mismo funcionaba distinto; en el set obligaba a escribir todo a mano. | La foto va arriba de todo. Al subirla, CLAP lee el QR de AFIP, el PDF o la foto y completa los campos vacíos en amarillo («Leído de la foto: revisá lo amarillo antes de cargar»). Lo que ya escribiste no se toca. |
| Gastos y Mi panel (Equipo, asistentes) | Un comprobante rechazado decía «Rechazado» y nada más; el motivo había que buscarlo adentro. | Sofía no sabía por qué ni qué hacer con el taxi. | En la lista: «Lo rechazó Diego Sosa: «Sin ticket…» · cargalo de nuevo cuando lo tengas». En su panel aparece también, con el motivo, y se abre con un toque. |
| Rodaje → Citaciones (celu) | La hora se cortaba («06:3») porque la tabla se apretaba. | Es el dato principal de la pantalla. | En el celu la tabla se corre de costado en vez de cortar la hora. |
| Plan → Armar el día | En la J2 ponía el almuerzo a las 10:50 (4 h 20 después de la citación) y después ocho horas seguidas. | Nadie come a esa hora; la propuesta quedaba inservible. | Ahora parte el día en dos mitades parecidas sin pasarse de las horas hasta la comida: la J2 queda a las 12:30. |
| Plan contra el presupuesto | La solapa y el resumen decían «2» y se mostraban 3 tarjetas (se pasa, falta, sobra). | Un número que no coincide hace dudar de todo lo demás. | Se cuentan las tres en todos lados: solapa, encabezado, resumen y el panel de la asistente de dirección. |
| Resumen del jefe | Lo que espera algo de él estaba debajo del tipo de cambio, los cinco números y la lista de proyectos. | El jefe es el que más entra; lo primero que tiene que ver es qué le toca. | «Esperan algo» va primero, como en Administración y el PE. |
| Mi panel del asistente de producción | «Rendiciones de arte para revisar» estaba debajo de sus comprobantes y sus rendiciones. | Es lo que espera algo de él. | Va pegado a sus tareas (sólo si hay algo para revisar; si no, abajo). |
| Mi panel del asistente de producción | El lavadero de Sofía (vestuario) figuraba como «comprobante suelto de arte». | Departamento equivocado. | Dice «del equipo» (o «de arte», o «de arte y del equipo», según de quién sean). |
| Mi panel del Equipo | «Volvé a confirmar con tu link» sin forma de hacerlo desde ahí. | El siguiente paso no estaba a mano. | Cuando el link de su citación ya existe (con la base conectada), aparece «Confirmar las 06:00» ahí mismo. En la vista de prueba no se ve porque no hay base. |
| Desglose → Presupuesto | Venía todo tildado (mandarlo duplicaba el presupuesto: «CAMI» al lado de «Actriz principal») y no aparecían el menor ni la vía pública. | Un toque de más duplicaba quince líneas. | Reconoce lo que ya está aunque se llame distinto (por el personaje de la línea, las palabras de la locación o lo agrupado) y lo trae destildado diciendo con cuál línea se parece. Propone el menor, su chaperona, el permiso de menores y el permiso de vía pública; en el ejemplo, todo eso ya está cubierto. |
| Pedido de luces | Decía «$ 4.484.273 total» sin aclarar que es con IVA (la planilla del rental dice $ 4.117.790). | Dos números distintos para lo mismo. | «total con IVA» (o «sin IVA»), el neto sin IVA debajo, y una fila «Neto, sin IVA» en los totales. |
| Dar un fondo · Cerrar la rendición | Pedían la fecha además del monto. | Pediste «sólo el monto». | La fecha queda plegada («Se lo diste otro día · 03/10/2026»), con hoy puesto. Se sigue guardando igual. |
| Citaciones | «Re-citar a el que cambió». | Se lee mal. | «Re-citar al que cambió». |
| Todas las ventanas (teclado) | Al abrir una ventana el teclado se quedaba en la pantalla de atrás, y con Tab se seguía tocando lo de atrás. | Para quien usa el teclado (o un lector de pantalla), la ventana no existía. | El foco entra a la ventana, lo de atrás queda bloqueado mientras está abierta y al cerrar vuelve al botón que la abrió. En el celu no enfoca un campo (no abre el teclado de golpe). |
| Citaciones y tareas | Las filas «ya citado» y las tareas hechas se apagaban con transparencia: el botón WhatsApp quedaba a 2,9:1 de contraste. | No se leen al sol, en el set. | Texto en gris en vez de transparencia (7:1). |
| Celu | Las solapas y los botones de sección medían 39 px de alto. | Se tocan con el dedo. | 44 px en pantallas táctiles. |
| Desglose | Los botones «+» de cada fila no tenían nombre para un lector de pantalla. | | «Agregar al elenco», «Agregar a Utilería»… |

### P2 y P3 — arreglados de paso

- «en mano, sin rendir» en la lista de rendiciones → «en mano, sin cerrar» (lo que suma ya está rendido; lo que falta es cerrarlo).
- Gastos de quien sólo carga: «2 para vos» → «2 cargados».
- Equipo y roles, columna Puede: «tareas · cheque» → «repartir tareas · pedir cheques».
- Invitar, desde el jefe: arranca en «Asistente de producción» (antes en «Jefe de producción»).
- Planilla de la rendición: un segundo botón «Mandar al jefe de producción» al pie de los gastos, que es donde se termina de completar en el celu; en un celular el cuadro de subir dice «Sacale una foto a cada ticket…» en vez de «Soltá acá».
- Avisos que faltaban: al aprobar, entregar o rechazar un cheque, y al volver una tarea a pendiente.
- «Saltar al contenido» para el teclado (invisible si no se usa).
- El desplazamiento suave respeta a quien pidió menos movimiento.
- El Excel de la rendición se bajaba con un guion colgando en el nombre.

### Lo que queda, para que decidas

| Prioridad | Pantalla | Qué pasa | Qué haría |
|---|---|---|---|
| P2 | Encabezado en el celu | Ocupa entre el 34 % y el 42 % de la primera pantalla (productora, proyecto, quién soy, ☁, Datos, cada uno en su renglón). | Juntar productora y proyecto en un renglón y esconder el subtítulo de CLAP en el celu. Cambia cómo se ve arriba: por eso no lo toqué. |
| P2 | Varias | Comentar un gasto, devolver una rendición, terminar una tarea y algunos errores usan las ventanitas del navegador (escribir en un recuadro gris). | Pasarlas a las ventanas de CLAP, con el error al lado del campo. |
| P2 | Plan de rodaje | Los planos filmados se apagan al 55 %: el texto queda a 2,3–2,5:1. | Mostrar «filmado» con el tachado y un gris en vez de transparencia, como se hizo con las citaciones. Es una decisión de cómo se ve el plan. |
| P2 | Presupuesto y Pedido de luces (celu) | La «×» de cada línea mide 18×23 px; los botones J1/J2 del pedido, 28×19 px y pegados al precio. | Agrandarlos en pantallas táctiles. Son pantallas de compu, por eso quedaron para después. |
| P2 | Desglose | Del guion de Brisa no detecta a los corredores como extras (sí a los vecinos) ni al nene como personaje (lo detecta como «menores»). | Ajustar la lectura del guion. No es un error de los datos del ejemplo. |
| P2 | Solapas en el celu | Se corren de costado pero no hay ninguna señal de que hay más. | Un degradé o una flechita al borde. |
| P3 | Resumen del PE y Administración | «Rendiciones que esperan algo tuyo» muestra también la que tiene que revisar el jefe (porque el PE puede hacer todo). | Separar «esperan a vos» de «las podés ver». |
| P3 | Mi panel | «Lo tuyo en CLAP» repite las solapas de arriba. | Dejarlo sólo en el celu, o sacarlo. |
| P3 | Varias | Emojis como íconos (💵 Dar fondo, 💬, ☁). | Íconos dibujados, todos del mismo trazo. Es estética. |
| P3 | Lectores de pantalla | 94 campos se llaman «Concepto» en el presupuesto sin decir de qué línea; no hay títulos de primer nivel; los avisos se crean al mostrarse. | Ponerles el nombre de la línea; un título por pantalla. |
| P3 | Rendición en el celu | La planilla por rubro se corre de costado; «Sacar foto» es secundario aunque en el set es lo principal. | Planilla apilada en el celu; «Sacar foto» primero en pantallas táctiles. |

---

## 3. Lo que está muy bien

- **El circuito de la rendición es de verdad el de una productora**: el fondo sale de una línea del presupuesto, arte pasa por el asistente de producción, el jefe eleva, Administración cierra con la devolución. Cada paso firmado, con «Deshacer», y el aviso de arriba siempre dice qué toca y a quién («La mandó Diego Sosa. Revisala: si está bien, elevala…»).
- **Leer los tickets**: del QR de AFIP, del PDF o de la foto, todo en el navegador y sin pagar nada; lo leído queda en amarillo «a confirmar». Probado con una foto y un PDF: leyó tipo, número, fecha e importe.
- **El Excel y el PDF de la rendición** salen listos para entregar: carátula, por rubro con subtotales que son fórmulas, detalle, y los tickets pegados en hojas.
- **Las bandejas «Esperan algo»** con número, en el idioma del medio («1 sin citar para la jornada 2 (1 con la hora vieja)»), y una flecha que lleva al lugar exacto.
- **Quién ve qué** está cuidado en cada pantalla: los asistentes no ven montos del presupuesto en ningún lado (lo que se encontró fueron las solapas de las piezas del jefe, ya corregido).
- **El celu ya estaba pensado**: campos de 16 px para que el iPhone no agrande la pantalla, filas del presupuesto apiladas, botones de 44 px.

---

## 4. Textos que cambiaron en pantalla (para rehacer capturas)

1. Rendiciones (lista): «en mano, sin rendir» → **«en mano, sin cerrar»**.
2. Citaciones: «Re-citar a el que cambió» → **«Re-citar al que cambió»**.
3. Pedido de luces: arriba, «total» → **«total con IVA»** y debajo **«neto sin IVA $ …»**; en Totales, fila nueva **«Neto, sin IVA»** y «Total» → **«Total con IVA»**.
4. Panel del asistente de producción: «comprobante suelto de arte para revisar» → **«comprobante suelto del equipo para revisar»** (el de Sofía); y ese bloque ahora va **justo debajo de «Tus tareas»**.
5. Plan contra el presupuesto: «Contra el presupuesto · 2» y «2 avisos» → **«· 3»** y **«3 avisos»** (también en los resúmenes); el panel de Paula lista también el «Sobra».
6. Resumen del jefe: **«Esperan algo» va primero**, antes del tipo de cambio.
7. Presupuesto del jefe: las solapas de las piezas muestran **el costo de producción** ($ 89.093.890 el General, $ 88.090.090 el Spot 30″…).
8. Gastos, Mi bandeja de Sofía y Carla: «para vos» → **«cargados»**.
9. Comprobante rechazado: línea nueva en rojo **«Lo rechazó Diego Sosa: «…» · cargalo de nuevo cuando lo tengas»**; en el panel de Sofía, fila nueva debajo de «Tus comprobantes».
10. Cargar comprobante: **la foto va arriba**; el texto de ayuda dice «… o PDF · CLAP lee lo que puede y completa los campos vacíos».
11. Dar un fondo: la Fecha pasó a **«Se lo diste otro día · 03/10/2026»** (plegado) y la Nota quedó al lado de Cuánto. Cerrar la rendición: **«Lo devolvió otro día · …»** / «Se le reintegró otro día · …».
12. Invitar (jefe): «Entra como» arranca en **«Asistente de producción»**.
13. Equipo y roles, columna Puede: «tareas» → **«repartir tareas»**, «cheque» → **«pedir cheques»** (también en la ventana de persona nueva).
14. Planilla de la rendición: barra nueva al pie **«Mandar al jefe de producción · N gastos por $ … de $ …»**; en el celular, **«Sacale una foto a cada ticket, o subí las fotos y los PDF que ya tenés»**; fila repetida: **«¿Repetido? Es igual al ticket N: si es el mismo, borrá uno.»**
15. Desglose → Presupuesto: chips **«ya está: Actriz principal»**, etc.; líneas nuevas propuestas (menor, chaperona, permiso de menores, vía pública); el texto suma «(salvo los cargos del convenio SICA, que se completan solos)».
16. Armar el día (J2): el almuerzo queda a **las 12:30** (antes 10:50).
17. Citaciones: las filas ya citadas **ya no se ven transparentes** (texto gris). Tareas hechas: **fondo gris** en vez de transparencia.
18. Celu: solapas y botones de sección **más altos (44 px)**.

## 5. La base de datos

**No hay que correr ningún SQL.** No se tocó nada de la base. La prueba de la base
(`test/sql-gastos.mjs`, con PGlite) dio todo bien contra el `proyecto-completo.sql`
que está subido.

Ojo: en esta compu, `backend/proyecto-completo.sql` quedó reemplazado por una línea
que dice «ya corri el sql». No lo subí ni lo toqué. Si fue sin querer, se recupera
con `git checkout backend/proyecto-completo.sql`.
