-- Incremental: no copia, elimina ni modifica datos del esquema documental anterior.
-- Preparación solamente. No conectar Talent-On todavía.
begin;
create schema talent;
revoke all on schema talent from public, anon, authenticated, service_role;
create table talent.companies(id text primary key, name text not null, version bigint not null default 1 check(version>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz);
create table talent.roles(code text primary key);
insert into talent.roles values ('ADMIN'),('JEFE_SELECCION'),('ANALISTA_SELECCION'),('RECLUTADOR'),('JEFE_FORMACION'),('COORDINADOR_FORMACION'),('FORMADOR'),('JEFE_TALENTO'),('ANALISTA_TALENTO');
create table talent.modules(code text primary key);
insert into talent.modules values ('SELECCION'),('FORMACION'),('TALENTO'),('ANALITICA'),('ADMINISTRACION');
-- Catálogos futuros no reciben permisos ni roles inventados.
create table talent.role_permissions(role text references talent.roles(code), module text references talent.modules(code), action text not null, primary key(role,module,action));
insert into talent.role_permissions values
 ('JEFE_SELECCION','SELECCION','rq_decide'),
 ('JEFE_SELECCION','SELECCION','campaign_read'), ('ANALISTA_SELECCION','SELECCION','campaign_read'), ('RECLUTADOR','SELECCION','campaign_read'),
 ('JEFE_FORMACION','FORMACION','group_read'), ('COORDINADOR_FORMACION','FORMACION','group_read'), ('FORMADOR','FORMACION','group_read');

create table talent.sites (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 name text not null, address text,
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.areas (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 name text not null,
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.profiles (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 auth_user_id uuid not null unique references auth.users(id) on delete restrict, username text not null check(username=lower(btrim(username)) and username ~ '^[a-z0-9][a-z0-9._-]{2,47}$'), display_name text not null, nickname text, tagline text, avatar_file_id text, phone text, email text, job_title text, role text not null references talent.roles(code), status text not null check(status in ('ACTIVO','INACTIVO')), enabled boolean not null default true, unique(username),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.campaigns (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 code text not null, title text not null, area_id text, site_id text, service_type text, status text not null check(status in ('EN_PROCESO','PUBLICADO','CERRADO','ANULADO','ACTIVA','EN_PAUSA')), process_type text check(process_type in ('EXTERNO','INTERNO','MIXTO')), management_type text, request_date date, start_date date, end_date date, vacancies integer not null check(vacancies>=0), salary_base numeric(12,2) check(salary_base>=0), variable_bonus numeric(12,2), admin_bonus numeric(12,2), mobility_bonus numeric(12,2), schedule text, observations text, assigned_analyst_id text, allow_over_target boolean not null default false, unique(company_id,code), foreign key(company_id,area_id) references talent.areas(company_id,id), foreign key(company_id,site_id) references talent.sites(company_id,id), foreign key(company_id,assigned_analyst_id) references talent.profiles(company_id,id), check(end_date is null or start_date is null or end_date>=start_date),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.user_modules (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 user_id text not null, module text not null references talent.modules(code), unique(company_id,user_id,module), foreign key(company_id,user_id) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.campaign_assignments (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 campaign_id text not null, user_id text not null, target integer check(target>=0), assignment_kind text not null, unique(company_id,campaign_id,user_id,assignment_kind), foreign key(company_id,campaign_id) references talent.campaigns(company_id,id), foreign key(company_id,user_id) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.supervision (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 supervisor_id text not null, subordinate_id text not null, unique(company_id,supervisor_id,subordinate_id), check(supervisor_id<>subordinate_id), foreign key(company_id,supervisor_id) references talent.profiles(company_id,id), foreign key(company_id,subordinate_id) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.persons (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 full_name text not null, first_name text, last_name text, birth_date date, phone text, email text, district text, address text, experience_months integer check(experience_months>=0), english_level text, avatar_file_id text,
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.person_identifiers (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 person_id text not null, kind text not null, normalized_value text not null, verified boolean not null default false, foreign key(company_id,person_id) references talent.persons(company_id,id), unique(company_id,person_id,kind,normalized_value),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.identity_conflicts (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 person_id text not null, other_person_id text not null, reason text not null, status text not null, reviewed_by text, check(person_id<>other_person_id), foreign key(company_id,person_id) references talent.persons(company_id,id), foreign key(company_id,other_person_id) references talent.persons(company_id,id), foreign key(company_id,reviewed_by) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.recruitment_sources (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 name text not null, unique(company_id,name),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.capture_links (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 owner_id text not null, source_id text not null, token_hash text not null unique, active boolean not null default true, foreign key(company_id,owner_id) references talent.profiles(company_id,id), foreign key(company_id,source_id) references talent.recruitment_sources(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.captures (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 person_id text not null, link_id text, owner_id text not null, source_id text not null, status text not null check(status in ('Nuevo','Contactado','No responde','Interesado','No interesado')), conflict boolean not null default false, received_at timestamptz not null, foreign key(company_id,person_id) references talent.persons(company_id,id), foreign key(company_id,link_id) references talent.capture_links(company_id,id), foreign key(company_id,owner_id) references talent.profiles(company_id,id), foreign key(company_id,source_id) references talent.recruitment_sources(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.process_templates (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 campaign_id text not null, family_id text not null, revision integer not null check(revision>0), name text not null, description text, position_name text, rules jsonb not null default '{}' check(jsonb_typeof(rules)='object'), unique(company_id,family_id,revision), foreign key(company_id,campaign_id) references talent.campaigns(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.process_stages (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 template_id text not null, stage text not null, ordinal integer not null check(ordinal>0), requirements text, unique(company_id,template_id,stage), unique(company_id,template_id,ordinal), foreign key(company_id,template_id) references talent.process_templates(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.template_responsibles (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 template_id text not null, user_id text not null, unique(company_id,template_id,user_id), foreign key(company_id,template_id) references talent.process_templates(company_id,id), foreign key(company_id,user_id) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.applications (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 person_id text not null, campaign_id text not null, capture_id text, recruiter_id text not null, template_id text, status text not null check(status in ('ACTIVA','CERRADA')), stage text not null, application_date date not null, closed_at timestamptz, closure_reason text, foreign key(company_id,person_id) references talent.persons(company_id,id), foreign key(company_id,campaign_id) references talent.campaigns(company_id,id), foreign key(company_id,capture_id) references talent.captures(company_id,id), foreign key(company_id,recruiter_id) references talent.profiles(company_id,id), foreign key(company_id,template_id) references talent.process_templates(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.interviews (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 application_id text not null, interviewer_id text not null, scheduled_at timestamptz, performed_at timestamptz, status text not null, result text, notes text, ratings jsonb not null default '{}', foreign key(company_id,application_id) references talent.applications(company_id,id), foreign key(company_id,interviewer_id) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.technical_verifications (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 application_id text not null, evaluator_id text not null, result text not null, download_mbps numeric check(download_mbps>=0), upload_mbps numeric check(upload_mbps>=0), latency_ms numeric check(latency_ms>=0), ram_gb numeric check(ram_gb>=0), operating_system text, processor text, headset boolean, quiet_environment boolean, notes text, verified_at timestamptz not null, foreign key(company_id,application_id) references talent.applications(company_id,id), foreign key(company_id,evaluator_id) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.contacts (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 application_id text, capture_id text, actor_id text not null, contacted_at timestamptz not null, channel text not null, outcome text, summary text not null, next_step text, check(num_nonnulls(application_id,capture_id)=1), foreign key(company_id,application_id) references talent.applications(company_id,id), foreign key(company_id,capture_id) references talent.captures(company_id,id), foreign key(company_id,actor_id) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.message_templates (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 campaign_id text not null, name text not null, communication_type text not null, body text not null, foreign key(company_id,campaign_id) references talent.campaigns(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.messages (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 application_id text not null, template_id text, sender_id text not null, body text not null, sent_at timestamptz, status text not null, foreign key(company_id,application_id) references talent.applications(company_id,id), foreign key(company_id,template_id) references talent.message_templates(company_id,id), foreign key(company_id,sender_id) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.staff_requests (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 campaign_id text not null, requester_id text not null, required_headcount integer not null check(required_headcount>0), requested_vacancies integer not null check(requested_vacancies>0), priority text not null, required_date date not null, status text not null default 'BORRADOR' check(status in ('BORRADOR','ENVIADO','EN_REVISION','APROBADO','OBSERVADO','RECHAZADO','EN_ATENCION','COBERTURA_PARCIAL','CUBIERTO')), observations text, foreign key(company_id,campaign_id) references talent.campaigns(company_id,id), foreign key(company_id,requester_id) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.request_decisions (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 request_id text not null, actor_id text not null, previous_status text not null, new_status text not null, reason text not null, request_version bigint not null, unique(company_id,request_id,request_version), foreign key(company_id,request_id) references talent.staff_requests(company_id,id), foreign key(company_id,actor_id) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.request_campaigns (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 request_id text not null, campaign_id text not null, unique(company_id,request_id,campaign_id), foreign key(company_id,request_id) references talent.staff_requests(company_id,id), foreign key(company_id,campaign_id) references talent.campaigns(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.training_groups (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 campaign_id text not null, code text not null, name text not null, trainer_id text, ojt_trainer_id text, coordinator_id text, start_date date not null, theory_end_date date not null, ojt_start_date date, ojt_end_date date, theory_days integer not null check(theory_days>0), ojt_days integer check(ojt_days>0), extension_days integer check(extension_days>=0), schedule text not null, timezone text not null default 'America/Lima', start_time time, modality text not null check(modality in ('PRESENCIAL','REMOTO','HIBRIDO','VIRTUAL')), site_id text, room_or_link text, capacity integer check(capacity>0), passing_grade numeric check(passing_grade>=0), status text not null check(status in ('PENDIENTE_ASIGNACION','PROGRAMADA','EN_CAPACITACION','EN_OJT','EXTENSION_OJT','FINALIZADA','CANCELADA')), closed_at timestamptz, unique(company_id,code), check(theory_end_date>=start_date), check(ojt_end_date is null or ojt_start_date is null or ojt_end_date>=ojt_start_date), foreign key(company_id,campaign_id) references talent.campaigns(company_id,id), foreign key(company_id,trainer_id) references talent.profiles(company_id,id), foreign key(company_id,ojt_trainer_id) references talent.profiles(company_id,id), foreign key(company_id,coordinator_id) references talent.profiles(company_id,id), foreign key(company_id,site_id) references talent.sites(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.participants (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 group_id text not null, application_id text not null, status text not null, joined_at timestamptz not null, day1_at timestamptz, final_result text, validated_by text, validated_at timestamptz, unique(company_id,group_id,application_id), foreign key(company_id,group_id) references talent.training_groups(company_id,id), foreign key(company_id,application_id) references talent.applications(company_id,id), foreign key(company_id,validated_by) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);
alter table talent.participants add unique(company_id,id,group_id);

create table talent.training_days (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 group_id text not null, day_date date not null, phase text not null check(phase in ('TEORIA','OJT')), day_number integer not null check(day_number>0), starts_at timestamptz not null, unique(company_id,group_id,day_date), foreign key(company_id,group_id) references talent.training_groups(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.attendance (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 group_id text not null, participant_id text not null, day_date date not null, status text not null check(status in ('PRESENTE','TARDANZA','FALTA','JUSTIFICADO','NSP','FALTA_JUSTIFICADA','FALTA_INJUSTIFICADA')), subreason text, notes text, marked_by text not null, marked_at timestamptz not null default now(), unique(company_id,participant_id,day_date), foreign key(company_id,group_id,day_date) references talent.training_days(company_id,group_id,day_date), foreign key(company_id,participant_id,group_id) references talent.participants(company_id,id,group_id), foreign key(company_id,marked_by) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.attendance_unlocks (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 group_id text not null, day_date date not null, requested_by text not null, reason text not null check(length(btrim(reason))>0), status text not null check(status in ('PENDIENTE','APROBADA','RECHAZADA')), decided_by text, decided_at timestamptz, decision_reason text, expires_at timestamptz, foreign key(company_id,group_id,day_date) references talent.training_days(company_id,group_id,day_date), foreign key(company_id,requested_by) references talent.profiles(company_id,id), foreign key(company_id,decided_by) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.dropouts (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 participant_id text not null, occurred_on date not null, phase text not null check(phase in ('CAPACITACION_TEORICA','OJT')), category text not null check(category in ('PERSONAL','LABORAL','EXPECTATIVAS_PUESTO','DIFICULTAD_CAPACITACION','INASISTENCIA','CONECTIVIDAD_EQUIPOS','OTRO')), observation text not null, recorded_by text not null, foreign key(company_id,participant_id) references talent.participants(company_id,id), foreign key(company_id,recorded_by) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.ojt_metrics (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 participant_id text not null, day_date date not null, day_number integer not null check(day_number>0), attendance_status text, hours_worked numeric check(hours_worked>=0), sales integer check(sales>=0), calls integer check(calls>=0), leads integer check(leads>=0), conversions integer check(conversions>=0), aht_seconds numeric check(aht_seconds>=0), qa_score numeric check(qa_score between 0 and 100), observations text, coach_feedback text, unique(company_id,participant_id,day_date), foreign key(company_id,participant_id) references talent.participants(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.feedback (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 person_id text not null, participant_id text, author_id text not null, strong_points text, improvement_points text, action_plan text, commitment_date date, participant_signed boolean, foreign key(company_id,person_id) references talent.persons(company_id,id), foreign key(company_id,participant_id) references talent.participants(company_id,id), foreign key(company_id,author_id) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.files (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 object_key text not null unique, provider text not null default 'R2' check(provider='R2'), original_name text not null, mime_type text not null, size_bytes bigint not null check(size_bytes>=0), checksum_sha256 text check(checksum_sha256 ~ '^[a-f0-9]{64}$'), uploaded_by text not null, state text not null check(state in ('PENDING','AVAILABLE','FAILED')), foreign key(company_id,uploaded_by) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.person_documents (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 person_id text not null, file_id text, document_type text not null, status text not null check(status in ('PENDIENTE','CARGADO','VALIDADO','OBSERVADO','RECHAZADO')), mandatory boolean not null default false, validated_by text, validated_at timestamptz, observation text, foreign key(company_id,person_id) references talent.persons(company_id,id), foreign key(company_id,file_id) references talent.files(company_id,id), foreign key(company_id,validated_by) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.evidence (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 file_id text not null, attendance_id text, evaluation_id text, document_id text, feedback_id text, check(num_nonnulls(attendance_id,evaluation_id,document_id,feedback_id)=1), foreign key(company_id,file_id) references talent.files(company_id,id), foreign key(company_id,attendance_id) references talent.attendance(company_id,id), foreign key(company_id,document_id) references talent.person_documents(company_id,id), foreign key(company_id,feedback_id) references talent.feedback(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.evaluation_definitions (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 name text not null, domain text not null check(domain in ('SELECCION','FORMACION','OJT','CALIDAD','APRENDIZAJE','ENCUESTA')), revision integer not null check(revision>0), family_id text not null, max_score numeric not null check(max_score>0), min_score numeric not null check(min_score>=0 and min_score<=max_score), template_id text, group_id text, published boolean not null default false, unique(company_id,family_id,revision), foreign key(company_id,template_id) references talent.process_templates(company_id,id), foreign key(company_id,group_id) references talent.training_groups(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.evaluation_items (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 definition_id text not null, label text not null, item_type text not null, points numeric not null check(points>=0), ordinal integer not null check(ordinal>0), unique(company_id,definition_id,ordinal), foreign key(company_id,definition_id) references talent.evaluation_definitions(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.evaluation_options (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 item_id text not null, label text not null, is_correct boolean not null default false, ordinal integer not null check(ordinal>0), unique(company_id,item_id,ordinal), foreign key(company_id,item_id) references talent.evaluation_items(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.evaluations (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 definition_id text not null, person_id text not null, application_id text, participant_id text, evaluator_id text not null, evaluated_at timestamptz not null, score numeric check(score>=0), result text, comments text, validation_state text, foreign key(company_id,definition_id) references talent.evaluation_definitions(company_id,id), foreign key(company_id,person_id) references talent.persons(company_id,id), foreign key(company_id,application_id) references talent.applications(company_id,id), foreign key(company_id,participant_id) references talent.participants(company_id,id), foreign key(company_id,evaluator_id) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.evaluation_answers (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 evaluation_id text not null, item_id text not null, option_id text, answer_text text, points numeric not null check(points>=0), unique(company_id,evaluation_id,item_id), foreign key(company_id,evaluation_id) references talent.evaluations(company_id,id), foreign key(company_id,item_id) references talent.evaluation_items(company_id,id), foreign key(company_id,option_id) references talent.evaluation_options(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.hiring (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 application_id text not null, participant_id text, status text not null, contract_type text, base_salary numeric check(base_salary>=0), variable_bonus numeric, schedule text, supervisor_id text, site_id text, planned_start date, official_start date, employee_code text, contract_number text, signature_status text, contract_version text, generated_at timestamptz, signed_at timestamptz, contract_file_id text, welcome_email_sent boolean not null default false, foreign key(company_id,application_id) references talent.applications(company_id,id), foreign key(company_id,participant_id) references talent.participants(company_id,id), foreign key(company_id,supervisor_id) references talent.profiles(company_id,id), foreign key(company_id,site_id) references talent.sites(company_id,id), foreign key(company_id,contract_file_id) references talent.files(company_id,id), unique(company_id,application_id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.salary_accounts (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 person_id text not null, bank text, account_number text, cci text, currency text check(currency in ('PEN','USD')), has_account boolean not null, request_opening boolean not null default false, opening_status text, notes text, unique(company_id,person_id), foreign key(company_id,person_id) references talent.persons(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.operational_admissions (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 hiring_id text not null, request_id text not null, confirmed_by text not null, confirmed_at timestamptz not null, unique(company_id,hiring_id), foreign key(company_id,hiring_id) references talent.hiring(company_id,id), foreign key(company_id,request_id) references talent.staff_requests(company_id,id), foreign key(company_id,confirmed_by) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.action_plans (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 evaluation_id text not null, responsible_id text not null, action text not null, due_date date, status text not null, follow_up text, foreign key(company_id,evaluation_id) references talent.evaluations(company_id,id), foreign key(company_id,responsible_id) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.calibrations (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 definition_id text not null, facilitator_id text not null, held_at timestamptz not null, notes text, foreign key(company_id,definition_id) references talent.evaluation_definitions(company_id,id), foreign key(company_id,facilitator_id) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.calibration_results (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 calibration_id text not null, evaluation_id text not null, reviewer_id text not null, score numeric not null check(score>=0), notes text, unique(company_id,calibration_id,evaluation_id,reviewer_id), foreign key(company_id,calibration_id) references talent.calibrations(company_id,id), foreign key(company_id,evaluation_id) references talent.evaluations(company_id,id), foreign key(company_id,reviewer_id) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.courses (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 name text not null, description text, active boolean not null default true,
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.course_materials (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 course_id text not null, file_id text not null, ordinal integer not null check(ordinal>0), foreign key(company_id,course_id) references talent.courses(company_id,id), foreign key(company_id,file_id) references talent.files(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.learning_paths (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 name text not null, description text,
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.path_courses (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 path_id text not null, course_id text not null, ordinal integer not null check(ordinal>0), unique(company_id,path_id,course_id), unique(company_id,path_id,ordinal), foreign key(company_id,path_id) references talent.learning_paths(company_id,id), foreign key(company_id,course_id) references talent.courses(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.course_participations (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 person_id text not null, course_id text not null, started_at timestamptz, completed_at timestamptz, status text not null, foreign key(company_id,person_id) references talent.persons(company_id,id), foreign key(company_id,course_id) references talent.courses(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.learning_evaluations (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 participation_id text not null, evaluation_id text not null, unique(company_id,participation_id,evaluation_id), foreign key(company_id,participation_id) references talent.course_participations(company_id,id), foreign key(company_id,evaluation_id) references talent.evaluations(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.observations (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 person_id text not null, application_id text, author_id text not null, body text not null, tag text, foreign key(company_id,person_id) references talent.persons(company_id,id), foreign key(company_id,application_id) references talent.applications(company_id,id), foreign key(company_id,author_id) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.system_settings (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 name text not null, configuration jsonb not null check(jsonb_typeof(configuration)='object'), unique(company_id,name),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.idempotency (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 actor_id text not null, operation text not null, request_key text not null, payload_hash text not null, response_metadata jsonb, completed_at timestamptz, unique(company_id,actor_id,operation,request_key), foreign key(company_id,actor_id) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.migration_runs (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 source text not null, state text not null, manifest_hash text, started_at timestamptz, completed_at timestamptz,
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.migration_mappings (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 run_id text not null, source_path text not null, target_table text not null, target_id text not null, source_hash text not null, unique(company_id,source_path), foreign key(company_id,run_id) references talent.migration_runs(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

create table talent.auth_mappings (
 company_id text not null references talent.companies(id) on delete restrict,
 id text not null default gen_random_uuid()::text,
 firebase_uid text not null unique, profile_id text not null, supabase_auth_id uuid not null unique references auth.users(id), unique(company_id,profile_id), foreign key(company_id,profile_id) references talent.profiles(company_id,id),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 primary key(company_id,id)
);

-- Relaciones adelantadas: evidencia y avatar no contienen URL pública.
alter table talent.evidence add foreign key(company_id,evaluation_id) references talent.evaluations(company_id,id);
alter table talent.profiles add foreign key(company_id,avatar_file_id) references talent.files(company_id,id);
alter table talent.persons add foreign key(company_id,avatar_file_id) references talent.files(company_id,id);
create unique index talent_application_active_pair on talent.applications(company_id,person_id,campaign_id) where status='ACTIVA';
create unique index talent_person_verified_identity on talent.person_identifiers(company_id,kind,normalized_value) where verified;
create index talent_person_phone_review on talent.persons(company_id,phone) where phone is not null;
create index talent_person_email_review on talent.persons(company_id,lower(email)) where email is not null;
create index talent_capture_owner_date on talent.captures(company_id,owner_id,received_at desc,id);
create index talent_capture_person_date on talent.captures(company_id,person_id,received_at,id);
create index talent_application_campaign_stage on talent.applications(company_id,campaign_id,status,stage,created_at,id);
create index talent_group_trainer_status on talent.training_groups(company_id,trainer_id,status,start_date,id);
create index talent_group_campaign_date on talent.training_groups(company_id,campaign_id,start_date,id);
create index talent_participant_group_status on talent.participants(company_id,group_id,status,id);
create index talent_attendance_group_day on talent.attendance(company_id,group_id,day_date,id);
create index talent_evaluation_person_date on talent.evaluations(company_id,person_id,evaluated_at,id);
create index talent_request_campaign_state on talent.staff_requests(company_id,campaign_id,status,required_date,id);
create index talent_admission_request on talent.operational_admissions(company_id,request_id,confirmed_at,id);
create table talent.audit_events(
 id bigint generated always as identity primary key,
 company_id text references talent.companies(id), actor_id text,
 table_name text not null, entity_id text not null, operation text not null,
 record_version bigint not null, occurred_at timestamptz not null default clock_timestamp(),
 changed_columns text[] not null, transaction_id bigint not null default txid_current(),
 foreign key(company_id,actor_id) references talent.profiles(company_id,id)
);
create index talent_audit_tenant_date on talent.audit_events(company_id,occurred_at,id);
create table talent.access_events(
 id bigint generated always as identity primary key,
 company_id text not null references talent.companies(id), actor_id text not null,
 action text not null, allowed boolean not null, occurred_at timestamptz not null default now(),
 foreign key(company_id,actor_id) references talent.profiles(company_id,id)
);
-- Sin PII/contraseñas en auditoría: nombres de columnas, no valores.
create function talent_private.guard_relational() returns trigger language plpgsql
set search_path=pg_catalog,talent as $$
begin
 if tg_op='DELETE' then raise exception 'TALENT_HISTORY_DELETE_FORBIDDEN'; end if;
 if tg_op='UPDATE' then
  if new.id is distinct from old.id or (to_jsonb(new)->>'company_id') is distinct from (to_jsonb(old)->>'company_id') then raise exception 'TALENT_IDENTITY_IMMUTABLE'; end if;
  new.version:=old.version+1; new.created_at:=old.created_at; new.updated_at:=clock_timestamp();
 end if;
 return new;
end $$;
create function talent_private.audit_relational() returns trigger language plpgsql security definer
set search_path=pg_catalog,talent as $$
declare cols text[];
begin
 select array_agg(key order by key) into cols from jsonb_each(to_jsonb(new))
 where tg_op='INSERT' or value is distinct from (to_jsonb(old)->key);
 insert into talent.audit_events(company_id,actor_id,table_name,entity_id,operation,record_version,changed_columns)
 values(case when tg_table_name='companies' then new.id else to_jsonb(new)->>'company_id' end,
 nullif(current_setting('talent.actor_id',true),''),tg_table_name,new.id,tg_op,new.version,coalesce(cols,'{}'));
 return new;
end $$;
create function talent_private.prevent_history_change() returns trigger language plpgsql as $$
begin raise exception 'TALENT_APPEND_ONLY'; end $$;
create trigger audit_append_only before update or delete on talent.audit_events for each row execute function talent_private.prevent_history_change();
create trigger access_append_only before update or delete on talent.access_events for each row execute function talent_private.prevent_history_change();
create trigger decision_append_only before update or delete on talent.request_decisions for each row execute function talent_private.prevent_history_change();
-- Todo esquema privado: sin políticas de lectura/escritura pública.
do $$
declare t record; f record;
begin
 for t in select tablename from pg_tables where schemaname='talent' loop
  execute format('alter table talent.%I enable row level security',t.tablename);
  execute format('revoke all on talent.%I from public,anon,authenticated,service_role',t.tablename);
  if t.tablename not in ('roles','modules','role_permissions','audit_events','access_events') then
   execute format('create trigger record_guard before update or delete on talent.%I for each row execute function talent_private.guard_relational()',t.tablename);
   execute format('create trigger record_audit after insert or update on talent.%I for each row execute function talent_private.audit_relational()',t.tablename);
  end if;
 end loop;
 -- Índices de FK compuestas para joins y validación de referencias; sin índices redundantes por cada campo.
 for f in
  select c.conrelid::regclass as tbl,c.conname,string_agg(quote_ident(a.attname),',' order by k.ord) as cols
  from pg_constraint c cross join lateral unnest(c.conkey) with ordinality k(attnum,ord)
  join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum
  where c.contype='f' and c.connamespace='talent'::regnamespace
  group by c.conrelid,c.conname
 loop
  execute format('create index %I on %s (%s)',left(f.conname,55)||'_fkidx',f.tbl,f.cols);
 end loop;
end $$;
revoke all on all sequences in schema talent from public,anon,authenticated,service_role;
revoke all on all functions in schema talent_private from public,anon,authenticated,service_role;
-- Un candidato puede tener varias captaciones/postulaciones; no hay unicidad por persona+empresa.
-- Vista de cobertura: solo altas confirmadas. No usa inscritos en capacitación.
create view talent.request_coverage as
 select r.company_id,r.id,r.requested_vacancies,count(a.id)::integer as confirmed,
 greatest(r.requested_vacancies-count(a.id)::integer,0) as pending
 from talent.staff_requests r left join talent.operational_admissions a on a.company_id=r.company_id and a.request_id=r.id
 group by r.company_id,r.id;
revoke all on talent.request_coverage from public,anon,authenticated,service_role;
create function public.talent_schema_status() returns jsonb language sql security definer
set search_path=pg_catalog,talent as $$
 select jsonb_build_object('model','relational','revision','202610120002','tables',
 (select count(*) from pg_tables where schemaname='talent'));
$$;
revoke all on function public.talent_schema_status() from public,anon,authenticated;
grant execute on function public.talent_schema_status() to service_role;
commit;
