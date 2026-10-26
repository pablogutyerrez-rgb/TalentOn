begin;

-- La base de datos debe aplicar la misma ventana diaria que la API: 09:00–21:30
-- en Lima, sin depender de la hora de inicio de la capacitación.
create or replace function talent_private.attendance_window()
returns trigger language plpgsql set search_path=pg_catalog,talent as $$
declare
  timestamp_now timestamptz := clock_timestamp();
  opens_at timestamptz;
  closes_at timestamptz;
begin
  if not exists (
    select 1 from talent.training_days
    where company_id=new.company_id and group_id=new.group_id and day_date=new.day_date
  ) then
    raise exception 'TALENT_DAY_NOT_FOUND';
  end if;

  opens_at := (new.day_date + time '09:00') at time zone 'America/Lima';
  closes_at := (new.day_date + time '21:30') at time zone 'America/Lima';
  if not (timestamp_now between opens_at and closes_at) and not exists (
    select 1 from talent.attendance_unlocks
    where company_id=new.company_id and group_id=new.group_id and day_date=new.day_date
      and status='APROBADA' and decided_at<=timestamp_now and expires_at>timestamp_now
  ) then
    raise exception 'TALENT_ATTENDANCE_LOCKED';
  end if;

  new.marked_at := timestamp_now;
  return new;
end $$;

commit;
