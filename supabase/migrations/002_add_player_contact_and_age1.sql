-- ============================================================================
-- Migration 002 — add player contact fields + allow players from age 1.
-- Run this ONCE in the Supabase SQL editor on a database created with the
-- original schema.sql. Safe to re-run (idempotent).
--
-- Changes:
--   * players gains first_name, last_name, email, phone_vorwahl, phone_number
--     (nullable text — existing rows are left as NULL).
--   * players_validate() no longer rejects under-13: players from age 1 can
--     register. The age_group is still computed and stored (under_13 for 1..12).
--   * players_validate() also trims the new fields and checks the email format.
-- ============================================================================

alter table public.players
  add column if not exists first_name    text,
  add column if not exists last_name     text,
  add column if not exists email         text,
  add column if not exists phone_vorwahl text,
  add column if not exists phone_number  text;

-- Replace the validation trigger: same name/birth rules, but no UNDER_13
-- rejection, plus light normalisation/validation of the new contact fields.
create or replace function public.players_validate()
returns trigger language plpgsql as $$
declare
  w text;
  computed text;
begin
  new.display_name := btrim(new.display_name);
  if char_length(new.display_name) < 3 or char_length(new.display_name) > 20 then
    raise exception 'INVALID_NAME_LENGTH';
  end if;
  if new.display_name !~ '^[A-Za-z0-9 _-]+$' then
    raise exception 'INVALID_NAME_CHARS';
  end if;
  for w in select word from public.blocked_words loop
    if position(w in lower(new.display_name)) > 0 then
      raise exception 'BLOCKED_NAME';
    end if;
  end loop;
  if new.birth_month not between 1 and 12 then raise exception 'INVALID_BIRTH_MONTH'; end if;
  if new.birth_year  not between 1900 and (extract(year from now())::int) then raise exception 'INVALID_BIRTH_YEAR'; end if;

  -- Contact fields: trim + basic email check (fields are optional at the DB level;
  -- the client requires them).
  new.first_name    := btrim(new.first_name);
  new.last_name     := btrim(new.last_name);
  new.email         := btrim(new.email);
  new.phone_vorwahl := btrim(new.phone_vorwahl);
  new.phone_number  := btrim(new.phone_number);
  if new.email is not null and new.email <> '' and new.email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'INVALID_EMAIL';
  end if;

  computed := public.compute_age_group(new.birth_month, new.birth_year);
  new.age_group := computed;                    -- always trust the server's computation
  -- Age rule: players from age 1 are allowed (the previous UNDER_13 rejection is removed).
  return new;
end $$;

drop trigger if exists players_validate_trg on public.players;
create trigger players_validate_trg before insert or update on public.players
  for each row execute function public.players_validate();
