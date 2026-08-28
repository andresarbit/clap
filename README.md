# CLAP

**C**ontrol, **L**ogística y **A**dministración de **P**roducción.

Sistema de gestión para productoras de publicidad y cine: presupuestos, equipo técnico,
equipamiento, seguros, callsheet y circuito de dinero. Pensado para que dos personas
administren muchas productoras al mismo tiempo.

## Estado

**v0.1 — prototipo del presupuestador.** Un solo archivo, `clap.html`.
Abrilo con doble clic en cualquier navegador; no necesita servidor ni instalación.
Los datos se guardan en el navegador (`localStorage`).

> ⚠️ Exportá el `.json` seguido (botón **Datos → Exportar todo**). Hasta que haya
> backend, ese archivo es el único respaldo y también la forma de pasarle el trabajo
> a la otra persona.

## Qué hace hoy

- **Multi-productora**: cada una con su CUIT, condición de IVA, jurisdicción y
  porcentajes por defecto (fee, contingencia, IVA, IIBB). Los proyectos viven adentro
  de cada productora, aislados.
- **Catálogo compartido de verdad**: personas, proveedores y equipamiento viven en la
  **base**, no en cada navegador. El que se da de alta queda en el catálogo solo, lo que
  cargás a mano sube, y lo que carga un compañero desde otra máquina aparece cuando
  entrás. Los ids son UUID de los dos lados, así que sincronizar no duplica.
  Arriba del listado se dice siempre si el catálogo es compartido, si es sólo de esa
  computadora (sin sesión), o si no se ve el del equipo porque el alta espera aprobación.
  Vive a nivel del estudio, no de cada productora. Incluye los datos fiscales y de seguro (DNI, CUIT,
  fecha de nacimiento) que después alimentan el alta de la aseguradora.
- **Presupuesto por rubros** (15 rubros de publicidad argentina precargados) con
  catálogo de ~90 funciones para cargar líneas rápido.
- **Multi-moneda**: cada línea en ARS o USD, con tipo de cambio de referencia
  (Oficial / MEP / CCL / Blue / pactado) y **fecha de cotización** — es lo que después
  permite reclamar el reajuste por diferencia de cambio. **El TC se escribe arriba
  del presupuesto, a mano**, y todo se recalcula solo: es el número que más se toca.
  Al cambiar el valor la fecha se sella con el día de hoy (y se puede corregir a mano,
  para cargar la cotización de un día pasado). Un cero o un negativo se rechazan:
  dejarían todas las líneas en USD valiendo nada, sin avisar.
- **Capas de cálculo**: subtotal → fee (sólo sobre los rubros marcados) → contingencia
  → IIBB → IVA → total. Elenco y seguros van sin fee por defecto.
- **Versionado**: duplicar una versión crea una copia independiente. v1 nunca se pisa.
- **Vista Interna / Vista Cliente**: la del cliente muestra sólo el resumen por rubro,
  sin detalle de líneas ni circuito de pago.
- **Circuito de pago y respaldo documental** por línea (transferencia / efectivo /
  cripto · factura A / B-C / recibo simple / sin comprobante), con un panel de
  reconciliación que muestra qué porcentaje del costo está bancarizado y cuánto
  tiene respaldo fiscal.
- Export **JSON** (respaldo completo), export **CSV**, e impresión a **PDF**.
- Funciona en el celular (las filas se convierten en tarjetas).

### Desglose de guion

**El flujo es de tres pasos y nada pasa solo:** pegás o subís el guion →
tocás **Desglosar** y lo revisás en esta solapa → recién ahí tocás **→ Presupuesto**.
Desglosar NO toca el presupuesto. Mientras escribís, un cartel abajo del cuadro de
texto va diciendo en vivo cuántas escenas encuentra, o por qué no encuentra ninguna.

- **Parser** de formato estándar y Fountain: separa escenas, INT/EXT, locación,
  momento del día, personajes con diálogo y extensión en **octavos de página**.
  Esto es determinístico, no adivina.
- Acepta encabezados de guion de cine (`INT. COCINA - DÍA`) y **de publicidad**
  (`ESCENA 1`, `SEC. 1`, `PLANO 3`, `TOMA 2`), que suelen venir sin INT/EXT.
- **Y guiones sin ningun encabezado**, que es como viene la mayoria de la
  publicidad. Si no encuentra encabezados corta por parrafo e **infiere** la
  locacion, el INT/EXT y el momento del texto; lo que un bloque no nombra lo
  hereda del anterior. Tambien aplana una **tabla VIDEO | AUDIO** pegada de Word
  (cada fila es un plano) y parte un guion escrito de corrido por las frases que
  abren plano ("Corte a", "Vemos", "Abrimos en", "Primer plano"...).
