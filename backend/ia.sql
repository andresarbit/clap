-- ===========================================================================
-- CLAP · LA IA (OPCIONAL, PAGA) · el contador de uso
--
-- Sólo hace falta si se decide prender la IA (ver backend/PASOS.md, "La IA").
-- Mientras no haya una clave de Anthropic cargada en Supabase, esto no se usa
-- y no cuesta nada.
--
-- COPIÁ TODO, PEGALO EN Supabase -> SQL Editor -> New query y apretá RUN.
-- Se puede correr varias veces.
--
-- Cuenta cuántas veces por mes usa la IA cada productora y frena al llegar al
-- tope (IA_TOPE_MENSUAL en los secretos de la función; si no está, 300). Así
-- un error o un abuso no se convierte en una factura.
-- ===========================================================================

begin;

create table if not exists uso_ia (
  productora_id uuid not null references productora(id) on delete cascade,
  mes           text not null,          -- '2026-10'
  usos          int  not null default 0,
  primary key (productora_id, mes)
);
alter table uso_ia enable row level security;
-- sin políticas: nadie la lee ni la escribe desde la página; sólo la función

-- Suma `p_cuanto` al mes en curso si no se pasa del tope y devuelve cuántos
-- usos quedan contados. Si se pasaría del tope, NO suma y devuelve el número
-- que habría quedado (mayor que el tope): la función entiende que se llegó.
create or replace function sumar_uso_ia(p_productora uuid, p_cuanto int, p_tope int)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_mes  text := to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM');
  v_usos int;
begin
  insert into uso_ia (productora_id, mes, usos) values (p_productora, v_mes, 0)
  on conflict (productora_id, mes) do nothing;
  select usos into v_usos from uso_ia where productora_id = p_productora and mes = v_mes for update;
  if p_cuanto > 0 and v_usos + p_cuanto > p_tope then
    return v_usos + p_cuanto;
  end if;
  update uso_ia set usos = usos + greatest(p_cuanto, 0)
   where productora_id = p_productora and mes = v_mes
  returning usos into v_usos;
  return v_usos;
end $$;

revoke all on function sumar_uso_ia(uuid, int, int) from public, anon, authenticated;
grant execute on function sumar_uso_ia(uuid, int, int) to service_role;

commit;

select 'Listo: el contador de la IA está. Falta cargar la clave (ver PASOS.md).' as "Resultado";
