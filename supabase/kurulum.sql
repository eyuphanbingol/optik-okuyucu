-- =====================================================================
-- Optik Okuyucu · kurum / kullanıcı / modül tabloları
-- Supabase > SQL Editor > New query: bu dosyanın tamamını yapıştırıp "Run".
-- Birden fazla çalıştırmak zararsızdır.
-- =====================================================================

create table if not exists public.kurumlar (
  id uuid primary key default gen_random_uuid(),
  ad text not null,
  optik boolean not null default false,   -- Optik okuma modülü
  sinav boolean not null default false,   -- Sınav hazırlama modülü
  aktif boolean not null default true,    -- false: kurumun tüm kullanıcıları giriş yapsa da uygulamayı açamaz
  olusturma timestamptz not null default now()
);

create table if not exists public.profiller (
  id uuid primary key references auth.users(id) on delete cascade,
  kullanici_adi text not null unique,
  rol text not null default 'kurum' check (rol in ('admin', 'kurum')),
  kurum_id uuid references public.kurumlar(id) on delete cascade,
  olusturma timestamptz not null default now()
);

create index if not exists profiller_kurum_idx on public.profiller (kurum_id);

alter table public.kurumlar enable row level security;
alter table public.profiller enable row level security;

-- Kullanıcı yalnızca kendi profilini ve kendi kurumunu okuyabilir.
-- Yazma izni istemciye verilmez: tüm ekleme/silme/değiştirme /api/admin üzerinden (service_role) yapılır.
drop policy if exists "kendi profilini gor" on public.profiller;
create policy "kendi profilini gor" on public.profiller
  for select to authenticated using (id = auth.uid());

drop policy if exists "kendi kurumunu gor" on public.kurumlar;
create policy "kendi kurumunu gor" on public.kurumlar
  for select to authenticated using (id in (select kurum_id from public.profiller where id = auth.uid()));

grant select on public.kurumlar, public.profiller to authenticated;
grant all on public.kurumlar, public.profiller to service_role;

-- ---------------------------------------------------------------------
-- Veriler: sınavlar ve görseller kuruma, optik oturumu ve öğretmen bilgileri kullanıcıya aittir.
-- "alan" = kullanıcının kurumu (yöneticide kendi hesabı). Kimse başka kurumun verisini göremez.
-- ---------------------------------------------------------------------
create or replace function public.alanim() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce((select kurum_id from public.profiller where id = auth.uid()), auth.uid())
$$;
revoke all on function public.alanim() from public;
grant execute on function public.alanim() to authenticated;

create table if not exists public.sinavlar (
  alan uuid not null,
  id text not null,
  veri jsonb not null,
  guncelleme bigint not null default 0,
  olusturma timestamptz not null default now(),
  primary key (alan, id)
);
create index if not exists sinavlar_sira_idx on public.sinavlar (alan, guncelleme desc);

create table if not exists public.gorseller (
  alan uuid not null,
  id text not null,
  sinav_id text not null,
  genislik integer,
  yukseklik integer,
  tur text,
  olusturma timestamptz not null default now(),
  primary key (alan, id)
);
create index if not exists gorseller_sinav_idx on public.gorseller (alan, sinav_id);

create table if not exists public.kisisel (
  kullanici_id uuid primary key references auth.users(id) on delete cascade,
  optik jsonb,
  profil jsonb not null default '{}'::jsonb,
  guncelleme timestamptz not null default now()
);

alter table public.sinavlar enable row level security;
alter table public.gorseller enable row level security;
alter table public.kisisel enable row level security;

drop policy if exists "kendi alanindaki sinavlar" on public.sinavlar;
create policy "kendi alanindaki sinavlar" on public.sinavlar
  for all to authenticated using (alan = public.alanim()) with check (alan = public.alanim());

drop policy if exists "kendi alanindaki gorseller" on public.gorseller;
create policy "kendi alanindaki gorseller" on public.gorseller
  for all to authenticated using (alan = public.alanim()) with check (alan = public.alanim());

drop policy if exists "kendi kisisel kaydi" on public.kisisel;
create policy "kendi kisisel kaydi" on public.kisisel
  for all to authenticated using (kullanici_id = auth.uid()) with check (kullanici_id = auth.uid());

grant select, insert, update, delete on public.sinavlar, public.gorseller, public.kisisel to authenticated;
grant all on public.sinavlar, public.gorseller, public.kisisel to service_role;

-- Görsel dosyaları: özel (herkese kapalı) "gorseller" kovası, her kurum yalnızca kendi klasörüne erişir: <alan>/<görsel>
insert into storage.buckets (id, name, public, file_size_limit)
values ('gorseller', 'gorseller', false, 10485760)
on conflict (id) do nothing;

drop policy if exists "kendi alanindaki gorsel dosyalari" on storage.objects;
create policy "kendi alanindaki gorsel dosyalari" on storage.objects
  for all to authenticated
  using (bucket_id = 'gorseller' and (storage.foldername(name))[1] = public.alanim()::text)
  with check (bucket_id = 'gorseller' and (storage.foldername(name))[1] = public.alanim()::text);

-- ---------------------------------------------------------------------
-- İlk yönetici (admin) hesabı
-- 1) Authentication > Users > Add user > Create new user
--      Email:    admin@optik.local
--      Password: (kendi belirlediğiniz şifre)
--      "Auto Confirm User" işaretli
-- 2) Bu dosyayı (tekrar) çalıştırın: aşağıdaki satır o hesabı yönetici yapar.
--    Uygulamada kullanıcı adı "admin" ve bu şifreyle giriş yapılır.
-- ---------------------------------------------------------------------
insert into public.profiller (id, kullanici_adi, rol)
select id, 'admin', 'admin' from auth.users where email = 'admin@optik.local'
on conflict (id) do update set rol = 'admin', kullanici_adi = 'admin';
