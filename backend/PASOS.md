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

## El candado del alta

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
