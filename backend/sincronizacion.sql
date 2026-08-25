-- =============================================================================
-- CLAP · agregado: lo que hace falta para sincronizar
--
-- Corré esto DESPUÉS de esquema.sql y alta-propia.sql.
-- Se puede correr varias veces sin romper nada. No borra ni una fila.
--
-- Qué resuelve: hasta acá la base sabe QUÉ hay, pero no CUÁNDO cambió. Sin eso
-- no hay forma de decidir, cuando dos personas tocan lo mismo, cuál versión
-- vale. Esto le pone a cada fila una marca de tiempo que se actualiza sola.
--
-- La regla que vamos a usar es la más simple que funciona: gana el último que
-- guardó. No es perfecta —dos personas editando la misma línea al mismo
-- segundo pueden pisarse— pero es honesta y predecible, y en una productora
-- rara vez dos personas tocan la misma línea del mismo presupuesto a la vez.
-- Lo que SÍ está protegido de pisarse es el circuito de plata, porque ahí el
-- estado lo controlan las políticas y el recorrido queda escrito en
-- comprobante_paso, que nadie puede editar ni borrar.
-- =============================================================================

begin;

-- ------------------------------------------------- marca de tiempo por fila
-- Una función sola, y un trigger por tabla que la llama antes de cada update.
create or replace function marcar_actualizado() returns trigger
language plpgsql as $$
begin
  new.actualizado_el = now();
  return new;
end $$;

do $$
declare
  t text;
  tablas text[] := array[
    'organizacion','productora','usuario','catalogo_persona','proyecto',
    'version_presupuesto','rubro_version','linea_presupuesto','desglose',
    'escena','escena_personaje','escena_elemento','jornada','jornada_locacion',
    'jornada_persona','jornada_escena_filmada','orden_compra','caja_chica',
    'caja_adelanto','comprobante','comprobante_paso','adjunto','contacto_proyecto'
  ];
begin
  foreach t in array tablas loop
    execute format(
      'alter table %I add column if not exists actualizado_el timestamptz not null default now()', t);
    execute format('drop trigger if exists tr_marcar_%I on %I', t, t);
    execute format(
      'create trigger tr_marcar_%I before update on %I
         for each row execute function marcar_actualizado()', t, t);
    -- Traer "lo que cambió desde la última vez" tiene que ser barato.
    execute format(
      'create index if not exists ix_%I_actualizado on %I (actualizado_el)', t, t);
  end loop;
end $$;

-- --------------------------------------------------- ids que trae el cliente
-- CLAP genera los ids en el navegador, para poder trabajar sin señal y
-- sincronizar después. Son UUID de verdad, así que entran tal cual en la
-- clave primaria: sincronizar es un upsert y repetirlo no duplica nada.
-- Los `default gen_random_uuid()` siguen ahí para cuando el id no venga.

-- ------------------------------------------------------- borrados que viajan
-- Si alguien borra una línea en su navegador, esa baja tiene que llegar al
-- resto. CLAP anota los borrados y los manda como DELETE; para que el otro
-- lado se entere aunque no estuviera mirando, quedan asentados acá.
create table if not exists borrado (
  id            uuid primary key default gen_random_uuid(),
  productora_id uuid not null references productora(id) on delete cascade,
  tabla         text not null,
  fila_id       uuid not null,
  borrado_el    timestamptz not null default now(),
  borrado_por   uuid references usuario(id) on delete set null,
  unique (tabla, fila_id)
);
create index if not exists ix_borrado_fecha on borrado (borrado_el);

alter table borrado enable row level security;

drop policy if exists borrado_ver      on borrado;
drop policy if exists borrado_escribir on borrado;

-- Veo y anoto borrados de mis productoras, no de las ajenas.
create policy borrado_ver on borrado for select
  using (productora_id in (select mis_productoras()));
create policy borrado_escribir on borrado for insert to authenticated
  with check (productora_id in (select mis_productoras()));

commit;

-- =============================================================================
-- COMPROBAR
--
-- 1) que todas tengan la marca de tiempo (tiene que decir 23, o 24 con borrado):
--    select count(*) from information_schema.columns
--     where table_schema='public' and column_name='actualizado_el';
--
-- 2) que el trigger ande de verdad:
--    select nombre, actualizado_el from productora;
--    update productora set nombre = nombre;      -- no cambia nada, sólo toca
--    select nombre, actualizado_el from productora;   -- la fecha subió
--
-- 3) que borrado tenga RLS:
--    select relrowsecurity from pg_class where relname='borrado';
-- =============================================================================