- Un cartel arriba deja claro cuando el desglose fue **inferido** y no leido, y
  cada escena trae **Unir con la anterior**, **Dividir** (se elige el renglon
  donde arranca la escena nueva) y **Eliminar**, mas **+ Escena** al final.
- En cada escena, el **INT/EXT se cambia con un click** y la locación y el momento
  se editan en el lugar: el parser propone, vos corregís.
- **Detección de elementos por diccionario** en 12 departamentos (utilería, vestuario,
  vehículos, animales, efectos, riesgo, equipo especial…). Lo detectado aparece con
  borde punteado: es una **sugerencia que se confirma o se borra**. Se puede agregar
  a mano lo que el diccionario no ve.
- `Re-detectar` vuelve a pasar el diccionario **conservando lo que agregaste a mano**.
- **Plan de rodaje**: auto-agrupa por locación + INT/EXT + momento, llenando jornadas
  hasta un tope de páginas configurable. Es un punto de partida, no un plan final.
- **→ Presupuesto**: convierte el desglose en líneas del presupuesto con el concepto,
  la cantidad y los días ya calculados. Los valores quedan en cero: los pone una persona.
- Export del desglose a **CSV**.

**Formatos que acepta**: `.pdf` · `.docx` · `.doc` · `.rtf` · `.fdx` (Final Draft) ·
`.txt` · `.fountain`. Sin librerias externas: el `.docx` es un ZIP y los streams del
PDF se inflan con el `DecompressionStream` que ya trae el navegador.

| Formato | Calidad | Nota |
|---|---|---|
| `.fdx` | Perfecta | Trae el tipo de cada parrafo marcado |
| `.txt` `.fountain` | Perfecta | |
| `.docx` `.rtf` | Muy buena | |
| `.pdf` | Buena | Solo PDF de texto. Un PDF escaneado es una imagen: avisa y pide OCR |
| `.doc` | Aproximada | El binario viejo de Word no tiene lectura limpia; conviene guardarlo como `.docx` |

El texto extraido se muestra **antes** de desglosar, para revisarlo.

### Callsheet

La solapa tiene **dos documentos distintos**, porque son dos cosas:

- **Hoja de citacion** — POR JORNADA. Quien viene manana, a que hora, a que
  direccion, que escenas se filman.
- **Lista de contactos** — DEL PROYECTO. Todos los implicados con telefono y
  mail: produccion, cliente, agencia, cada departamento tecnico, elenco,
  proveedores y locaciones. Se arma sola a medida que se cargan los
  profesionales: lo que esta enlazado al catalogo trae nombre, telefono y mail
  solos, y lo que se carga a mano se puede mandar al catalogo con un boton para
  reusarlo en el proximo proyecto. Boton para **copiar todos los mails**,
  export a CSV e impresion.

> Una persona se carga **una sola vez**. Si esta enlazada al catalogo, editar su
> telefono en la lista de contactos lo cambia en el catalogo, y eso se ve en la
> hoja de citacion y en todos los proyectos.

La hoja de citacion se arma sola juntando las tres fuentes que ya estan cargadas:

- **del guion**: las escenas de esa jornada, con INT/EXT, locacion, momento, paginas y elenco
- **del presupuesto**: el equipo tecnico (lineas de los rubros 02 a 08), agrupado por departamento
- **del catalogo**: nombre y telefono de cada persona enlazada

Encima de eso se cargan a mano los datos que no salen de ningun lado: fecha, citacion,
comida, wrap, salida y puesta del sol, direccion y contacto de cada locacion, hospital
mas cercano, contacto de emergencia, clima, citaciones individuales y notas del dia.

Cada jornada guarda lo suyo. `Imprimir / PDF` saca una hoja A4 limpia: se ocultan los
controles de edicion, los campos quedan como texto y los bloques no se parten entre paginas.

> El diccionario está en la constante `DICC`. Sumar términos ahí mejora el desglose
> de todos los proyectos.

### Rodaje

La solapa que usa un **asistente de produccion en el set**, con el celu en la
mano. Por jornada, tres cosas:

- **Citaciones** — la lista de todos los que participan ese dia (tecnicos y
  elenco) con su hora. Cada uno tiene boton de **WhatsApp** y de **mail** que
  abren el mensaje ya escrito con su citacion, la locacion con direccion, las
  escenas, el wrap y el hospital. El mensaje lo manda la persona desde su propio
  WhatsApp o su mail: el sistema lo prepara y lo abre, no manda nada solo. Hay
  checkbox de "ya lo cite" y un boton para copiar las citaciones de todos.
- **Parte del dia** — horarios reales (primera toma, comida, ultima toma, wrap),
  que escenas se filmaron de las previstas, entradas y salidas de cada persona e
  incidencias. `Entrada = citacion de cada uno` y `Salida = wrap` cargan todo de
  una y despues se corrigen las excepciones; no pisa lo ya cargado a mano.
