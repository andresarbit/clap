-- =============================================================================
-- CLAP · esquema de base de datos (PostgreSQL / Supabase)
--
-- Esto NO esta en uso todavia. Es la traduccion del modelo de datos que hoy
-- vive en localStorage, para cuando montemos el backend. Se publica ahora
-- porque el modelo ya esta probado contra uso real y conviene fijarlo.
--
-- Por que Postgres y no una planilla:
--   · Los datos son anidados (un presupuesto tiene rubros, que tienen lineas)
--     y una hoja de calculo obliga a aplanarlos y a repetir todo.
--   · Hace falta que dos personas escriban a la vez sin pisarse.
--   · Hacen falta permisos de verdad: que arte NO pueda aprobar un pago. En
--     una planilla compartida, quien puede leer puede editar.
--   · Hay archivos adjuntos (fotos de comprobantes) que no van en una celda.
--
-- El aislamiento entre productoras se hace con Row Level Security: cada fila
-- lleva productora_id y la base misma impide leer las de otra. No depende de
-- que la interfaz "se acuerde" de filtrar.
-- =============================================================================

begin;

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------- catalogos
create type rol_usuario  as enum ('equipo','produccion','ejecutivo','admin');
create type estado_cbte  as enum ('cargado','revisado','aprobado','pagado','rechazado');
create type estado_oc    as enum ('borrador','emitida','cumplida','anulada');
create type estado_caja  as enum ('abierta','rendida');
create type moneda       as enum ('ARS','USD');
-- como se paga y con que respaldo: dos ejes separados a proposito
create type circuito_pago as enum ('transferencia','cheque','debito','mp','efectivo','usd','cripto');
create type respaldo_doc  as enum ('facA','facBC','reciboX','reciboS','ticket','ninguno');

-- ------------------------------------------------------------- organizacion
-- El estudio que administra varias productoras (el caso de Andres).
create table organizacion (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  creado_el   timestamptz not null default now()
);

create table productora (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizacion(id) on delete cascade,
  nombre         text not null,
  cuit           text,
  condicion_iva  text,
  jurisdiccion   text,
  fee_default          numeric(6,3) not null default 15,
  contingencia_default numeric(6,3) not null default 5,
  iva_default          numeric(6,3) not null default 21,
  iibb_default         numeric(6,3) not null default 0,
  -- false = el que entra elige su rol y queda activo (comodo mientras son
  -- pocos y se conocen). true = queda pendiente hasta que un admin lo apruebe.
  requiere_aprobacion boolean not null default false,
  creado_el      timestamptz not null default now()
);
create index on productora (org_id);

-- Personas con acceso al sistema. auth_uid enlaza con el login de Supabase.
create table usuario (
  id           uuid primary key default gen_random_uuid(),
  auth_uid     uuid unique,                       -- null = todavia no acepto la invitacion
  productora_id uuid not null references productora(id) on delete cascade,
  nombre       text not null,
  rol          rol_usuario not null default 'equipo',
  depto        text,
  email        text,
  tel          text,
  activo       boolean not null default true,
  -- se dio de alta solo y todavia nadie de la productora lo aprobo. Mientras
  -- este pendiente no tiene acceso a nada: puede entrar y esperar, nada mas.
  pendiente    boolean not null default false,
  area         text,                              -- el departamento que declara
  alta_el      timestamptz not null default now()
);
create index on usuario (productora_id);
create index on usuario (auth_uid);

-- ------------------------------------------------------------------ catalogo
-- Personas, proveedores y equipos. Vive a nivel de la ORG, no de la
-- productora: es el activo que se comparte entre todas.
create table catalogo_persona (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizacion(id) on delete cascade,
  tipo        text not null default 'persona',    -- persona | proveedor | equipo
  nombre      text not null,
  funcion     text,
  rubro       text,
  dni         text,
  cuit        text,
  fecha_nac   date,
  condicion   text,
  tarifa_ref  numeric(14,2) default 0,
  moneda      moneda default 'ARS',
  unidad      text default 'jornada',
  tel         text,
  email       text,
  banco       text,
  alias       text
);
create index on catalogo_persona (org_id);
create index on catalogo_persona (org_id, rubro);

