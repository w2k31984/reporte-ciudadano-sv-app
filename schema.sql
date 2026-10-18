-- =====================================================================
-- Reporte Ciudadano SV - Esquema para Supabase (Postgres)
-- Ejecutar completo en: Supabase > SQL Editor
-- =====================================================================

-- 1. Tipos ------------------------------------------------------------
create type report_category as enum (
  'bache', 'luminaria', 'basura', 'fuga_agua', 'drenaje', 'arbol_caido', 'otro'
);

create type report_status as enum ('recibido', 'en_proceso', 'resuelto');

-- 2. Tabla principal --------------------------------------------------
create table public.reports (
  id             uuid primary key default gen_random_uuid(),
  tracking_code  text unique not null,
  category       report_category not null default 'otro',   -- confirmada por el ciudadano
  ai_category    report_category,                            -- sugerida por la IA
  ai_summary     text,                                       -- descripcion corta generada por IA
  ai_confidence  numeric(3,2),                               -- 0.00 a 1.00
  description    text,
  photo_path     text,                                       -- ruta en Storage (bucket report-photos)
  lat            double precision not null,
  lng            double precision not null,
  address_hint   text,
  status         report_status not null default 'recibido',
  is_hidden      boolean not null default false,             -- moderacion desde el panel
  consent        boolean not null default false,             -- acepto que su foto sea usada
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint lat_range check (lat between -90 and 90),
  constraint lng_range check (lng between -180 and 180),
  constraint consent_required check (consent = true)
);

create index reports_status_idx  on public.reports (status);
create index reports_created_idx on public.reports (created_at desc);

-- 3. Historial de estados ---------------------------------------------
create table public.report_events (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.reports(id) on delete cascade,
  from_status report_status,
  to_status   report_status not null,
  note        text,
  actor       uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index report_events_report_idx on public.report_events (report_id, created_at);

-- 4. Triggers ---------------------------------------------------------
-- 4a. Codigo de seguimiento tipo SV-A3K9PQ
create or replace function public.set_tracking_code()
returns trigger language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  text;
begin
  loop
    code := 'SV-';
    for i in 1..6 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.reports where tracking_code = code);
  end loop;
  new.tracking_code := code;
  return new;
end $$;

create trigger reports_set_code
  before insert on public.reports
  for each row execute function public.set_tracking_code();

-- 4b. updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger reports_touch
  before update on public.reports
  for each row execute function public.touch_updated_at();

-- 4c. Registrar cambios de estado automaticamente
create or replace function public.log_status_change()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    insert into public.report_events (report_id, from_status, to_status, note)
    values (new.id, null, new.status, 'Reporte recibido');
  elsif new.status is distinct from old.status then
    insert into public.report_events (report_id, from_status, to_status, actor)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end $$;

create trigger reports_log_status
  after insert or update on public.reports
  for each row execute function public.log_status_change();

-- 5. Seguridad (RLS) --------------------------------------------------
alter table public.reports       enable row level security;
alter table public.report_events enable row level security;

-- Ciudadanos (anon) solo pueden CREAR reportes. No pueden leer la tabla.
create policy "anon crea reportes"
  on public.reports for insert
  to anon, authenticated
  with check (status = 'recibido' and is_hidden = false and consent = true);

-- Administradores (authenticated) leen y actualizan todo.
create policy "admin lee reportes"
  on public.reports for select
  to authenticated using (true);

create policy "admin actualiza reportes"
  on public.reports for update
  to authenticated using (true) with check (true);

create policy "admin lee historial"
  on public.report_events for select
  to authenticated using (true);

-- 6. Consulta publica por codigo de seguimiento ------------------------
-- El ciudadano consulta SOLO su reporte, sin exponer el resto de la tabla.
create or replace function public.get_report_status(code text)
returns table (
  tracking_code text,
  category      report_category,
  status        report_status,
  created_at    timestamptz,
  updated_at    timestamptz
)
language sql security definer set search_path = public as $$
  select r.tracking_code, r.category, r.status, r.created_at, r.updated_at
  from public.reports r
  where r.tracking_code = upper(trim(code)) and r.is_hidden = false;
$$;

grant execute on function public.get_report_status(text) to anon, authenticated;

