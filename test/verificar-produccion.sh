#!/bin/bash
# Verificación de CLAP en producción. Se corre en loop: lo que importa no es
# que pase una vez, es que pase siempre. Cada vuelta pega contra el sitio
# publicado y contra la base real.

SITIO="https://andresarbit.github.io/clap"
BASE="https://pcmzsgkcfdrwghwpmxdj.supabase.co"
NUEVA="sb_publishable_I6lImPA4w96mjaBYAj_6Vg_f6FVGj_l"
VIEJA="sb_publishable_fCo0YcUeRzQEk--KwHMzUA_IehvDbEf"

VUELTAS=${1:-5}
ok=0; mal=0
declare -A fallos

chk(){ # nombre, condicion(0=ok), detalle
  if [ "$2" = "0" ]; then ok=$((ok+1)); printf "  ok   %-46s %s\n" "$1" "$3"
  else mal=$((mal+1)); fallos[$1]=$(( ${fallos[$1]:-0} + 1 ))
       printf "  MAL  %-46s %s\n" "$1" "$3"; fi
}

for v in $(seq 1 $VUELTAS); do
echo "═══════════════ VUELTA $v de $VUELTAS ═══════════════"

# ---------- 1. el sitio publicado ----------
c=$(curl -sS -o /tmp/v_raiz.html -w "%{http_code}" "$SITIO/")
chk "la raiz del sitio responde" $([ "$c" = "200" ]; echo $?) "HTTP $c"
grep -q "clap.html" /tmp/v_raiz.html
chk "la raiz redirige a clap.html" $? ""

c=$(curl -sS -o /tmp/v_app.html -w "%{http_code}" "$SITIO/clap.html")
tam=$(wc -c < /tmp/v_app.html)
chk "clap.html se sirve entero" $([ "$c" = "200" ] && [ "$tam" -gt 300000 ]; echo $?) "$tam bytes"
grep -q "Control, Logística y Administración" /tmp/v_app.html
chk "es la app, no una pagina de error" $? ""
grep -q "https\?://" <<< "$(curl -sS -o /dev/null -w "%{redirect_url}" "$SITIO/")" ; true
c=$(curl -sS -o /dev/null -w "%{http_code}" "$SITIO/backend/PASOS.md")
chk "el sitio sirve tambien la guia" $([ "$c" = "200" ]; echo $?) "HTTP $c"

# ---------- 2. nada de credenciales en lo publicado ----------
grep -q "I6lImPA4w96\|pcmzsgkcfdrwghwpmxdj" /tmp/v_app.html
chk "la app publicada NO trae la clave ni la URL" $([ $? -ne 0 ]; echo $?) ""
n=$(curl -sS "https://raw.githubusercontent.com/andresarbit/clap/main/backend/PASOS.md" \
    | grep -cE "pcmzsgkcfdrwghwpmxdj|sb_publishable_[A-Za-z0-9]{10}")
chk "PASOS.md publico esta limpio" $([ "$n" = "0" ]; echo $?) "$n apariciones"
n=$(curl -sS "https://api.github.com/repos/andresarbit/clap/contents/" | grep -c "MI-CONEXION")
chk "MI-CONEXION.txt no llego al repo" $([ "$n" = "0" ]; echo $?) ""

# ---------- 3. la clave vieja quedo muerta ----------
c=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/rest/v1/productora?select=id" -H "apikey: $VIEJA")
chk "la clave vieja esta revocada" $([ "$c" = "401" ]; echo $?) "HTTP $c"

# ---------- 4. la base, con la clave nueva ----------
c=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/auth/v1/settings" -H "apikey: $NUEVA")
chk "la base responde y la clave nueva sirve" $([ "$c" = "200" ]; echo $?) "HTTP $c"

TABLAS="adjunto caja_adelanto caja_chica catalogo_persona comprobante comprobante_paso contacto_proyecto desglose escena escena_elemento escena_personaje jornada jornada_escena_filmada jornada_locacion jornada_persona linea_presupuesto orden_compra organizacion productora proyecto rubro_version usuario version_presupuesto"
for t in $TABLAS; do
  c=$(curl -sS -o /tmp/v_t.json -w "%{http_code}" "$BASE/rest/v1/$t?select=*&limit=1" -H "apikey: $NUEVA")
  cuerpo=$(cat /tmp/v_t.json)
  chk "tabla $t existe y RLS la tapa" \
      $([ "$c" = "200" ] && [ "$cuerpo" = "[]" ]; echo $?) "HTTP $c $cuerpo"
done

# ---------- 5. las funciones del alta propia ----------
c=$(curl -sS -o /tmp/v_f.json -w "%{http_code}" -X POST "$BASE/rest/v1/rpc/productoras_para_elegir" \
    -H "apikey: $NUEVA" -H "Content-Type: application/json" -d '{}')
chk "productoras_para_elegir() existe" $([ "$c" != "404" ]; echo $?) "HTTP $c"
c=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$BASE/rest/v1/rpc/productora_pide_aprobacion" \
    -H "apikey: $NUEVA" -H "Content-Type: application/json" \
    -d '{"p":"00000000-0000-0000-0000-000000000000"}')
chk "productora_pide_aprobacion() existe" $([ "$c" != "404" ]; echo $?) "HTTP $c"

# ---------- 6. un anonimo no puede escribir nada ----------
c=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$BASE/rest/v1/productora" \
    -H "apikey: $NUEVA" -H "Content-Type: application/json" \
    -d '{"nombre":"Productora Trucha"}')
chk "un anonimo no puede crear productoras" $([ "$c" != "201" ] && [ "$c" != "200" ]; echo $?) "HTTP $c"
c=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$BASE/rest/v1/usuario" \
    -H "apikey: $NUEVA" -H "Content-Type: application/json" \
    -d '{"nombre":"Colado","rol":"admin"}')
chk "un anonimo no puede darse de alta" $([ "$c" != "201" ] && [ "$c" != "200" ]; echo $?) "HTTP $c"

# ---------- 7. la suite local, sin navegador ----------
if [ "$v" = "1" ]; then
  falladas=""
  for s in pruebas parser desglose importar callsheet pegado libre contactos rodaje \
           sica gastos plata resumen guia backend flujo tags importar-callsheets alta; do
    sal=$(node /d/Cuadro/test/run.js /d/Cuadro/test/$s.js 2>&1)
    echo "$sal" | grep -qE "TODO OK|FLUJO COMPLETO OK" || falladas="$falladas $s"
  done
  chk "las 19 suites de tests pasan" $([ -z "$falladas" ]; echo $?) "${falladas:-todas}"
fi

# ---------- 8. el signup sigue exigiendo mail real ----------
conf=$(curl -sS "$BASE/auth/v1/settings" -H "apikey: $NUEVA" | grep -o '"mailer_autoconfirm":[a-z]*' | cut -d: -f2)
chk "Supabase sigue pidiendo confirmar el mail" $([ "$conf" = "false" ]; echo $?) "autoconfirm=$conf"

echo
done

echo "════════════════════════════════════════════════════"
echo "  $ok pruebas OK · $mal fallas   (en $VUELTAS vueltas)"
if [ ${#fallos[@]} -gt 0 ]; then
  echo "  Lo que fallo:"
  for k in "${!fallos[@]}"; do echo "    - $k  (${fallos[$k]} veces)"; done
fi
echo "════════════════════════════════════════════════════"
[ "$mal" = "0" ]