- **Horas y extras** — horas netas por persona (descontando la comida), horas
  extra sobre la jornada base y **cuanto cuestan**, usando el valor de jornada
  de su linea del presupuesto y en su moneda. Acumulado de todo el rodaje y
  aviso cuando el **descanso entre jornadas** queda por debajo del minimo.

Las condiciones (jornada base, recargo de hora extra, descanso minimo, si se
descuenta la comida) se configuran **por proyecto**, porque cambian segun el
convenio y el tipo de trabajo.

> Las horas extra no estan en el presupuesto: son desvio. Este es el modulo que
> te lo muestra el mismo dia y no un mes despues.

### Tarifario de convenio (SICA)

En `Catalogo -> Tarifario de convenio` esta embebida la **escala salarial de
publicidad del SICA**, sacada del PDF oficial con el mismo lector de PDF que usa
el desglosador. 41 cargos agrupados por departamento, con la jornada de 8 h, la
de 12 h con 4 extras, y el valor de la hora.

Aparece como referencia donde hace falta: al elegir una funcion para una linea
del presupuesto y en la ficha del catalogo.

> **Es un piso, no una tarifa.** Son brutos de convenio para relacion de
> dependencia. En publicidad la mayoria del crew factura como monotributista y
> cobra por encima. Sirve para no presupuestar por debajo del piso legal y para
> tener la referencia relativa entre categorias.

De esa escala sale tambien el default de la jornada: **8 horas base y las extras
al 50%**, que es lo que fija el convenio (la columna de 12 h del PDF es
exactamente 1,75x la de 8 h).

**Los valores vencen.** Estan marcados con su vigencia; cuando salga la paritaria
nueva hay que bajar el PDF de sicacine.org.ar y regenerar la constante:

```bash
node test/run.js test/leer-pdf.js  <escala.pdf>   # ver el texto crudo
node test/run.js test/sica-tabla.js <escala.pdf>  # -> JSON estructurado
node test/run.js test/gen-sica.js   <escala.json> # -> constante JS
```

### Equipo y Gastos

El circuito real de una factura, con cada paso firmado:

```
carga el departamento -> revisa produccion -> aprueba el ejecutivo -> paga administracion
                      \-> rechaza (con motivo, vuelve a quien la cargo)
```

- **Equipo** — cada persona con su rol. `Equipo/Departamento` carga; `Produccion`
  ademas revisa; `Productor Ejecutivo` ademas aprueba; `Administracion` ademas paga.
- **Gastos** — cada uno abre en **su bandeja**: quien carga ve lo suyo, quien
  revisa ve lo que espera algo de el. Foto del comprobante desde la camara del
  celular (se achica sola: una foto de 2400x3200 queda en ~16 KB).
- **Presupuesto vs real** — rubro por rubro: presupuestado, cargado, pagado,
  avance y desvio. Lo rechazado no suma.
- Cada comprobante guarda su **recorrido**: quien hizo que, cuando, y el motivo
  si lo rechazaron.

> **Esto todavia no es seguridad.** Sin servidor no hay contrasenas: el selector
> "Soy" simula quien sos para que cada rol vea su bandeja, pero cualquiera que
> abra el archivo puede cambiarse de rol. El modelo de datos y el circuito ya son
> los definitivos: cuando haya backend se reemplaza el selector por un login y no
> cambia nada mas.

### El modulo de plata

Cinco sub-vistas en **Gastos**:

- **Mi bandeja** — lo que espera algo de vos, segun tu rol.
- **Comprobantes** — todos, con **filtro por rubro, por estado y buscador**, el
  total de lo filtrado y export a CSV para el contador (una fila por
  comprobante, con su rubro para que se impute donde corresponde).
- **Ordenes de compra** — el compromiso ANTES de la factura. Una OC emitida
  reserva plata del presupuesto; a medida que llegan comprobantes imputados a
  ella, el comprometido baja y el real sube, asi **la misma plata no se cuenta
  dos veces**. Cargar una factura contra una OC arrastra rubro, subrubro y
  proveedor: no hay que volver a elegirlos.
- **Caja chica** — se le adelanta plata a alguien, esa persona gasta y despues
  rinde. Muestra entregado, gastado, saldo en mano y **cuanto no tiene
  comprobante**. Al rendir calcula si tiene que devolver o si hay que
  reintegrarle, y queda cerrada con fecha y notas.
- **Tablero** — Presupuestado · Comprometido · Real · Pagado · **Disponible**,
  rubro por rubro.

```
Disponible = presupuestado - comprometido - real
```

> Cada comprobante lleva **rubro obligatorio** (no deja guardar sin el) y
> subrubro de la taxonomia. Por eso todo suma solo, y administracion puede
> sacar "todas las facturas de arte" con un filtro.