-- El anonimo no puede hacer SELECT de reports. Esta funcion inserta con los
-- campos fijos de la politica (recibido, visible, con consentimiento) y
-- devuelve solo el codigo nuevo.
create or replace function public.submit_report(
  p_category report_category,
  p_description text,
  p_photo_path text,
  p_lat double precision,
  p_lng double precision,
  p_ai_category report_category,
  p_ai_summary text,
  p_ai_confidence numeric
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if p_photo_path is null
     or p_photo_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$' then
    raise exception 'foto invalida';
  end if;

  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'ubicacion invalida';
  end if;

  insert into public.reports (
    category,
    description,
    photo_path,
    lat,
    lng,
    status,
    is_hidden,
    consent,
    ai_category,
    ai_summary,
    ai_confidence
  ) values (
    p_category,
    nullif(left(btrim(coalesce(p_description, '')), 800), ''),
    p_photo_path,
    p_lat,
    p_lng,
    'recibido',
    false,
    true,
    p_ai_category,
    nullif(left(btrim(coalesce(p_ai_summary, '')), 160), ''),
    p_ai_confidence
  )
  returning tracking_code into new_code;

  return new_code;
end;
$$;

revoke all on function public.submit_report(
  report_category, text, text, double precision, double precision,
  report_category, text, numeric
) from public;

grant execute on function public.submit_report(
  report_category, text, text, double precision, double precision,
  report_category, text, numeric
) to anon, authenticated;

-- 7. Storage de fotos ---------------------------------------------------
-- Bucket privado: el admin ve las fotos con URLs firmadas.
insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', false)
on conflict (id) do nothing;

update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'report-photos';

create policy "anon sube fotos"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'report-photos');

create policy "admin lee fotos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'report-photos');

-- 8. Tiempo real --------------------------------------------------------
alter publication supabase_realtime add table public.reports;

-- 9. Datos de ejemplo para la demo -------------------------------------
-- Coordenadas aproximadas de zonas de San Salvador. Ajustalas a gusto.
-- consent = true porque son datos ficticios.
insert into public.reports (category, ai_category, ai_summary, ai_confidence, description, lat, lng, address_hint, status, consent, created_at) values
  ('bache',       'bache',       'Bache profundo en la calzada',           0.94, 'Bache grande frente a la parada de bus', 13.6989, -89.1914, 'Centro Historico',      'recibido',   true, now() - interval '3 days'),
  ('luminaria',   'luminaria',   'Poste de alumbrado sin funcionar',       0.88, 'Toda la cuadra queda oscura de noche',   13.7017, -89.2199, 'Zona Metrocentro',      'en_proceso', true, now() - interval '2 days'),
  ('basura',      'basura',      'Acumulacion de basura en la acera',      0.91, 'Llevan una semana sin recoger',          13.7060, -89.2350, 'Colonia Escalon',       'recibido',   true, now() - interval '2 days'),
  ('fuga_agua',   'fuga_agua',   'Fuga de agua en la calle',               0.86, 'Sale agua desde hace dias',              13.6900, -89.2100, 'Zona sur',              'resuelto',   true, now() - interval '5 days'),
  ('bache',       'bache',       'Varios baches consecutivos',             0.90, 'Dañan los carros al pasar',              13.7120, -89.2050, 'Zona norte',            'en_proceso', true, now() - interval '1 day'),
  ('drenaje',     'drenaje',     'Tragante obstruido',                     0.83, 'Se inunda cuando llueve',                13.6950, -89.2250, 'Colonia San Benito',    'recibido',   true, now() - interval '1 day'),
  ('arbol_caido', 'arbol_caido', 'Arbol caido bloqueando parte de la via', 0.92, 'Ocupa un carril completo',               13.7080, -89.2150, 'Cerca de la UES',       'recibido',   true, now() - interval '10 hours'),
  ('luminaria',   'luminaria',   'Luminaria parpadeando',                  0.79, 'Prende y apaga',                         13.6870, -89.1980, 'Barrio San Jacinto',    'recibido',   true, now() - interval '8 hours'),
  ('basura',      'basura',      'Basura en lote baldio',                  0.89, 'Se acumula cada semana',                 13.7150, -89.1900, 'Zona norte',            'en_proceso', true, now() - interval '6 hours'),
  ('bache',       'bache',       'Hundimiento del pavimento',              0.87, 'Se abrio despues de la lluvia',          13.7000, -89.2450, 'Colonia Escalon',       'recibido',   true, now() - interval '4 hours'),
  ('otro',        'otro',        'Señal de transito caida',                0.72, 'La señal esta en el suelo',              13.6920, -89.2300, 'Zona poniente',         'recibido',   true, now() - interval '3 hours'),
  ('fuga_agua',   'fuga_agua',   'Tuberia rota en la acera',               0.85, 'Hay charco permanente',                  13.7040, -89.2000, 'Zona centro',           'recibido',   true, now() - interval '2 hours');

-- 10. Crear el usuario administrador ------------------------------------
-- En Supabase: Authentication > Users > Add user (correo + contraseña).
-- Ese usuario queda con el rol "authenticated" y ve el panel admin.