-- ------------------------------------------------------------------ proyecto
create table proyecto (
  id            uuid primary key default gen_random_uuid(),
  productora_id uuid not null references productora(id) on delete cascade,
  nombre        text not null,
  tipo          text default 'publicidad',
  cliente       text,
  agencia       text,
  producto      text,
  territorio    text,
  plazo         text,
  medios        text,
  jornadas      int default 1,
  -- condiciones de rodaje: cambian por convenio y por tipo de trabajo
  horas_jornada   numeric(5,2) not null default 8,
  recargo_he      numeric(6,3) not null default 50,
  descontar_comida boolean not null default true,
  min_turnaround  numeric(5,2) not null default 12,
  tel_produccion  text,
  archivado     boolean not null default false,
  creado_el     timestamptz not null default now()
);
create index on proyecto (productora_id);

-- --------------------------------------------------------------- presupuesto
create table version_presupuesto (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references proyecto(id) on delete cascade,
  nombre       text not null default 'v1',
  estado       text not null default 'borrador',
  moneda_base  moneda not null default 'ARS',
  tc           numeric(14,4) not null default 1000,
  tc_nombre    text default 'MEP',
  tc_fecha     date,                              -- clave para reclamar reajuste
  fee          numeric(6,3) not null default 15,
  contingencia numeric(6,3) not null default 5,
  iibb         numeric(6,3) not null default 0,
  iva          numeric(6,3) not null default 21,
  notas        text,
  creado_el    timestamptz not null default now()
);
create index on version_presupuesto (proyecto_id);

create table rubro_version (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references version_presupuesto(id) on delete cascade,
  codigo      text not null,
  nombre      text not null,
  aplica_fee  boolean not null default true,
  orden       int,
  unique (version_id, codigo)
);

create table linea_presupuesto (
  id          uuid primary key default gen_random_uuid(),
  rubro_id    uuid not null references rubro_version(id) on delete cascade,
  concepto    text not null default '',
  ref_id      uuid references catalogo_persona(id) on delete set null,
  cantidad    numeric(12,3) not null default 1,
  dias        numeric(12,3) not null default 1,
  unidad      text default 'jornada',
  valor_unit  numeric(14,2) not null default 0,
  moneda      moneda not null default 'ARS',
  circuito    circuito_pago,
  comprobante respaldo_doc,
  notas       text,
  orden       int
);
create index on linea_presupuesto (rubro_id);

-- -------------------------------------------------------- desglose de guion
create table desglose (
  proyecto_id        uuid primary key references proyecto(id) on delete cascade,
  guion              text,
  modo               text,                        -- encabezados | parrafos | bloque
  paginas_por_jornada numeric(6,3) default 4,
  importado_el       date
);

create table escena (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyecto(id) on delete cascade,
  numero      text not null,
  encabezado  text,
  int_ext     text not null default 'INT',
  locacion    text,
  momento     text,
  texto       text,
  octavos     int not null default 1,
  jornada     int,
  notas       text,
  orden       int
);
create index on escena (proyecto_id);
create index on escena (proyecto_id, jornada);

-- Personajes y elementos: filas, no arrays, para poder preguntar
-- "en que escenas aparece el perro" sin recorrer todo.
create table escena_personaje (
  escena_id  uuid not null references escena(id) on delete cascade,
  personaje  text not null,
  primary key (escena_id, personaje)
);
create table escena_elemento (
  escena_id  uuid not null references escena(id) on delete cascade,
  depto      text not null,                       -- utileria, vestuario, vehiculos...
  elemento   text not null,
  sugerido   boolean not null default false,      -- lo propuso el diccionario
  primary key (escena_id, depto, elemento)
);