### Catalogo: buscador con disponibilidad

`Catalogo` es un buscador, no una lista:

- **Buscar** por nombre, funcion, mail, telefono, CUIT o DNI.
- **Filtrar** por rubro y por tipo (personas / proveedores / equipamiento).
- **Disponibilidad**: se elige un rango de fechas y dice quien esta **libre** y
  quien **ocupado**, con en que proyecto y cuantas jornadas. Mira **todas las
  productoras**: el mismo gaffer puede estar tomado por otra que tambien
  administras. Hay un "mostrar solo los libres" para armar equipo rapido.

### Armar el catalogo desde callsheets viejos

Boton **⬇ Importar de callsheets**: se sueltan los archivos y de cada uno se
sacan nombre, funcion, telefono y mail. Acepta PDF, Word, RTF y txt, varios a
la vez.

- **Unifica**: la misma persona aparece en todos los callsheets del rodaje. Se
  junta por mail, telefono o nombre, completando los campos que falten entre
  apariciones, y dice en cuantos archivos aparecio.
- **No pisa lo que ya esta**: marca los que ya estan en el catalogo.
- **Se revisa antes de guardar**: cada candidato muestra la linea cruda de la
  que salio, y se tildan los que van. La lectura es heuristica y algun nombre
  puede salir cortado.
- Lo que tiene funcion reconocida entra como **persona**; lo demas (el hospital,
  la casa de alquiler) como **proveedor**.
- Si la funcion existe en el convenio, la tarifa de referencia arranca en el
  piso del SICA.

> Dos callsheets de 24 lineas cada uno dan 24 contactos unicos, no 48.

### Tags: que cosas hay en el proyecto

`Desglose -> Tags`. No son etiquetas decorativas: **cada una arrastra permisos,
seguros o gente especializada**, y eso es lo que hay que resolver antes de rodar.

Se detectan solas del guion y dicen **por que** y **en que escena**:

```
Menores de edad     detectado en el guion     Escenas 2 · por: nena
   ☐ Permiso de trabajo de menores
   ☐ Tutor o adulto responsable en set
   ☐ Jornada reducida y horario permitido
   ☐ Autorizacion de los padres
```

16 tags: menores, animales, drone, armeria, riesgo, efectos, nocturno, via
publica, vehiculos, agua, altura, multitud, construccion, VFX, estudio y rodaje
fuera de la ciudad. Se agregan y se sacan a mano — sacar uno detectado sirve
para descartar un falso positivo, y queda registrado.

Los chips aparecen en la **portada**, y tocando cualquiera se llega a lo que
pide.

### Areas (rubros dentro de rubros)

El **rubro** dice QUE es el gasto; el **area** dice DE QUIEN es. Sin eso, la
nafta de arte y la de produccion caen en la misma bolsa y despues no se sabe
quien se paso.

```
Combustible  $ 155.000  repartido:
   Arte                  $  45.000
   Produccion            $  78.000
   Fotografia y Camara   $  32.000
```

Cada comprobante y cada orden de compra llevan area. Se propone sola desde el
rubro y se puede cambiar. La sub-solapa **Areas** muestra el gasto por
departamento y, abajo, **los conceptos repartidos entre varias areas** — que es
exactamente el caso de la nafta. El filtro y el CSV tambien la traen.

Ademas, los gastos que existen en todas las areas (combustible, movilidad,
fletes, compras varias, viaticos, alquiler de vehiculo) se agregan como
subrubro a cada rubro de departamento, asi la nafta se puede presupuestar
dentro de arte si la productora lo prefiere.

**Cada rubro tiene su area**, salvo dos que son transversales: **equipamiento y
alquileres** y **transporte y viajes**. Ahi gastan varios departamentos — camara
alquila camara, arte alquila utileria, cada uno pone su nafta — y el **area es
obligatoria**: sin ella el numero no dice de quien es el gasto. El formulario lo
avisa al elegir el rubro, no recien al guardar.

**Y hay rubros que no se miden por area sino por DIA DE RODAJE:** el catering y
la seguridad no los gasta un departamento, se gastan por jornada. En esos la
**jornada es obligatoria** y la pregunta no es de quien es el gasto sino cuanto
sale el dia:

```
jornada     catering   seguridad   otros del dia   total     p/ cabeza
J1           420.000      80.000          45.000   545.000    52.500 · 8 personas
J2           385.000           —          78.000   463.000    48.125 · 8 personas
J3           410.000           —               —   410.000    51.250 · 8 personas
Total      1.215.000      80.000         123.000 1.418.000    50.625 · promedio
```

El **catering por cabeza** sale de dividir por la gente citada ese dia, que ya
esta en el callsheet.

**Matriz rubro × area.** La vista que contesta las dos preguntas a la vez:

