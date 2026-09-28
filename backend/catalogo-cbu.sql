-- CBU en las fichas del catálogo, para la liquidación: administración
-- necesita el CBU (o el alias) de cada persona para hacer las transferencias.
--
-- Sin esta columna la app anda igual: el CBU queda en el navegador de cada
-- uno y no se comparte. Con la columna, sube y baja con el resto de la ficha.
--
-- Se corre UNA vez en Supabase: SQL Editor -> pegar -> Run.
-- Se puede correr dos veces sin problema.

alter table catalogo_persona add column if not exists cbu text;
