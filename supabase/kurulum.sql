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