```
rubro                        Producción  Fotografía        Arte  Sin área      TOTAL
11 Equipamiento y Alquileres     90.000           ·     120.000   300.000    510.000
12 Transporte y Viajes           78.000     272.000     320.000         ·    670.000
13 Catering                           ·           ·           ·   508.000    508.000
TOTAL POR ÁREA                  168.000     272.000     440.000   883.000  1.778.000
```

Cuanto mas pesa una celda dentro de su rubro, mas fuerte se pinta. La columna
**Sin area** aparece resaltada, y arriba hay un aviso con cuantos comprobantes
transversales quedaron sin asignar y un boton para ir a corregirlos.

**Las lineas del presupuesto tambien llevan area**, con un chip al lado del
circuito de pago y el comprobante. Por eso la matriz tiene tres modos:

```
                    Presupuestado        Real       Disponible
Producción             1.350.000       78.000        1.272.000
Dirección                880.000            —          880.000
Fotografía y Cámara    2.060.000      240.000        1.820.000
Sin área                 448.000      748.000         -300.000
TOTAL                  8.998.000    1.306.000        7.692.000
```

Si una linea no tiene area, se le asigna la del rubro — salvo en los
transversales, donde deducirla seria inventar y queda como "sin area".

El puente **desglose → presupuesto** ya crea las lineas con su area puesta.

### Rubros internos

**17 rubros y 234 subrubros**, en `RUBROS_BASE` y `FUNCIONES`. Es la misma
taxonomia con la que se carga una linea de presupuesto y con la que se clasifica
cada factura que entra, asi nadie escribe el concepto a mano y todo suma al mismo
lugar. Al elegir el rubro, el desplegable de subrubro se llena solo.

Se regenera con `python test/gen-rubros.py`.

### Alta propia: la primera vez que alguien entra

Nadie carga usuarios a mano. El que entra con su mail por primera vez ve una
pantalla que le pregunta tres cosas: **a que productora se suma**, **que rol
cumple** y **de que area es**. Si todavia no hay ninguna productora, la crea el
y queda como su administrador.

**El candado arranca abierto.** Mientras son dos o tres y se conocen, el que
entra elige su rol —incluso Administracion— y queda activo al toque. Cuando la
herramienta se abra a mas gente se cierra con un switch en la base:

```sql
update productora set requiere_aprobacion = true;
```

Desde ahi el que se da de alta queda **pendiente**: entra, ve que esta
esperando, y no accede a ningun dato hasta que un admin lo aprueba desde
**☁ → Altas pendientes**. Los que ya estaban no se tocan.

Lo importante es donde vive la regla: **en la base, no en esta pantalla**. Con
el candado cerrado, la politica `usuario_autoalta` solo acepta filas con
`pendiente = true`, y solo con el `auth_uid` de quien esta logueado. Aunque
alguien abra la consola del navegador y mande el insert a mano, no puede
declararse admin ni darse de alta por otro. El test lo prueba intentandolo.

Vive en `backend/alta-propia.sql`, que se corre despues de `esquema.sql`.

### Datos centralizados

Lo que tiene que ser de todos vive en la base, no en el navegador de cada uno:

| Qué | Sube cuando | Baja cuando |
|---|---|---|
| **Productoras** | se crean o se editan | al entrar |
| **Proyectos** | se guardan | al entrar |
| **Catálogo** (personas, proveedores, equipos) | se guardan, y con ⟳ Sincronizar | al entrar |
| **Usuarios y roles** | al darse de alta | al entrar |

Los ids son UUID de los dos lados, asi que la fila local y la del servidor son
la misma y sincronizar nunca duplica. **☁ → Sincronizar todo** empuja lo que
este navegador tenga y el servidor no: es lo que rescata el trabajo hecho antes
de conectarse.

Una persona puede figurar en **varias productoras** —un tecnico trabaja para
muchas— y su rol puede ser distinto en cada una. El menu de arriba las agrupa
en *mis productoras*, *en la web* (elegir una te suma) y *solo en esta
computadora*.

### Horas extra por tramos

Las horas extra no se liquidan con un recargo unico: van por **tramos**, y cada
uno vale mas que el anterior. La escala se configura por proyecto en
**Rodaje -> Condiciones de la jornada**, con un preset de **50/100/200/300%** a
un click y otro para volver a un recargo plano.

> **El default sigue siendo 50% plano.** Los topes cambian de un convenio a
> otro: poner una escala que no es la de ustedes daria numeros equivocados con
> total seguridad. Hay que elegirla a mano.

Cada persona muestra el reparto como un recibo:
`2:00 al 50% + 2:00 al 100% + 1:00 al 200%`. Los proyectos que ya existian se
migran a un tramo unico con SU recargo, asi que a nadie le cambia un numero.

Tambien esta la **jornada de scouting**, que es mas corta que la de rodaje.