-- ------------------------------------------------------------------ jornadas
create table jornada (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyecto(id) on delete cascade,
  numero      int not null,
  fecha       date,
  citacion    time, comida time, wrap time,
  amanecer    time, atardecer time,
  clima       text, clima_real text,
  hospital_nombre text, hospital_direccion text, hospital_tel text,
  emergencia_nombre text, emergencia_tel text,
  -- parte de rodaje
  primera_toma time, comida_in time, comida_out time, ultima_toma time,
  comidas_servidas int default 0,
  incidencias text,
  notas       text,
  unique (proyecto_id, numero)
);

create table jornada_locacion (
  jornada_id uuid not null references jornada(id) on delete cascade,
  locacion   text not null,
  direccion  text, contacto text, notas text,
  primary key (jornada_id, locacion)
);

-- Citacion y fichada de cada persona en cada jornada.
-- clave_persona referencia una linea de presupuesto o un personaje del guion.
create table jornada_persona (
  jornada_id    uuid not null references jornada(id) on delete cascade,
  clave_persona text not null,
  citacion   time, maquillaje time, en_set time,
  entrada    time, salida time,
  citado     boolean not null default false,
  nota       text,
  primary key (jornada_id, clave_persona)
);

create table jornada_escena_filmada (
  jornada_id uuid not null references jornada(id) on delete cascade,
  escena_id  uuid not null references escena(id) on delete cascade,
  primary key (jornada_id, escena_id)
);

-- ------------------------------------------------------------------- plata
create table orden_compra (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyecto(id) on delete cascade,
  numero      text not null,
  rubro       text not null,
  subrubro    text,
  concepto    text,
  proveedor   text,
  cuit        text,
  importe     numeric(14,2) not null,
  moneda      moneda not null default 'ARS',
  fecha       date not null default current_date,
  entrega     text,
  condicion   text,
  estado      estado_oc not null default 'borrador',
  emitida_por uuid references usuario(id) on delete set null,
  emitida_el  timestamptz,
  notas       text,
  unique (proyecto_id, numero)
);
create index on orden_compra (proyecto_id, estado);

create table caja_chica (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyecto(id) on delete cascade,
  nombre      text not null,
  responsable uuid references usuario(id) on delete set null,
  jornada     int,
  moneda      moneda not null default 'ARS',
  estado      estado_caja not null default 'abierta',
  rendida_el  date,
  rendida_por uuid references usuario(id) on delete set null,
  devuelto    numeric(14,2) default 0,
  reintegro   numeric(14,2) default 0,
  notas       text
);
create index on caja_chica (proyecto_id, estado);

create table caja_adelanto (
  id          uuid primary key default gen_random_uuid(),
  caja_id     uuid not null references caja_chica(id) on delete cascade,
  fecha       date not null default current_date,
  importe     numeric(14,2) not null,
  circuito    circuito_pago,
  entregado_por uuid references usuario(id) on delete set null,
  nota        text
);
create index on caja_adelanto (caja_id);

create table comprobante (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyecto(id) on delete cascade,
  rubro       text not null,                      -- obligatorio: sin rubro no se imputa
  subrubro    text,
  concepto    text,
  proveedor   text,
  cuit        text,
  tipo        respaldo_doc,
  numero      text,
  fecha       date not null default current_date,
  importe     numeric(14,2) not null,
  moneda      moneda not null default 'ARS',
  circuito    circuito_pago,
  linea_id    uuid references linea_presupuesto(id) on delete set null,
  oc_id       uuid references orden_compra(id) on delete set null,
  caja_id     uuid references caja_chica(id) on delete set null,
  jornada     int,
  estado      estado_cbte not null default 'cargado',
  cargado_por uuid references usuario(id) on delete set null,
  cargado_el  timestamptz not null default now(),
  notas       text
);
create index on comprobante (proyecto_id, rubro);
create index on comprobante (proyecto_id, estado);
create index on comprobante (oc_id);
create index on comprobante (caja_id);

