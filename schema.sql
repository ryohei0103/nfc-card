-- NFC電子名刺アプリ スキーマ
-- Supabaseプロジェクト: NFC電子名刺 (project_id: pzthxojdpzrqqevzyhjj, region: ap-northeast-1)

-- =========================================
-- profiles: ユーザー1人につき1枚の名刺ページ
-- =========================================
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  slug text not null unique,
  display_name text not null default '',
  furigana text not null default '',
  company text not null default '',
  position text not null default '',
  bio text not null default '',
  avatar_url text,
  phone text,
  email text,
  links jsonb not null default '[]'::jsonb,
  theme jsonb not null default '{}'::jsonb,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint slug_format check (slug ~ '^[a-z0-9](-?[a-z0-9]+)*$' and char_length(slug) between 3 and 40)
);

create index profiles_slug_idx on public.profiles (slug);

-- updated_at自動更新
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- 公開ページは誰でも閲覧可（非公開は本人のみ）
create policy "profiles_select_public_or_owner"
  on public.profiles for select
  using (is_published = true or auth.uid() = user_id);

create policy "profiles_insert_owner"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "profiles_update_owner"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "profiles_delete_owner"
  on public.profiles for delete
  using (auth.uid() = user_id);

-- =========================================
-- profile_views: アクセス解析（閲覧ログ）
-- =========================================
create table public.profile_views (
  id bigserial primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index profile_views_profile_id_idx on public.profile_views (profile_id, viewed_at desc);

alter table public.profile_views enable row level security;

-- 誰でも(閲覧者として)記録を追加できる。参照できるのは名刺の持ち主のみ。
create policy "profile_views_insert_anyone"
  on public.profile_views for insert
  with check (
    exists (select 1 from public.profiles p where p.id = profile_id and p.is_published = true)
  );

create policy "profile_views_select_owner"
  on public.profile_views for select
  using (
    exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid())
  );

-- =========================================
-- contact_saves: 連絡先保存(vCardダウンロード)のログ
-- =========================================
create table public.contact_saves (
  id bigserial primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  saved_at timestamptz not null default now()
);

create index contact_saves_profile_id_idx on public.contact_saves (profile_id, saved_at desc);

alter table public.contact_saves enable row level security;

create policy "contact_saves_insert_anyone"
  on public.contact_saves for insert
  with check (
    exists (select 1 from public.profiles p where p.id = profile_id and p.is_published = true)
  );

create policy "contact_saves_select_owner"
  on public.contact_saves for select
  using (
    exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid())
  );

-- =========================================
-- Storage: アバター・壁紙画像
-- =========================================
insert into storage.buckets (id, name, public)
values ('profile-assets', 'profile-assets', true)
on conflict (id) do nothing;

-- 誰でも閲覧可（公開名刺に画像を出すため）
create policy "profile_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'profile-assets');

-- 自分のuser_idフォルダ配下にのみアップロード・更新・削除可
create policy "profile_assets_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profile_assets_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'profile-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profile_assets_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'profile-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