### Estimado vs Actual

Al lado de lo estimado, lo que se lleva gastado de verdad. Los comprobantes ya
traian `lineaId`, asi que el real se cuelga de la linea exacta: en verde si
queda dentro, en rojo si se paso. El rubro muestra su propio real, y avisa en
el tooltip cuanta plata quedo cargada al rubro **sin asignar a ninguna linea**
—si no, el rubro no cuadraria con la suma de sus lineas y nadie entenderia por
que—. Los comprobantes rechazados no cuentan.

### Los dos presupuestos: Real y Produccion

En una productora conviven dos presupuestos del mismo proyecto, y no es un
truco: es como se trabaja.

| Nivel | Quien lo ve |
|---|---|
| **Real** | Administracion y Productor Ejecutivo. Tiene la plata que de verdad hay, con el colchon adentro |
| **Produccion** | + el jefe de produccion. Es con lo que gasta |
| **Cliente** | + Equipo. El que se presenta afuera |

No se resuelve escondiendo lineas —son numeros distintos— asi que **son
versiones distintas**, y quien ve cual **lo decide el rol**. `getV()` nunca
devuelve una version fuera del alcance: un id guardado no alcanza para caer en
el Real. Si a alguien no le toca ninguna, la pantalla lo dice en vez de romper.

Boton **→ Produccion** sobre una version Real: la copia recortando un % y la
marca como Produccion. El jefe ve **todas** las lineas —tiene que saber que hay
que contratar— pero con la plata que se le asigna. Y un panel **Real vs
Produccion** con el colchon en un numero, que solo ven Administracion y PE, con
aviso si el de Produccion quedo por encima del Real.

### Lo que no lleva IVA

No todo esta gravado: los seguros estan exentos y hay rubros que se pasan a
costo. Se marca por rubro (`aplicaIva`, junto al `aplicaFee` que ya estaba) y
esa plata sale de la base imponible. El fee y la contingencia si van gravados,
porque son servicio de la productora. El rubro de Seguros nace exento.

```
Subtotal costo directo        $ 2.500.000
Fee 15% s/ $2.000.000         $   300.000     <- seguros sin fee
Contingencia 5%               $   125.000
Neto                          $ 2.925.000
Exento de IVA                 - $ 500.000
IVA 21% s/ $2.425.000         $   509.250     <- no sobre el total
TOTAL                         $ 3.434.250
```

### Sub-proyectos: varios spots en una campana

Un proyecto casi nunca es UNA pieza. Una campana son tres spots; una serie, ocho
capitulos. Cada tipo trae su unidad: **Spot** (publicidad), **Episodio** (serie),
**Video** (videoclip), **Pieza** (redes/institucional), y en cine la unidad del
desglose es la **Escena**.

**El modelo no es un presupuesto por spot.** Es UNO donde cada linea dice de que
pieza es:

```
linea.piezaId = null   -> COMPARTIDA: es de todo el proyecto
linea.piezaId = <id>   -> PROPIA de esa pieza
```

Eso resuelve las dos cosas a la vez:

- **El general suma cada cosa UNA vez.** El DF que hace los tres spots en una
  jornada se paga una jornada, no tres.
- **Si un spot tiene algo que otro no, queda solo en ese.** Nunca se iguala
  hacia arriba ni se comparte el numero del elemento.

Para saber cuanto sale cada spot, lo compartido se **prorratea** segun el peso de
cada pieza (iguales por defecto). Eso es una **imputacion**, no plata nueva: la
suma de los imputados da exactamente el subtotal.

| | Propio | Parte de lo comun | Imputado |
|---|---|---|---|
| Spot Playa | 650.000 | 500.000 | 1.150.000 |
| Spot Ciudad | 300.000 | 500.000 | 800.000 |
| Spot 3 | 0 | 500.000 | 500.000 |
| **Suma** | 950.000 | 1.500.000 | **2.450.000** |

En **Presupuesto** hay una solapa por spot mas la de **General**. Parado en un
spot se ve lo suyo y lo compartido, y la linea que agregas queda de ese spot.
En **Desglose** esta el boton **+ Spot** (o la unidad que corresponda) **desde
el arranque, antes de cargar ningun guion** —que es cuando mas se necesita—,
cada escena se asigna a la suya, y la barra de arriba filtra.

**Varios guiones de una.** El selector de archivos acepta **varios a la vez**, y
ademas parte un solo documento que traiga los tres spots adentro, que es como
suele llegar de la agencia. Corta por los encabezados que se usan de verdad
(`SPOT 1`, `GUION B`, `COMERCIAL: Verano`, `PIEZA 2`, `VERSION LARGA`) y por un
titulo en mayusculas con duracion (`VERANO 30"`). Si no encuentra ninguno deja
el guion entero: no inventa cortes, y un encabezado de escena nunca se confunde
con un titulo de guion. Antes de crear nada muestra que encontro, con cuantas
escenas cada uno, y se confirma.