-- Quien hizo que y cuando. Se escribe, nunca se edita ni se borra.
create table comprobante_paso (
  id            uuid primary key default gen_random_uuid(),
  comprobante_id uuid not null references comprobante(id) on delete cascade,
  de_estado     estado_cbte,
  a_estado      estado_cbte not null,
  accion        text not null,
  usuario_id    uuid references usuario(id) on delete set null,
  usuario_nombre text,                            -- copia, por si el usuario se borra
  rol           rol_usuario,
  nota          text,
  fecha         timestamptz not null default now()
);
create index on comprobante_paso (comprobante_id, fecha);

-- Las fotos van a Supabase Storage; aca queda la referencia, no el archivo.
create table adjunto (
  id            uuid primary key default gen_random_uuid(),
  comprobante_id uuid not null references comprobante(id) on delete cascade,
  bucket        text not null default 'comprobantes',
  path          text not null,
  nombre        text,
  tipo          text,
  bytes         int,
  ancho         int, alto int,
  subido_por    uuid references usuario(id) on delete set null,
  subido_el     timestamptz not null default now()
);
create index on adjunto (comprobante_id);

-- ------------------------------------------------------------- contactos
create table contacto_proyecto (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyecto(id) on delete cascade,
  clave       text,                               -- linea de presupuesto, locacion, o suelto
  grupo       text,
  rol         text,
  nombre      text,
  tel         text,
  email       text,
  notas       text
);
create index on contacto_proyecto (proyecto_id);

-- =============================================================================
-- AISLAMIENTO Y PERMISOS · Row Level Security en LAS 23 TABLAS
--
-- Sin esto, cualquiera con la clave anónima —que es pública por diseño y viaja
-- en el navegador— puede leer y escribir todo. El editor de Supabase avisa
-- justamente de eso.
--
-- La regla es una sola: cada fila pertenece a una productora, directa o por
-- cadena, y sólo la ve quien es usuario de esa productora. Lo que cambia por
-- tabla es el camino para llegar a la productora.
-- =============================================================================

-- ------------------------------------------------------------ quién soy yo
-- security definer: estas funciones leen `usuario` salteando su propia RLS,
-- si no se muerden la cola.

create or replace function mis_productoras() returns setof uuid
language sql stable security definer set search_path = public as $$
  select productora_id from usuario
   where auth_uid = auth.uid() and activo and not pendiente
$$;

create or replace function mis_orgs() returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct p.org_id from productora p
  where p.id in (select productora_id from usuario
                  where auth_uid = auth.uid() and activo and not pendiente)
$$;

create or replace function mi_rol(p uuid) returns rol_usuario
language sql stable security definer set search_path = public as $$
  select rol from usuario
  where auth_uid = auth.uid() and productora_id = p and activo and not pendiente limit 1
$$;

-- ¿Puedo ver este proyecto? Es el pivote: casi todo cuelga de acá.
create or replace function puedo_proyecto(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from proyecto
    where id = p and productora_id in (select productora_id from usuario
                                       where auth_uid = auth.uid() and activo and not pendiente))
$$;

-- El rol que tengo en la productora dueña de este proyecto.
create or replace function mi_rol_en_proyecto(p uuid) returns rol_usuario
language sql stable security definer set search_path = public as $$
  select u.rol from proyecto pr
  join usuario u on u.productora_id = pr.productora_id
  where pr.id = p and u.auth_uid = auth.uid() and u.activo and not u.pendiente limit 1
$$;

-- ---------------------------------------------------------- prender RLS
-- En TODAS. Una tabla con RLS y sin política no deja pasar nada, que es el
-- default correcto: si abajo me olvido de alguna, se nota enseguida.

