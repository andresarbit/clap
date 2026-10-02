# Poner CLAP en línea

Dos cosas separadas, y conviene no mezclarlas:

| | Qué es | Dónde |
|---|---|---|
| **Los datos** | Presupuestos, comprobantes, usuarios, fotos | **Supabase** |
| **La página** | El archivo `clap.html` | Un hosting (ver más abajo) |

La página es sólo el programa: **no tiene datos adentro**. Los datos viven en
Supabase, detrás de login y de Row Level Security. Eso importa para entender qué
está protegido y qué no.

---

## Parte A — Supabase (los datos)

### A1. Crear el proyecto

1. Entrá a [supabase.com](https://supabase.com) → **New project**.
2. Nombre: `clap`. Región: **South America (São Paulo)**, que es la más cercana.
3. Guardá la contraseña de la base en tu gestor de contraseñas. **No la
   necesitás para CLAP** — es para conectarte por SQL desde afuera.
4. Esperá unos minutos a que termine de crearse.

### A2, A2b, A2c y A3 — ✅ YA ESTÁN HECHOS

Los corrí yo el 25/08/2026 sobre tu proyecto **Clap** (org `andresarbit`).
Estado verificado contra la base, no de memoria:

| | |
|---|---|
| Tablas | **23** |
| Con Row Level Security | **23 de 23** |
| Políticas | **39** |
| `usuario.pendiente` / `usuario.area` | presentes |
| `productora.requiere_aprobacion` | presente, en `false` (candado abierto) |
| `productoras_para_elegir()` | creada |

Y la prueba que importa: **con la clave pública y sin login, la base devuelve
lista vacía**. O sea que RLS no es decorativo — un desconocido con el link no
lee nada.

Tus datos de conexión **no están en este repo a propósito**, porque el repo es
público. Están en `MI-CONEXION.txt`, en tu carpeta `D:\Cuadro`, que git ignora.

Si lo perdés, se sacan del panel de Supabase: botón **Connect** arriba, o
**Settings → API Keys** (la *publishable*) e **Integrations → Data API** (la URL).

La clave publishable no es un secreto — Supabase la marca como *"can be safely
shared publicly"* y lo que protege los datos es el login más RLS, no ella. Pero
tampoco hace falta regalarla en un repo público que cualquiera puede clonar.
La `sb_secret_…` que está al lado **no la toqué, no la tengo y no tiene que
salir nunca del panel**.

### A2d. Correr sincronizacion.sql — ✅ YA ESTÁ HECHO

Corrido el 25/08/2026. Le agrega a las 23 tablas una columna `actualizado_el`
con trigger e índice —para saber cuándo cambió cada fila— y crea la tabla
`borrado`, con RLS, para que las bajas viajen entre navegadores. Verificado
contra la base: la tabla existe, tapa sin login, y se puede pedir "lo que
cambió desde tal fecha".

### A2e. Correr arranque.sql — ✅ YA ESTÁ HECHO

Corrido el 25/08/2026. Sin esto, crear la PRIMERA productora fallaba con
"El servidor no te deja hacer eso": quien recién entra no pertenece a ninguna
organización, así que insertaba la fila y después no podía leerla de vuelta
para saber qué id le tocó, porque la política de lectura exige ser miembro.

La salida no fue aflojar esa política —con eso cualquiera con la clave pública
podría listar todas las productoras con sus CUIT y sus fees— sino hacer el
arranque de una sola vez del lado de la base: la función `crear_mi_productora`
crea la organización si hace falta, crea la productora, y da de alta a quien la
pidió como administrador de lo que acaba de crear. Corre con permisos de dueño
pero sólo hace esas tres cosas y sólo para quien la llama.

Verificado: sin sesión responde *"Hay que iniciar sesión antes de crear una
productora"* y no crea nada.

### A2f. Correr permisos.sql — ✅ YA ESTÁ HECHO

Corrido el 25/08/2026. Es el cambio de modelo que propuso Andrés: **el acceso
pasa a ser por proyecto, no por productora**.

Alguien puede tener anotadas todas las productoras con las que trabaja; eso no
le abre nada. La puerta la abre la productora, invitándolo a un proyecto
puntual. Administración y Productor Ejecutivo entran a todo sin invitación.

Y una consecuencia buena: como agregarse a una productora ya no da acceso, el
alta libre deja de ser un riesgo para Equipo y Producción. Sólo se pide
aprobación a quien se declara Administración o Productor Ejecutivo en una
productora ajena, que son los que sí ven todo.

Verificado: la tabla `proyecto_persona` existe, tapa sin login, y ninguna otra
tabla se abrió de más.

### A2g. Correr privado.sql — ⏳ FALTA (lo corrés vos)

Termina el modo prueba y deja CLAP privado: **se entra sólo con invitación**.
Cualquiera puede crearse una cuenta, pero una cuenta sola no ve nada. A una
productora se entra con el link de ✉ Invitar, que trae una clave que guarda la
base. Nadie aprueba a mano y nadie se anota solo en una ajena.

1. Supabase → **SQL Editor** → **New query**.
2. Pegá **todo** `backend/privado.sql` y apretá **Run**.
3. Al final sale una tabla: quién está en cada productora, con qué rol y qué
   ve. **El modo prueba dejó a todos como Administración**: si hay alguien que
   no tiene que ver todo, cambiale el rol o dalo de baja desde CLAP
   (☁ → Quién entra).
4. En **Authentication → Sign In / Providers → Email**, revisá:
   - **Allow new users to sign up**: prendido (el invitado se crea la cuenta solo).
   - **Confirm email**: prendido (nadie se registra con el mail de otro).

Se puede correr dos veces sin romper nada. Se probó antes contra un Postgres
de verdad armado como esta base (52 pruebas).

Hasta que lo corras, la app nueva no puede generar links de invitación
(avisa que falta este archivo) y la base sigue en modo prueba.

### A2h. Correr subir-proyectos.sql — ⏳ FALTA (lo corrés vos)

Desde `permisos.sql` (25/08) la base rechazaba todo proyecto nuevo que se
subía desde el navegador: la regla que decide quién ve un proyecto lo buscaba
en la tabla, y en el instante de subirlo todavía no estaba. Se vio al invitar
("No pude generar el link"): para invitar, el proyecto tiene que estar en la
base.

Pegá todo `backend/subir-proyectos.sql` en el SQL Editor y **Run**. Desde ahí
los proyectos suben, quien crea uno queda anotado en él, y Equipo sigue sin
poder crear proyectos ni ver los ajenos. Probado contra un Postgres armado
como esta base.

### A2i. Correr proyecto-completo.sql — ⏳ FALTA (lo corrés vos)

Hace dos cosas:

1. **El proyecto completo va a la base.** Hasta ahora en la base estaba sólo
   la ficha de cada proyecto: el presupuesto, el plan, los partes, los gastos
   y la liquidación vivían en la compu de cada uno, y dos personas no podían
   trabajar sobre el mismo proyecto. Ahora cada proyecto se guarda por partes
   y CLAP las sube y las baja solo (a los 3 segundos de cada cambio, y cada
   25 segundos mira si alguien cambió algo). Si dos guardan a la vez, se
   juntan los cambios: lo que tocó uno solo queda; si los dos tocaron lo
   mismo, gana el último.
2. **Los roles nuevos:** Asistente de dirección, Asistente de producción y
   Asistente de arte. La base no les da el presupuesto ni la liquidación:
   reciben el equipo sin montos.

Pegá todo `backend/proyecto-completo.sql` en el SQL Editor y **Run**. Se
puede correr dos veces. Después, en CLAP: **☁ → Sincronizar todo**, desde la
compu que tiene el proyecto más completo (la primera que sincroniza manda; si
otra compu tenía algo distinto, se guarda aparte, no se tira).

Probado contra un Postgres armado como esta base: quién lee y escribe cada
parte con cada rol (25 pruebas), y la app de verdad subiendo, juntando los
cambios de dos personas y mandándole al asistente el equipo sin plata (17).

### La IA (opcional, paga) — APAGADA, no hace falta hacer nada

CLAP funciona entero sin IA. Si un día se decide prenderla (lee respuestas de
rentals desordenadas y mira los cuadros del storyboard), son cuatro pasos y
cuesta por uso:

1. Abrir una cuenta en console.anthropic.com, cargar crédito y crear una
   clave (empieza con `sk-ant-`). La clave no se pega en ningún lado de CLAP.
2. Supabase → **Edge Functions** → **Deploy a new function** → **Via editor**.
   Nombre: `clap-ia`. Pegar todo `backend/funciones/clap-ia/index.ts`. Deploy.
3. Supabase → **Edge Functions** → **Secrets**: agregar `ANTHROPIC_API_KEY`
   con la clave, y si se quiere `IA_TOPE_MENSUAL` (usos por productora por
   mes; si no está, 300).
4. SQL Editor: correr `backend/ia.sql` (el contador del tope).

Al recargar CLAP aparecen "Leer con IA" en las respuestas de rentals y "Leer
los cuadros con IA" en el banco de planos. Para apagarla: borrar el secreto.

### A4. Lo único que falta de esta parte, y sólo lo podés hacer vos

Crear tu cuenta pide elegir una contraseña. Eso no lo hago yo por vos: es tuya
y no la quiero ni ver. Son dos minutos.

1. Abrí el link que está en `MI-CONEXION.txt` — ya lleva la conexión adentro
   y no tenés que copiar nada. O abrí `clap.html` normal, botón **☁**, y pegá
   la URL y la clave de ese archivo.

2. Botón **☁** → **Crear cuenta** con tu mail y una contraseña.

3. **Supabase te va a mandar un mail para confirmar la dirección.** Confirmalo
   y volvé a entrar. Puede tardar y puede caer en spam.

4. Aparece **"Primera vez acá"**: tu nombre, creás tu productora, elegís
   **Administración**. Quedás activo al toque.

5. El diagnóstico tiene que quedar así:

```
✓ Conexión configurada
✓ El servidor responde y la clave es válida
✓ Sesión iniciada
✓ Esquema cargado
```

---

## Parte B — La página

### La comparación, con los datos en la mano

| | Repo privado | Uso comercial | Costo |
|---|---|---|---|
| **GitHub Pages** | ✕ el repo tiene que ser **público** | ✓ | gratis |
| **GitHub Pages + Pro** | ✓ | ✓ | US$ 4/mes |
| **Vercel Hobby** | ✓ | ✕ **prohibido** | gratis |
| **Vercel Pro** | ✓ | ✓ | US$ 20/mes |
| **Cloudflare Pages** | ✓ | ✓ | **gratis** |

Dos cosas que no son obvias:

- **GitHub Pages gratis exige repo público.** Publicar el repo significa que
  cualquiera ve el código, el historial y todo lo que subimos. Se puede, pero
  es una decisión, no un detalle.
- **Vercel Hobby prohíbe el uso comercial.** Un sistema de gestión para una
  productora es uso comercial, aunque no cobres por la página. Para usarlo en
  serio hay que ir a Pro.

**Recomendación: el código en GitHub (privado, como está) y la página en
Cloudflare Pages.** Es gratis, permite uso comercial, deploya desde el repo
privado, y —lo importante— tiene **Cloudflare Access gratis hasta 50 personas**,
que es la única de las tres que te da privacidad de verdad y no sólo un link
difícil de adivinar.

### B1. Cloudflare Pages (recomendado)

1. Cuenta en [dash.cloudflare.com](https://dash.cloudflare.com) (gratis).
2. **Workers & Pages → Create → Pages → Connect to Git**.
3. Autorizá GitHub y elegí el repo **clap**.
4. Configuración del build:
   - Framework preset: **None**
   - Build command: *(vacío)*
   - Build output directory: **`/`**
5. **Save and Deploy**. Queda en `https://clap-xxx.pages.dev/clap.html`.

Cada `git push` redeploya solo.

### B2. Hacerlo privado de verdad (opcional, gratis)

Esto es lo que **GitHub Pages y Vercel no te dan gratis**: que sólo entre la
gente que vos autorizás, no cualquiera con el link.

1. En Cloudflare: **Zero Trust → Access → Applications → Add an application**
   → **Self-hosted**.
2. Dominio: el de tu sitio `.pages.dev`.
3. Policy: **Allow** → *Emails* → cargá los mails de tu equipo.
4. Listo: al entrar, Cloudflare les manda un código al mail. Sin ese mail no
   pasan.

### B3. Si preferís GitHub igual

**Repo público** (gratis): Settings → Pages → Source `main`, carpeta `/`.
Queda en `https://andresarbit.github.io/clap/clap.html`.
El código queda a la vista de cualquiera.

**Repo privado**: hace falta **GitHub Pro** (US$ 4/mes). Aun así, **el sitio
sigue siendo público** — Pages privado de verdad es sólo Enterprise Cloud.

---

## Parte C — Pasarle el link al equipo

Con la conexión configurada, en el botón **☁** hay **"Copiar link para el
equipo"**. Genera algo así:

```
https://tu-sitio.pages.dev/clap.html?sb=https://abc.supabase.co&k=eyJ...
```

El que lo abre **ya queda apuntando a tu Supabase**: sólo tiene que entrar con
su mail y contraseña. La URL se limpia sola después de leerla, para que no
quede colgada en el historial.

La clave anónima viaja en el link, y está bien: está hecha para ser pública. Lo
que protege los datos no es esa clave, es el login y las políticas de la base.

---

## Una cosa que tenés que saber antes de repartir el link

El candado abierto y el alta libre juntos significan esto, textual:

> **Cualquiera que tenga el link puede crear una cuenta, declararse
> Administración, y ver todo.**

Es exactamente lo que pediste para arrancar, y está bien mientras son ustedes
dos. Pero conviene tenerlo dicho en voz alta antes de mandar el link por
WhatsApp a un grupo grande.

Hoy lo único que frena a un desconocido es que **Supabase pide confirmar el
mail** — hay que tener una casilla real. Por eso **dejé esa confirmación
prendida** aunque haga más lento el alta: ahora mismo es tu única puerta.

Cuando quieras cerrar de verdad, son dos switches independientes:

```sql
-- 1) el que entra queda esperando aprobación en vez de entrar como admin
update productora set requiere_aprobacion = true;
```

Y en el panel de Supabase, **Authentication → Sign In / Providers → Email**:
apagar **Allow new users to sign up**. A partir de ahí las cuentas las creás
vos desde **Authentication → Users → Add user**.

Recomendación: apretá los dos el día que el link salga del círculo de dos.

## El candado del alta (reemplazado por privado.sql)

> Esto era antes de `privado.sql`. Con CLAP privado ya no hay alta propia ni
> aprobación: se entra con invitación. Queda como historia.


Arranca **abierto**: el que entra elige su rol —incluso Administración— y queda
activo al toque. Es lo cómodo mientras son dos o tres y se conocen.

Cuando la herramienta se abra a más gente, se cierra desde el SQL Editor:

```sql
update productora set requiere_aprobacion = true;
```

Desde ahí, el que se da de alta queda **pendiente**: puede entrar y ver que
está esperando, pero no accede a ningún dato hasta que un admin lo apruebe
desde **☁ → Altas pendientes**. Los que ya estaban no se tocan.

Lo hace cumplir la **base**, no la interfaz: con el candado cerrado nadie se
declara admin ni se aprueba a sí mismo, aunque toque el navegador.

## Qué está protegido y qué no

| | Estado |
|---|---|
| **Los datos** (presupuestos, facturas, contactos) | Protegidos: hace falta cuenta, y RLS impide ver lo de otra productora |
| **La página** | Pública si alguien tiene el link — salvo que uses Cloudflare Access |
| **El código** | Privado mientras el repo lo sea |
| **La clave anónima** | Pública por diseño, no es un secreto |
| **La `service_role` y la contraseña de la base** | **Nunca** salen del panel de Supabase |

---

## Orden sugerido

1. **A1 a A4** — Supabase andando y el diagnóstico en verde.
2. Avisame y hago la migración de tus datos locales y el login real.
3. **B1** — Cloudflare Pages.
4. **B2** — Access, cuando quieras cerrarlo al equipo.

No hace falta hacer B antes que A: mientras tanto el archivo sigue funcionando
por WhatsApp como hasta ahora.