Al pasar el desglose al presupuesto se aplica la regla: **lo que aparece en un
solo spot es de ese spot; lo que aparece en varios queda compartido y va una
vez**. Los rubros que se agrupan en un renglon (utileria, vestuario) se parten
por pieza, si no la torta del spot A y la pelota del B terminaban en un
"Utileria - 2 elementos" que parecia compartido y escondia que eran cosas
distintas.

El **presupuesto General** es el presupuesto entero: estan TODAS las lineas de
todos los spots mas las compartidas, cada una con su valor y cada una contada
una sola vez. En pantalla cada linea lleva el chip que dice de que spot es o si
es compartida. Lo mismo va al cliente: la **vista Cliente** y el **PDF** llevan
el cuadro de cuanto sale cada spot, y el **CSV** trae una columna con el spot de
cada linea mas ese cuadro al pie.

> Borrar una pieza **no borra su plata**: sus lineas vuelven a ser compartidas
> y se avisa cuantas. Un proyecto sin piezas funciona exactamente como antes.

### La cartera de proyectos

Arriba del Resumen esta la lista de los proyectos de la productora: cada uno con
su cliente, sus jornadas, el estado de la ultima version y cuanto da. Se salta de
uno a otro con un toque y el que estas mirando queda marcado.

**El boton `+ Nuevo proyecto` esta ahi**, sobre la lista. Antes crear un proyecto
solo se podia desde la solapa Productoras, que es el ultimo lugar donde alguien
lo busca.

Se listan solo los proyectos a los que entras: `proyectosDe` respeta las
invitaciones, asi que un tecnico no ve la cartera completa de la productora.

### Invitar a un proyecto

Boton **✉ Invitar** al lado de *Proyecto*. Se elige el rol y sale un mensaje
corto para mandar por WhatsApp o mail:

```
Te invitaron a participar del proyecto: "Spot Verano" en la productora: "Neto Films"
https://…/clap.html?inv=…
```

El que abre el link ve **primero** una pantalla que dice de que lo invitaron
—proyecto, productora, quien lo invito y con que rol— antes de aceptar nada. Si
no tiene cuenta, la crea ahi mismo. Al aceptar queda anotado en el proyecto, la
productora le aparece en el menu de arriba y el proyecto en el de proyectos.

> La invitacion viaja dentro del link, no en una tabla nueva: no hay SQL que
> correr y el que invita no necesita saber de antemano el mail del invitado.
> Cualquiera con el link puede usarlo, asi que se manda por privado.

**Ojo con el orden**: anotar a la persona en el proyecto va ANTES de
sincronizar. Con rol Produccion o Equipo el acceso a la productora sale de
estar anotado en alguno de sus proyectos (`productoras_con_acceso`), asi que
sincronizar primero baja una lista vacia y el proyecto no aparece.

### Quien soy yo

Con sesion iniciada, **la identidad no se elige**: la dice el mail con el que
entraste. El cartel de arriba a la derecha es un cartel, no un selector. El
selector aparece solo cuando **nadie** inicio sesion, que es cuando la app se
mira con la gente de ejemplo, y ahi dice **"Viendo como"** en vez de "Soy".

Importa mas de lo que parece: cada movimiento de un comprobante queda firmado
con el nombre del usuario en un historial que no se puede editar ni borrar. Si
la pantalla puede decir que sos otro, la firma tambien.

Tres reglas que sostienen esto:

- `getUsuario()` con sesion busca **solo** por `auth_uid` (y por mail como
  respaldo). Si no encuentra mi ficha devuelve `null` —"nadie"—, nunca la
  primera de la lista. Sin usuario no hay permisos y el cartel dice *sin alta*.
- **`activo` y `pendiente` son cosas distintas.** `activo` es formar parte del
  equipo; `pendiente` es estar esperando el visto bueno. El que espera **esta**
  en el equipo y se ve con su nombre: lo que no tiene son permisos. `puede()` y
  `veTodo()` devuelven `false` mientras `pendiente` este puesto, asi que pedir
  "Productor Ejecutivo" no abre nada hasta que alguien apruebe.
- **El espejado local no depende de poder leer la productora.** Mientras el
  alta espera aprobacion la base no deja leer esa fila (`productora_mia` pasa
  por `mis_productoras()`, que exige `activo AND NOT pendiente`), pero si deja
  leer la ficha propia (`usuario_ver_mia`). Primero me espejo con lo que se, y
  el nombre real de la productora se corrige despues, cuando llega.