alter table organizacion            enable row level security;
alter table productora             enable row level security;
alter table usuario                enable row level security;
alter table catalogo_persona       enable row level security;
alter table proyecto               enable row level security;
alter table version_presupuesto    enable row level security;
alter table rubro_version          enable row level security;
alter table linea_presupuesto      enable row level security;
alter table desglose               enable row level security;
alter table escena                 enable row level security;
alter table escena_personaje       enable row level security;
alter table escena_elemento        enable row level security;
alter table jornada                enable row level security;
alter table jornada_locacion       enable row level security;
alter table jornada_persona        enable row level security;
alter table jornada_escena_filmada enable row level security;
alter table orden_compra           enable row level security;
alter table caja_chica             enable row level security;
alter table caja_adelanto          enable row level security;
alter table comprobante            enable row level security;
alter table comprobante_paso       enable row level security;
alter table adjunto                enable row level security;
alter table contacto_proyecto      enable row level security;

-- ------------------------------------------------- organización y productora

create policy org_mia on organizacion for all
  using (id in (select mis_orgs()))
  with check (id in (select mis_orgs()));

-- Cualquiera con sesión puede crear SU organización y SU productora: si no,
-- no habría forma de empezar. El trigger de abajo lo hace usuario admin de
-- lo que crea, y a partir de ahí las políticas normales lo encierran.
create policy org_crear on organizacion for insert to authenticated with check (true);

create policy productora_mia on productora for all
  using (id in (select mis_productoras()))
  with check (id in (select mis_productoras()));
create policy productora_crear on productora for insert to authenticated with check (true);

-- --------------------------------------------------------------- usuarios
-- Todos ven quiénes son sus compañeros; sólo admin y ejecutivo dan de alta,
-- cambian roles o desactivan.

create policy usuario_ver on usuario for select
  using (productora_id in (select mis_productoras()));
-- siempre puedo ver MI propia ficha, aunque este pendiente: es lo que me deja
-- saber en que estado quedo mi solicitud.
create policy usuario_ver_mia on usuario for select
  using (auth_uid = auth.uid());
create policy usuario_alta on usuario for insert
  with check (mi_rol(productora_id) in ('admin','ejecutivo'));
-- Alta propia al entrar por primera vez: uno declara su rol, su area y a que
-- productora se suma, pero entra PENDIENTE. Si pudiera declararse admin y
-- quedar activo, el circuito de aprobacion no valdria nada.
create policy usuario_autoalta on usuario for insert to authenticated
  with check (
    auth_uid = auth.uid()
    and (pendiente = true or not productora_pide_aprobacion(productora_id))
  );
-- y puedo corregir mis propios datos mientras espero, sin tocar el rol
create policy usuario_editar_mia on usuario for update
  using (auth_uid = auth.uid() and pendiente)
  with check (auth_uid = auth.uid() and pendiente);
-- cerrar el candado es cosa de un admin de esa productora
create policy productora_candado on productora for update
  using (mi_rol(id) = 'admin') with check (mi_rol(id) = 'admin');
create policy usuario_editar on usuario for update
  using (mi_rol(productora_id) in ('admin','ejecutivo'))
  with check (mi_rol(productora_id) in ('admin','ejecutivo'));
create policy usuario_baja on usuario for delete
  using (mi_rol(productora_id) in ('admin','ejecutivo'));

-- ----------------------------------------------------- catálogo (por org)
create policy catalogo_mio on catalogo_persona for all
  using (org_id in (select mis_orgs()))
  with check (org_id in (select mis_orgs()));

-- --------------------------------------------------- proyecto y presupuesto

create policy proyecto_mio on proyecto for all
  using (productora_id in (select mis_productoras()))
  with check (productora_id in (select mis_productoras()));

create policy version_mia on version_presupuesto for all
  using (puedo_proyecto(proyecto_id))
  with check (puedo_proyecto(proyecto_id));

create policy rubro_mio on rubro_version for all
  using (exists(select 1 from version_presupuesto v
                where v.id = version_id and puedo_proyecto(v.proyecto_id)))
  with check (exists(select 1 from version_presupuesto v
                where v.id = version_id and puedo_proyecto(v.proyecto_id)));

