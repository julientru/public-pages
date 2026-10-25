-- Kids Games: player accounts (name + PIN) and best scores.
-- Run this once in your Supabase project: SQL Editor → New query → paste all of it → Run.
--
-- Kids sign in with a name and a 4 to 6 digit PIN: no email, no password, nothing personal.
-- This does not use Supabase Auth. The site only talks to the functions at the bottom,
-- which check the PIN and hand out a sign-in token; tables can't be written to directly.

create extension if not exists pgcrypto with schema extensions;

-- ---------- Players ----------
-- The PIN is stored hashed (bcrypt), never as typed. After 5 wrong PINs in a row
-- the name is locked for 10 minutes, so nobody can try all the PINs.
create table public.players (
  id uuid primary key default gen_random_uuid(),
  username text not null check (username ~ '^[A-Za-z0-9]{2,16}$'),
  pin_hash text not null,
  wrong_pins integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);
-- "Sam" and "sam" are the same player.
create unique index players_username_key on public.players (lower(username));

-- One row per signed-in device. The token is kept in that browser.
create table public.sessions (
  token uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- Scores ----------
-- Every finished round. level is the difficulty it was played on ("" when the game has none).
create table public.scores (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  game text not null,
  level text not null default '' check (level ~ '^[a-z-]{0,20}$'),
  score integer not null,
  played_at timestamptz not null default now(),
  saved_at timestamptz not null default now(),
  -- Scores must be possible: a game we know, and no more than the game allows.
  constraint score_is_plausible check (
    score > 0 and score <= case game
      when 'army' then 500
      when 'army3d' then 500
      when 'armyfps' then 500
      when 'tetris' then 200000
      when 'jump' then 2000
      when 'simon' then 100
      when 'odd' then 10
      else 0
    end
  ),
  -- Without a city, Army Rush has 12 waves; with one (level "…-city") it goes on until you lose.
  constraint army_waves check (game not in ('army', 'army3d', 'armyfps') or level like '%-city' or score <= 12)
);
create index scores_game_score on public.scores (game, score desc);
create index scores_player on public.scores (player_id);

-- ---------- Who may do what (row-level security) ----------
-- Everyone (even signed out) can read names and scores, for the Best scores page.
-- Nobody can write, change or delete anything directly: only through the functions below,
-- and those only write scores for the player whose token they are given.
alter table public.players enable row level security;
alter table public.sessions enable row level security;
alter table public.scores enable row level security;

revoke all on public.players, public.sessions, public.scores from anon, authenticated;
grant select (id, username) on public.players to anon, authenticated;
grant select on public.scores to anon, authenticated;

create policy "Everyone can see player names" on public.players
  for select to anon, authenticated using (true);
create policy "Everyone can see scores" on public.scores
  for select to anon, authenticated using (true);

-- ---------- Best score of each player in each game ----------
create view public.best_scores with (security_invoker = true) as
  select distinct on (s.game, s.player_id)
    s.game, s.player_id, p.username, s.level, s.score, s.played_at
  from public.scores s
  join public.players p on p.id = s.player_id
  order by s.game, s.player_id, s.score desc, s.played_at;

grant select on public.best_scores to anon, authenticated;

-- ---------- Functions the site calls ----------
-- Each returns JSON: { token, player_id, username } on success, or { error: "..." }.

create function public.sign_up(p_username text, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_player public.players;
  v_token uuid;
begin
  if p_username is null or p_username !~ '^[A-Za-z0-9]{2,16}$' then return jsonb_build_object('error', 'bad_name'); end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then return jsonb_build_object('error', 'bad_pin'); end if;
  begin
    insert into public.players (username, pin_hash)
      values (p_username, extensions.crypt(p_pin, extensions.gen_salt('bf')))
      returning * into v_player;
  exception when unique_violation then
    return jsonb_build_object('error', 'name_taken');
  end;
  insert into public.sessions (player_id) values (v_player.id) returning token into v_token;
  return jsonb_build_object('token', v_token, 'player_id', v_player.id, 'username', v_player.username);
end;
$$;

create function public.log_in(p_username text, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_player public.players;
  v_token uuid;
begin
  select * into v_player from public.players where lower(username) = lower(p_username);
  if not found then return jsonb_build_object('error', 'wrong'); end if;
  if v_player.locked_until > now() then return jsonb_build_object('error', 'locked'); end if;
  if p_pin is null or extensions.crypt(p_pin, v_player.pin_hash) <> v_player.pin_hash then
    update public.players
      set wrong_pins = case when wrong_pins >= 4 then 0 else wrong_pins + 1 end,
          locked_until = case when wrong_pins >= 4 then now() + interval '10 minutes' else locked_until end
      where id = v_player.id;
    return jsonb_build_object('error', 'wrong');
  end if;
  update public.players set wrong_pins = 0, locked_until = null where id = v_player.id;
  insert into public.sessions (player_id) values (v_player.id) returning token into v_token;
  return jsonb_build_object('token', v_token, 'player_id', v_player.id, 'username', v_player.username);
end;
$$;

create function public.log_out(p_token uuid) returns jsonb
language sql security definer set search_path = '' as $$
  delete from public.sessions where token = p_token;
  select '{}'::jsonb;
$$;

-- Saves up to 50 scores, given as [{ game, level, score, played_at }], for the token's player.
-- A score that is not possible is skipped. Scores saved on a device while signed out keep
-- the day they were played, but nobody can date one in the future or more than a year back.
create function public.add_scores(p_token uuid, p_scores jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_player uuid;
  v_item jsonb;
  v_when timestamptz;
  v_saved integer := 0;
begin
  select player_id into v_player from public.sessions where token = p_token;
  if v_player is null then return jsonb_build_object('error', 'signed_out'); end if;
  if jsonb_typeof(p_scores) <> 'array' then return jsonb_build_object('error', 'bad_scores'); end if;
  for v_item in select value from jsonb_array_elements(p_scores) limit 50 loop
    begin
      v_when := coalesce((v_item ->> 'played_at')::timestamptz, now());
      if v_when > now() or v_when < now() - interval '1 year' then v_when := now(); end if;
      insert into public.scores (player_id, game, level, score, played_at)
        values (v_player, v_item ->> 'game', coalesce(v_item ->> 'level', ''), (v_item ->> 'score')::integer, v_when);
      v_saved := v_saved + 1;
    exception when others then
      -- Not a possible score (or not a number): skip it.
    end;
  end loop;
  return jsonb_build_object('saved', v_saved);
end;
$$;

revoke all on function public.sign_up(text, text), public.log_in(text, text),
  public.log_out(uuid), public.add_scores(uuid, jsonb) from public;
grant execute on function public.sign_up(text, text), public.log_in(text, text),
  public.log_out(uuid), public.add_scores(uuid, jsonb) to anon, authenticated;
