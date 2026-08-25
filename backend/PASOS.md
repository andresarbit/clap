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

### A2. Correr el esquema

1. En el panel de Supabase: **SQL Editor** → **New query**.
2. Abrí `backend/esquema.sql`, copiá **todo** y pegalo.
3. **Run**. Tiene que decir *Success*.

Si tira un error, copiámelo tal cual y lo arreglo. No lo corras dos veces: si
necesitás empezar de nuevo, andá a **Database → Tables** y borrá las tablas
primero.

### A3. Copiar las dos claves

**Project Settings → API**. Necesitás dos cosas:

- **Project URL** — algo como `https://abcdefgh.supabase.co`
- **anon / publishable key** — empieza con `eyJ...` o `sb_publishable_...`

> ⚠️ **Sólo la clave anónima.** La `service_role` y la contraseña de la base
> **no van en CLAP ni me las pases a mí**: quien las tiene se saltea todos los
> permisos y puede leer y borrar todo. CLAP la rechaza si la pegás por error.

### A4. Conectar

1. Abrí `clap.html`, botón **☁** arriba a la derecha.
2. Pegá la URL y la clave anónima → **Guardar y probar**.
3. **Crear cuenta** con tu mail y una contraseña.
4. El diagnóstico tiene que quedar así:

```
✓ Conexión configurada
✓ El servidor responde y la clave es válida
✓ Sesión iniciada
✓ Esquema cargado
```

Si el último da rojo, te va a decir **qué tablas faltan**: volvé al paso A2.

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