create policy linea_mia on linea_presupuesto for all
  using (exists(select 1 from rubro_version r
                join version_presupuesto v on v.id = r.version_id
                where r.id = rubro_id and puedo_proyecto(v.proyecto_id)))
  with check (exists(select 1 from rubro_version r
                join version_presupuesto v on v.id = r.version_id
                where r.id = rubro_id and puedo_proyecto(v.proyecto_id)));

-- ------------------------------------------------------------- desglose

create policy desglose_mio on desglose for all
  using (puedo_proyecto(proyecto_id)) with check (puedo_proyecto(proyecto_id));

create policy escena_mia on escena for all
  using (puedo_proyecto(proyecto_id)) with check (puedo_proyecto(proyecto_id));

create policy escena_pers_mia on escena_personaje for all
  using (exists(select 1 from escena e where e.id = escena_id and puedo_proyecto(e.proyecto_id)))
  with check (exists(select 1 from escena e where e.id = escena_id and puedo_proyecto(e.proyecto_id)));

create policy escena_elem_mia on escena_elemento for all
  using (exists(select 1 from escena e where e.id = escena_id and puedo_proyecto(e.proyecto_id)))
  with check (exists(select 1 from escena e where e.id = escena_id and puedo_proyecto(e.proyecto_id)));

-- ------------------------------------------------------------- jornadas

create policy jornada_mia on jornada for all
  using (puedo_proyecto(proyecto_id)) with check (puedo_proyecto(proyecto_id));

create policy jloc_mia on jornada_locacion for all
  using (exists(select 1 from jornada j where j.id = jornada_id and puedo_proyecto(j.proyecto_id)))
  with check (exists(select 1 from jornada j where j.id = jornada_id and puedo_proyecto(j.proyecto_id)));

create policy jpers_mia on jornada_persona for all
  using (exists(select 1 from jornada j where j.id = jornada_id and puedo_proyecto(j.proyecto_id)))
  with check (exists(select 1 from jornada j where j.id = jornada_id and puedo_proyecto(j.proyecto_id)));

create policy jfilm_mia on jornada_escena_filmada for all
  using (exists(select 1 from jornada j where j.id = jornada_id and puedo_proyecto(j.proyecto_id)))
  with check (exists(select 1 from jornada j where j.id = jornada_id and puedo_proyecto(j.proyecto_id)));

-- ---------------------------------------------------------------- plata
-- Acá es donde los permisos dejan de ser cosmética.

-- Órdenes de compra: todos las ven, sólo ejecutivo y admin las emiten o tocan.
create policy oc_ver on orden_compra for select using (puedo_proyecto(proyecto_id));
create policy oc_crear on orden_compra for insert
  with check (puedo_proyecto(proyecto_id)
              and mi_rol_en_proyecto(proyecto_id) in ('admin','ejecutivo','produccion'));
create policy oc_editar on orden_compra for update
  using (puedo_proyecto(proyecto_id))
  with check (estado <> 'emitida'
              or mi_rol_en_proyecto(proyecto_id) in ('admin','ejecutivo'));
create policy oc_borrar on orden_compra for delete
  using (mi_rol_en_proyecto(proyecto_id) in ('admin','ejecutivo'));

create policy caja_mia on caja_chica for all
  using (puedo_proyecto(proyecto_id)) with check (puedo_proyecto(proyecto_id));

create policy adelanto_mio on caja_adelanto for all
  using (exists(select 1 from caja_chica c where c.id = caja_id and puedo_proyecto(c.proyecto_id)))
  with check (exists(select 1 from caja_chica c where c.id = caja_id and puedo_proyecto(c.proyecto_id)));

-- Comprobantes: cualquiera del equipo carga; el estado sólo lo mueve quien
-- corresponde. Esto es lo que hoy, sin servidor, no se puede hacer cumplir.
create policy cbte_ver on comprobante for select using (puedo_proyecto(proyecto_id));

