-- ================================================
-- SAPA — Skema Supabase
-- Jalankan file ini sekali di Supabase Dashboard →
-- SQL Editor → New query → paste semua → Run.
-- ================================================

-- Aktifkan pgcrypto di schema extensions (Supabase default)
create extension if not exists pgcrypto with schema extensions;

-- ── TABEL ──────────────────────────────────────

create table if not exists public.profiles (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  nama          text unique not null,
  pin_hash      text not null,
  theme         text default 'light',
  font_size     text default 'medium',
  created_at    timestamptz default now()
);

create table if not exists public.transaksi (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  waktu       timestamptz default now(),
  teks        text not null,
  masuk       numeric not null default 0,
  keluar      numeric not null default 0
);

create index if not exists transaksi_profile_id_idx on public.transaksi(profile_id);

-- ── ROW LEVEL SECURITY ─────────────────────────

alter table public.profiles enable row level security;
alter table public.transaksi enable row level security;

drop policy if exists "baca profil sendiri" on public.profiles;
create policy "baca profil sendiri" on public.profiles
  for select using (auth_user_id = auth.uid());

drop policy if exists "ubah profil sendiri" on public.profiles;
create policy "ubah profil sendiri" on public.profiles
  for update using (auth_user_id = auth.uid());

drop policy if exists "baca transaksi sendiri" on public.transaksi;
create policy "baca transaksi sendiri" on public.transaksi
  for select using (
    profile_id in (select id from public.profiles where auth_user_id = auth.uid())
  );

drop policy if exists "tambah transaksi sendiri" on public.transaksi;
create policy "tambah transaksi sendiri" on public.transaksi
  for insert with check (
    profile_id in (select id from public.profiles where auth_user_id = auth.uid())
  );

-- ── FUNGSI ─────────────────────────────────────
-- search_path menyertakan extensions supaya crypt()
-- dan gen_salt() dari pgcrypto bisa ditemukan.

create or replace function public.register_profile(p_nama text, p_pin text)
returns table(id uuid, nama text, theme text, font_size text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  new_id uuid;
begin
  if p_nama is null or length(trim(p_nama)) = 0 then
    raise exception 'Nama usaha wajib diisi';
  end if;
  if p_pin !~ '^\d{4}$' then
    raise exception 'PIN harus 4 angka';
  end if;

  insert into public.profiles (auth_user_id, nama, pin_hash)
  values (auth.uid(), trim(p_nama), extensions.crypt(p_pin, extensions.gen_salt('bf')))
  returning public.profiles.id into new_id;

  return query select new_id, trim(p_nama), 'light'::text, 'medium'::text;
exception
  when unique_violation then
    raise exception 'Nama usaha ini sudah dipakai, coba nama lain';
end;
$$;

create or replace function public.verify_pin(p_pin text)
returns table(id uuid, nama text, theme text, font_size text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  rec record;
begin
  select * into rec from public.profiles where auth_user_id = auth.uid();
  if not found then
    raise exception 'Profil tidak ditemukan di perangkat ini';
  end if;
  if rec.pin_hash <> extensions.crypt(p_pin, rec.pin_hash) then
    raise exception 'PIN salah, coba lagi';
  end if;
  return query select rec.id, rec.nama, rec.theme, rec.font_size;
end;
$$;

create or replace function public.claim_profile(
    p_nama text,
    p_pin text
)
returns table(
    id uuid,
    nama text,
    theme text,
    font_size text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    rec public.profiles%rowtype;
begin

    select *
    into rec
    from public.profiles p
    where p.nama = trim(p_nama);

    if not found then
        raise exception 'Nama usaha atau PIN salah';
    end if;

    if rec.pin_hash <> extensions.crypt(p_pin, rec.pin_hash) then
        raise exception 'Nama usaha atau PIN salah';
    end if;

    update public.profiles
    set auth_user_id = null
    where auth_user_id = auth.uid();

    update public.profiles p
    set auth_user_id = auth.uid()
    where p.id = rec.id;

    return query
    select
        rec.id,
        rec.nama,
        rec.theme,
        rec.font_size;

end;
$$;

grant execute on function public.register_profile(text, text) to anon, authenticated;
grant execute on function public.verify_pin(text) to anon, authenticated;
grant execute on function public.claim_profile(text, text) to anon, authenticated;

-- ── REALTIME ───────────────────────────────────
alter publication supabase_realtime add table public.transaksi;