> Estas tres se rompieron juntas una vez y el sintoma fue el mismo: alguien
> entraba con su mail y la pantalla le mostraba el nombre de otra persona,
> ademas de no aparecer en el catalogo. `test/identidad.js` reproduce ese caso
> exacto de punta a punta.

## Arquitectura

Todo en `clap.html`, en cuatro bloques marcados en el código:

| Bloque | Qué es |
|---|---|
| `MODEL` | Schema, catálogos maestros (rubros, funciones, circuitos), fábricas de entidades |
| `STORE` | Persistencia y migraciones. Hoy `localStorage`, mañana una API |
| `CALC`  | Motor de cálculo: líneas → rubros → capas → total. Sin dependencias de UI |
| `UI`    | Render |

`CALC` no toca el DOM y `MODEL` no toca `STORE`: cuando se migre a Postgres/Supabase
sólo se reescribe `STORE`. Toda entidad lleva `id` propio y las de proyecto cuelgan
de `productoraId`, así que el schema ya es multi-tenant.

## Roadmap

1. **Presupuestador** ✅
2. **Desglose de guion** ✅ — parser, elementos por departamento, plan de rodaje,
   puente al presupuesto.
3. **Callsheet** ✅ — jornada por jornada, con impresion a A4.
4. **Rodaje** ✅ — citaciones, parte del dia y horas extra.
5. **Seguros** — generar el alta (nómina para el broker) desde el crew ya cargado;
   guardar pólizas y certificados. AP, ART, RC, todo riesgo equipos.
6. **Caja y pagos** ✅ — circuito de aprobacion, ordenes de compra, caja chica,
   rendiciones y tablero presupuestado/comprometido/real. — órdenes de compra, caja chica por jornada, rendiciones, y el
   tablero Presupuestado / Comprometido / Real.
7. **Backend** — el esquema esta escrito en `backend/esquema.sql` (Postgres/Supabase),
   con Row Level Security para que el aislamiento entre productoras y los permisos
   los haga cumplir la base y no la interfaz. Falta montarlo y migrar el JSON.
8. **Antes: Backend** — Supabase, usuarios, adjuntos, acceso de sólo lectura para el cliente.
9. **Tarifario histórico** — al cerrar un proyecto, el catálogo aprende cuánto salió
   cada rubro de verdad.

## Pruebas

El motor de cálculo y los caminos de render se prueban headless (sin navegador):

```bash
node test/run.js test/pruebas.js    # presupuesto: cálculo, capas, versionado
node test/run.js test/parser.js     # parser de guion contra test/guion-ejemplo.txt
node test/run.js test/desglose.js   # desglose, jornadas y puente al presupuesto
node test/run.js test/importar.js  # PDF, DOCX, RTF, FDX y .doc contra test/muestras/
node test/run.js test/callsheet.js # callsheet, datos por jornada y migracion
node test/run.js test/pegado.js    # flujo de pegado, cartel en vivo, encabezados de publicidad
node test/run.js test/libre.js     # guiones SIN encabezados: prosa, planos, tabla VIDEO|AUDIO
node test/run.js test/contactos.js # lista de contactos y su circuito con catalogo y callsheet
node test/run.js test/rodaje.js    # citaciones, fichadas, horas extra y turnaround
node test/run.js test/sica.js      # escala de convenio y su uso como referencia
node test/run.js test/gastos.js    # rubros, roles y circuito de aprobacion
node test/run.js test/plata.js     # ordenes de compra, caja chica y tablero
node test/run.js test/resumen.js   # portada, pendientes y datos de ejemplo
node test/run.js test/guia.js      # instructivo: contenido, navegacion y que no mienta
node test/run.js test/backend.js   # conexion, login, renovacion de sesion y diagnostico
node test/run.js test/alta.js      # alta propia, el candado y la cola de aprobacion
node test/run.js test/identidad.js # quien soy al entrar con mi mail, con el alta pendiente
node test/run.js test/tipocambio.js # TC editable arriba, recalculo y sellado de fecha
node test/run.js test/catalogo-compartido.js # el catalogo es UNO para el equipo, contra la base
node test/run.js test/quien-entra.js  # aprobar y cambiar roles sin tocar la base
node test/run.js test/modo-prueba.js  # todos entran con permisos, para probar
node test/run.js test/menu-productoras.js # el menu de productoras sale de la base
node test/run.js test/invitar-link.js # invitar por link: mensaje, alta y aceptacion
node test/run.js test/piezas.js     # spots/episodios: reparto, no duplicar, desglose por pieza
node test/run.js test/dos-presupuestos.js # Real vs Produccion por rol, y el IVA exento
node test/run.js test/extras-y-actual.js  # horas extra por tramos y columna Actual
node test/run.js test/flujo.js     # UNA PRODUCCION ENTERA, de punta a punta

python test/generar-muestras.py    # regenera test/muestras/ (PDF, DOCX, RTF, FDX)
```