create policy cbte_cargar on comprobante for insert
  with check (puedo_proyecto(proyecto_id) and estado = 'cargado');

create policy cbte_mover on comprobante for update
  using (puedo_proyecto(proyecto_id))
  with check (
    case estado
      when 'pagado'    then mi_rol_en_proyecto(proyecto_id) = 'admin'
      when 'aprobado'  then mi_rol_en_proyecto(proyecto_id) in ('admin','ejecutivo')
      when 'revisado'  then mi_rol_en_proyecto(proyecto_id) in ('admin','ejecutivo','produccion')
      when 'rechazado' then mi_rol_en_proyecto(proyecto_id) in ('admin','ejecutivo','produccion')
      else true
    end);

create policy cbte_borrar on comprobante for delete
  using (mi_rol_en_proyecto(proyecto_id) in ('admin','ejecutivo'));

-- El recorrido se escribe y no se toca: es la auditoría.
create policy paso_ver on comprobante_paso for select
  using (exists(select 1 from comprobante c where c.id = comprobante_id and puedo_proyecto(c.proyecto_id)));
create policy paso_escribir on comprobante_paso for insert
  with check (exists(select 1 from comprobante c where c.id = comprobante_id and puedo_proyecto(c.proyecto_id)));
-- a propósito NO hay política de update ni de delete: nadie reescribe la historia.

create policy adjunto_mio on adjunto for all
  using (exists(select 1 from comprobante c where c.id = comprobante_id and puedo_proyecto(c.proyecto_id)))
  with check (exists(select 1 from comprobante c where c.id = comprobante_id and puedo_proyecto(c.proyecto_id)));

create policy contacto_mio on contacto_proyecto for all
  using (puedo_proyecto(proyecto_id)) with check (puedo_proyecto(proyecto_id));

-- Al darse de alta hay que elegir a que productora sumarse, pero RLS todavia
-- no deja ver ninguna. Esta funcion devuelve SOLO id y nombre, nada mas.
create or replace function productora_pide_aprobacion(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select requiere_aprobacion from productora where id = p), false)
$$;
revoke all on function productora_pide_aprobacion(uuid) from public;
grant execute on function productora_pide_aprobacion(uuid) to authenticated;

create or replace function productoras_para_elegir()
returns table(id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre from productora p order by p.nombre
$$;
revoke all on function productoras_para_elegir() from public;
grant execute on function productoras_para_elegir() to authenticated;

-- ------------------------------------------------------------- arranque
-- Al crear una productora, quien la crea queda como su administrador. Sin
-- esto, el primero que entra crea una productora que después no puede ver.

create or replace function alta_primer_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and not exists(select 1 from usuario where productora_id = new.id) then
    insert into usuario (auth_uid, productora_id, nombre, rol, email, pendiente)
    values (auth.uid(), new.id,
            coalesce((select raw_user_meta_data->>'nombre' from auth.users where id = auth.uid()),
                     (select email from auth.users where id = auth.uid()), 'Yo'),
            'admin',
            (select email from auth.users where id = auth.uid()),
            false);   -- quien crea la productora no espera aprobacion de nadie
  end if;
  return new;
end $$;

drop trigger if exists tr_alta_primer_usuario on productora;
create trigger tr_alta_primer_usuario after insert on productora
  for each row execute function alta_primer_usuario();

commit;


-- =============================================================================
-- COMPROBAR QUE QUEDÓ BIEN
-- Después de correr esto, pegá esta consulta: no tiene que devolver NINGUNA
-- fila. Si alguna tabla aparece, le falta RLS o le faltan políticas.
-- =============================================================================
-- select c.relname as tabla,
--        c.relrowsecurity as tiene_rls,
--        count(p.polname) as politicas
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--   left join pg_policy p on p.polrelid = c.oid
--  where n.nspname = 'public' and c.relkind = 'r'
--  group by 1,2
-- having c.relrowsecurity = false or count(p.polname) = 0;
