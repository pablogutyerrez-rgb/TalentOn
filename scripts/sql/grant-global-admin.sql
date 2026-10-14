-- Operational repair, not a migration. Parameters: verified global actor UUID, exact username.
-- The caller must back up, lock and set talent.org_actor before execution.
insert into talent_org.global_admins(id,auth_user_id)
select 'global:'||p.id,p.auth_user_id
from talent.profiles p
where p.username=$2 and not p.is_context and p.role='ADMIN'
 and p.enabled and p.status='ACTIVO' and not p.must_change_password and p.archived_at is null
 and talent_private.org_global_admin($1::uuid)
on conflict(auth_user_id) do update set enabled=true,archived_at=null
where not global_admins.enabled or global_admins.archived_at is not null;
