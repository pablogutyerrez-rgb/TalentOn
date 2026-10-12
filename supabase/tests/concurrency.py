"""Solo PostgreSQL 17 desechable de CI; dos sesiones reales, no mocks."""
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor

if os.environ.get("PGDATABASE") != "talent_schema_test":
    raise SystemExit("Requiere base desechable talent_schema_test.")

def sql(statement):
    return subprocess.run(["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
                          input=statement, text=True, capture_output=True, timeout=30)

def ok(statement):
    result = sql(statement)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

ok("""
insert into auth.users values ('20000000-0000-4000-8000-000000000001');
insert into talent.companies(id,name) values ('concurrent','CI');
insert into talent.profiles(company_id,id,auth_user_id,username,display_name,role,status)
values ('concurrent','head','20000000-0000-4000-8000-000000000001','concurrency.head','CI','JEFE_SELECCION','ACTIVO');
insert into talent.user_modules(company_id,user_id,module) values ('concurrent','head','SELECCION');
insert into talent.campaigns(company_id,id,code,title,status,vacancies) values ('concurrent','c','CI','CI','EN_PROCESO',1);
insert into talent.staff_requests(company_id,id,campaign_id,requester_id,required_headcount,requested_vacancies,priority,required_date)
values ('concurrent','rq','c','head',1,1,'MEDIA',current_date),
       ('concurrent','retry','c','head',1,1,'MEDIA',current_date);
""")

def transition(request, key):
    # Todos los parámetros aquí son constantes CI; ninguna entrada del usuario.
    return sql(f"""begin; set local role service_role;
    select public.talent_request_transition('20000000-0000-4000-8000-000000000001',
    'concurrent','{request}',1,'ENVIADO','CI','{key}');
    select pg_sleep(0.3); commit;""")

with ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(lambda key: transition("rq", key), ["a", "b"]))
assert sum(r.returncode == 0 for r in results) == 1, "CAS: debe ganar una sola sesión"
assert any("TALENT_VERSION_CONFLICT" in r.stderr for r in results), "CAS: debe rechazar versión obsoleta"
assert ok("select version from talent.staff_requests where company_id='concurrent' and id='rq'") == "2"
assert ok("select count(*) from talent.request_decisions where company_id='concurrent' and request_id='rq'") == "1"

with ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(lambda _: transition("retry", "same"), [1, 2]))
assert all(r.returncode == 0 for r in results), "Reintentos simultáneos deben devolver mismo éxito"
assert ok("select version from talent.staff_requests where company_id='concurrent' and id='retry'") == "2"
assert ok("select count(*) from talent.request_decisions where company_id='concurrent' and request_id='retry'") == "1"
print("PASS: dos sesiones, CAS, rollback del perdedor e idempotencia sin decisiones duplicadas")
