# Diccionario relacional Talent-On

Generado del catálogo PostgreSQL 17.5 después de las migraciones aisladas del 12/10/2026. `?` indica nullable. No se extrajeron datos reales.

Las entidades usan `(company_id,id)` como PK, salvo empresas, catálogos y eventos. IDs text conservan identidad lógica; los nuevos generan UUID. Auth se vincula por UUID en profiles.auth_user_id. Campos comunes: version positiva, timestamps de servidor, archived_at. Historiales especiales append-only; no DELETE operativo.

## talent.access_events

Campos: `id` bigint; `company_id` text; `actor_id` text; `action` text; `allowed` boolean; `occurred_at` timestamp with time zone (default: `now()`).

- `FOREIGN KEY (company_id, actor_id) REFERENCES talent.profiles(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id)`
- `PRIMARY KEY (id)`

## talent.action_plans

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `evaluation_id` text; `responsible_id` text; `action` text; `due_date` date?; `status` text; `follow_up` text?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, evaluation_id) REFERENCES talent.evaluations(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, responsible_id) REFERENCES talent.profiles(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.applications

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `person_id` text; `campaign_id` text; `capture_id` text?; `recruiter_id` text; `template_id` text?; `status` text; `stage` text; `application_date` date; `closed_at` timestamp with time zone?; `closure_reason` text?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, campaign_id) REFERENCES talent.campaigns(company_id, id)`
- `FOREIGN KEY (company_id, capture_id) REFERENCES talent.captures(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, person_id) REFERENCES talent.persons(company_id, id)`
- `FOREIGN KEY (company_id, recruiter_id) REFERENCES talent.profiles(company_id, id)`
- `FOREIGN KEY (company_id, template_id) REFERENCES talent.process_templates(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((status = ANY (ARRAY['ACTIVA'::text, 'CERRADA'::text])))`
- `CHECK ((version > 0))`

## talent.areas

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `name` text; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.attendance

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `group_id` text; `participant_id` text; `day_date` date; `status` text; `subreason` text?; `notes` text?; `marked_by` text; `marked_at` timestamp with time zone (default: `now()`); `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, group_id, day_date) REFERENCES talent.training_days(company_id, group_id, day_date)`
- `FOREIGN KEY (company_id, marked_by) REFERENCES talent.profiles(company_id, id)`
- `UNIQUE (company_id, participant_id, day_date)`
- `FOREIGN KEY (company_id, participant_id, group_id) REFERENCES talent.participants(company_id, id, group_id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((status = ANY (ARRAY['PRESENTE'::text, 'TARDANZA'::text, 'FALTA'::text, 'JUSTIFICADO'::text, 'NSP'::text, 'FALTA_JUSTIFICADA'::text, 'FALTA_INJUSTIFICADA'::text])))`
- `CHECK ((version > 0))`

## talent.attendance_unlocks

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `group_id` text; `day_date` date; `requested_by` text; `reason` text; `status` text; `decided_by` text?; `decided_at` timestamp with time zone?; `decision_reason` text?; `expires_at` timestamp with time zone?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, decided_by) REFERENCES talent.profiles(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, group_id, day_date) REFERENCES talent.training_days(company_id, group_id, day_date)`
- `FOREIGN KEY (company_id, requested_by) REFERENCES talent.profiles(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((length(btrim(reason)) > 0))`
- `CHECK ((status = ANY (ARRAY['PENDIENTE'::text, 'APROBADA'::text, 'RECHAZADA'::text])))`
- `CHECK ((version > 0))`

## talent.audit_events

Campos: `id` bigint; `company_id` text?; `actor_id` text?; `table_name` text; `entity_id` text; `operation` text; `record_version` bigint; `occurred_at` timestamp with time zone (default: `clock_timestamp()`); `changed_columns` text[]; `transaction_id` bigint (default: `txid_current()`).

- `FOREIGN KEY (company_id, actor_id) REFERENCES talent.profiles(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id)`
- `PRIMARY KEY (id)`

## talent.auth_mappings

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `firebase_uid` text; `profile_id` text; `supabase_auth_id` uuid; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, profile_id) REFERENCES talent.profiles(company_id, id)`
- `UNIQUE (company_id, profile_id)`
- `FOREIGN KEY (company_id, profile_id, supabase_auth_id) REFERENCES talent.profiles(company_id, id, auth_user_id)`
- `UNIQUE (firebase_uid)`
- `PRIMARY KEY (company_id, id)`
- `FOREIGN KEY (supabase_auth_id) REFERENCES auth.users(id)`
- `UNIQUE (supabase_auth_id)`
- `CHECK ((version > 0))`

## talent.calibration_results

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `calibration_id` text; `evaluation_id` text; `reviewer_id` text; `score` numeric; `notes` text?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `UNIQUE (company_id, calibration_id, evaluation_id, reviewer_id)`
- `FOREIGN KEY (company_id, calibration_id) REFERENCES talent.calibrations(company_id, id)`
- `FOREIGN KEY (company_id, evaluation_id) REFERENCES talent.evaluations(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, reviewer_id) REFERENCES talent.profiles(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((score >= (0)::numeric))`
- `CHECK ((version > 0))`

## talent.calibrations

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `definition_id` text; `facilitator_id` text; `held_at` timestamp with time zone; `notes` text?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, definition_id) REFERENCES talent.evaluation_definitions(company_id, id)`
- `FOREIGN KEY (company_id, facilitator_id) REFERENCES talent.profiles(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.campaign_assignments

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `campaign_id` text; `user_id` text; `target` integer?; `assignment_kind` text; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, campaign_id) REFERENCES talent.campaigns(company_id, id)`
- `UNIQUE (company_id, campaign_id, user_id, assignment_kind)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, user_id) REFERENCES talent.profiles(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((target >= 0))`
- `CHECK ((version > 0))`

## talent.campaigns

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `code` text; `title` text; `area_id` text?; `site_id` text?; `service_type` text?; `status` text; `process_type` text?; `management_type` text?; `request_date` date?; `start_date` date?; `end_date` date?; `vacancies` integer; `salary_base` numeric(12,2)?; `variable_bonus` numeric(12,2)?; `admin_bonus` numeric(12,2)?; `mobility_bonus` numeric(12,2)?; `schedule` text?; `observations` text?; `assigned_analyst_id` text?; `allow_over_target` boolean (default: `false`); `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `CHECK (((end_date IS NULL) OR (start_date IS NULL) OR (end_date >= start_date)))`
- `FOREIGN KEY (company_id, area_id) REFERENCES talent.areas(company_id, id)`
- `FOREIGN KEY (company_id, assigned_analyst_id) REFERENCES talent.profiles(company_id, id)`
- `UNIQUE (company_id, code)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, site_id) REFERENCES talent.sites(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((process_type = ANY (ARRAY['EXTERNO'::text, 'INTERNO'::text, 'MIXTO'::text])))`
- `CHECK ((salary_base >= (0)::numeric))`
- `CHECK ((status = ANY (ARRAY['EN_PROCESO'::text, 'PUBLICADO'::text, 'CERRADO'::text, 'ANULADO'::text, 'ACTIVA'::text, 'EN_PAUSA'::text])))`
- `CHECK ((vacancies >= 0))`
- `CHECK ((version > 0))`

## talent.capture_links

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `owner_id` text; `source_id` text; `token_hash` text; `active` boolean (default: `true`); `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, owner_id) REFERENCES talent.profiles(company_id, id)`
- `FOREIGN KEY (company_id, source_id) REFERENCES talent.recruitment_sources(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `UNIQUE (token_hash)`
- `CHECK ((version > 0))`

## talent.captures

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `person_id` text; `link_id` text?; `owner_id` text; `source_id` text; `status` text; `conflict` boolean (default: `false`); `received_at` timestamp with time zone; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, link_id) REFERENCES talent.capture_links(company_id, id)`
- `FOREIGN KEY (company_id, owner_id) REFERENCES talent.profiles(company_id, id)`
- `FOREIGN KEY (company_id, person_id) REFERENCES talent.persons(company_id, id)`
- `FOREIGN KEY (company_id, source_id) REFERENCES talent.recruitment_sources(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((status = ANY (ARRAY['Nuevo'::text, 'Contactado'::text, 'No responde'::text, 'Interesado'::text, 'No interesado'::text])))`
- `CHECK ((version > 0))`

## talent.companies

Campos: `id` text; `name` text; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `PRIMARY KEY (id)`
- `CHECK ((version > 0))`

## talent.contacts

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `application_id` text?; `capture_id` text?; `actor_id` text; `contacted_at` timestamp with time zone; `channel` text; `outcome` text?; `summary` text; `next_step` text?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `CHECK ((num_nonnulls(application_id, capture_id) = 1))`
- `FOREIGN KEY (company_id, actor_id) REFERENCES talent.profiles(company_id, id)`
- `FOREIGN KEY (company_id, application_id) REFERENCES talent.applications(company_id, id)`
- `FOREIGN KEY (company_id, capture_id) REFERENCES talent.captures(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.course_materials

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `course_id` text; `file_id` text; `ordinal` integer; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, course_id) REFERENCES talent.courses(company_id, id)`
- `FOREIGN KEY (company_id, file_id) REFERENCES talent.files(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `CHECK ((ordinal > 0))`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.course_participations

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `person_id` text; `course_id` text; `started_at` timestamp with time zone?; `completed_at` timestamp with time zone?; `status` text; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, course_id) REFERENCES talent.courses(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, person_id) REFERENCES talent.persons(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.courses

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `name` text; `description` text?; `active` boolean (default: `true`); `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.dropouts

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `participant_id` text; `occurred_on` date; `phase` text; `category` text; `observation` text; `recorded_by` text; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `CHECK ((category = ANY (ARRAY['PERSONAL'::text, 'LABORAL'::text, 'EXPECTATIVAS_PUESTO'::text, 'DIFICULTAD_CAPACITACION'::text, 'INASISTENCIA'::text, 'CONECTIVIDAD_EQUIPOS'::text, 'OTRO'::text])))`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, participant_id) REFERENCES talent.participants(company_id, id)`
- `FOREIGN KEY (company_id, recorded_by) REFERENCES talent.profiles(company_id, id)`
- `CHECK ((phase = ANY (ARRAY['CAPACITACION_TEORICA'::text, 'OJT'::text])))`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.evaluation_answers

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `evaluation_id` text; `item_id` text; `option_id` text?; `answer_text` text?; `points` numeric; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, evaluation_id) REFERENCES talent.evaluations(company_id, id)`
- `UNIQUE (company_id, evaluation_id, item_id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, item_id) REFERENCES talent.evaluation_items(company_id, id)`
- `FOREIGN KEY (company_id, option_id) REFERENCES talent.evaluation_options(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((points >= (0)::numeric))`
- `CHECK ((version > 0))`

## talent.evaluation_definitions

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `name` text; `domain` text; `revision` integer; `family_id` text; `max_score` numeric; `min_score` numeric; `template_id` text?; `group_id` text?; `published` boolean (default: `false`); `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `CHECK (((min_score >= (0)::numeric) AND (min_score <= max_score)))`
- `UNIQUE (company_id, family_id, revision)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, group_id) REFERENCES talent.training_groups(company_id, id)`
- `FOREIGN KEY (company_id, template_id) REFERENCES talent.process_templates(company_id, id)`
- `CHECK ((domain = ANY (ARRAY['SELECCION'::text, 'FORMACION'::text, 'OJT'::text, 'CALIDAD'::text, 'APRENDIZAJE'::text, 'ENCUESTA'::text])))`
- `CHECK ((max_score > (0)::numeric))`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((revision > 0))`
- `CHECK ((version > 0))`

## talent.evaluation_items

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `definition_id` text; `label` text; `item_type` text; `points` numeric; `ordinal` integer; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, definition_id) REFERENCES talent.evaluation_definitions(company_id, id)`
- `UNIQUE (company_id, definition_id, ordinal)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `CHECK ((ordinal > 0))`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((points >= (0)::numeric))`
- `CHECK ((version > 0))`

## talent.evaluation_options

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `item_id` text; `label` text; `is_correct` boolean (default: `false`); `ordinal` integer; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, item_id) REFERENCES talent.evaluation_items(company_id, id)`
- `UNIQUE (company_id, item_id, ordinal)`
- `CHECK ((ordinal > 0))`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.evaluations

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `definition_id` text; `person_id` text; `application_id` text?; `participant_id` text?; `evaluator_id` text; `evaluated_at` timestamp with time zone; `score` numeric?; `result` text?; `comments` text?; `validation_state` text?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, application_id) REFERENCES talent.applications(company_id, id)`
- `FOREIGN KEY (company_id, definition_id) REFERENCES talent.evaluation_definitions(company_id, id)`
- `FOREIGN KEY (company_id, evaluator_id) REFERENCES talent.profiles(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, participant_id) REFERENCES talent.participants(company_id, id)`
- `FOREIGN KEY (company_id, person_id) REFERENCES talent.persons(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((score >= (0)::numeric))`
- `CHECK ((version > 0))`

## talent.evidence

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `file_id` text; `attendance_id` text?; `evaluation_id` text?; `document_id` text?; `feedback_id` text?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `CHECK ((num_nonnulls(attendance_id, evaluation_id, document_id, feedback_id) = 1))`
- `FOREIGN KEY (company_id, attendance_id) REFERENCES talent.attendance(company_id, id)`
- `FOREIGN KEY (company_id, document_id) REFERENCES talent.person_documents(company_id, id)`
- `FOREIGN KEY (company_id, evaluation_id) REFERENCES talent.evaluations(company_id, id)`
- `FOREIGN KEY (company_id, feedback_id) REFERENCES talent.feedback(company_id, id)`
- `FOREIGN KEY (company_id, file_id) REFERENCES talent.files(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.feedback

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `person_id` text; `participant_id` text?; `author_id` text; `strong_points` text?; `improvement_points` text?; `action_plan` text?; `commitment_date` date?; `participant_signed` boolean?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, author_id) REFERENCES talent.profiles(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, participant_id) REFERENCES talent.participants(company_id, id)`
- `FOREIGN KEY (company_id, person_id) REFERENCES talent.persons(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.files

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `object_key` text; `provider` text (default: `'R2'::text`); `original_name` text; `mime_type` text; `size_bytes` bigint; `checksum_sha256` text?; `uploaded_by` text; `state` text; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `CHECK ((checksum_sha256 ~ '^[a-f0-9]{64}$'::text))`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, uploaded_by) REFERENCES talent.profiles(company_id, id)`
- `UNIQUE (object_key)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((provider = 'R2'::text))`
- `CHECK ((size_bytes >= 0))`
- `CHECK ((state = ANY (ARRAY['PENDING'::text, 'AVAILABLE'::text, 'FAILED'::text])))`
- `CHECK ((version > 0))`

## talent.hiring

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `application_id` text; `participant_id` text?; `status` text; `contract_type` text?; `base_salary` numeric?; `variable_bonus` numeric?; `schedule` text?; `supervisor_id` text?; `site_id` text?; `planned_start` date?; `official_start` date?; `employee_code` text?; `contract_number` text?; `signature_status` text?; `contract_version` text?; `generated_at` timestamp with time zone?; `signed_at` timestamp with time zone?; `contract_file_id` text?; `welcome_email_sent` boolean (default: `false`); `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `CHECK ((base_salary >= (0)::numeric))`
- `FOREIGN KEY (company_id, application_id) REFERENCES talent.applications(company_id, id)`
- `UNIQUE (company_id, application_id)`
- `FOREIGN KEY (company_id, contract_file_id) REFERENCES talent.files(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, participant_id) REFERENCES talent.participants(company_id, id)`
- `FOREIGN KEY (company_id, site_id) REFERENCES talent.sites(company_id, id)`
- `FOREIGN KEY (company_id, supervisor_id) REFERENCES talent.profiles(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.idempotency

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `actor_id` text; `operation` text; `request_key` text; `payload_hash` text; `response_metadata` jsonb?; `completed_at` timestamp with time zone?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, actor_id) REFERENCES talent.profiles(company_id, id)`
- `UNIQUE (company_id, actor_id, operation, request_key)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.identity_conflicts

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `person_id` text; `other_person_id` text; `reason` text; `status` text; `reviewed_by` text?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `CHECK ((person_id <> other_person_id))`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, other_person_id) REFERENCES talent.persons(company_id, id)`
- `FOREIGN KEY (company_id, person_id) REFERENCES talent.persons(company_id, id)`
- `FOREIGN KEY (company_id, reviewed_by) REFERENCES talent.profiles(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.interviews

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `application_id` text; `interviewer_id` text; `scheduled_at` timestamp with time zone?; `performed_at` timestamp with time zone?; `status` text; `result` text?; `notes` text?; `ratings` jsonb (default: `'{}'::jsonb`); `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, application_id) REFERENCES talent.applications(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, interviewer_id) REFERENCES talent.profiles(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.learning_evaluations

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `participation_id` text; `evaluation_id` text; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, evaluation_id) REFERENCES talent.evaluations(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `UNIQUE (company_id, participation_id, evaluation_id)`
- `FOREIGN KEY (company_id, participation_id) REFERENCES talent.course_participations(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.learning_paths

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `name` text; `description` text?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.lifecycle_events

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `person_id` text; `application_id` text?; `participant_id` text?; `actor_id` text; `previous_stage` text?; `new_stage` text; `reason` text?; `occurred_at` timestamp with time zone.

- `FOREIGN KEY (company_id, actor_id) REFERENCES talent.profiles(company_id, id)`
- `FOREIGN KEY (company_id, application_id) REFERENCES talent.applications(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id)`
- `FOREIGN KEY (company_id, participant_id) REFERENCES talent.participants(company_id, id)`
- `FOREIGN KEY (company_id, person_id) REFERENCES talent.persons(company_id, id)`
- `PRIMARY KEY (company_id, id)`

## talent.message_templates

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `campaign_id` text; `name` text; `communication_type` text; `body` text; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, campaign_id) REFERENCES talent.campaigns(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.messages

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `application_id` text; `template_id` text?; `sender_id` text; `body` text; `sent_at` timestamp with time zone?; `status` text; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, application_id) REFERENCES talent.applications(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, sender_id) REFERENCES talent.profiles(company_id, id)`
- `FOREIGN KEY (company_id, template_id) REFERENCES talent.message_templates(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.migration_mappings

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `run_id` text; `source_path` text; `target_table` text; `target_id` text; `source_hash` text; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, run_id) REFERENCES talent.migration_runs(company_id, id)`
- `UNIQUE (company_id, source_path)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.migration_runs

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `source` text; `state` text; `manifest_hash` text?; `started_at` timestamp with time zone?; `completed_at` timestamp with time zone?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.modules

Campos: `code` text.

- `PRIMARY KEY (code)`

## talent.observations

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `person_id` text; `application_id` text?; `author_id` text; `body` text; `tag` text?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, application_id) REFERENCES talent.applications(company_id, id)`
- `FOREIGN KEY (company_id, author_id) REFERENCES talent.profiles(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, person_id) REFERENCES talent.persons(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.ojt_metrics

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `participant_id` text; `day_date` date; `day_number` integer; `attendance_status` text?; `hours_worked` numeric?; `sales` integer?; `calls` integer?; `leads` integer?; `conversions` integer?; `aht_seconds` numeric?; `qa_score` numeric?; `observations` text?; `coach_feedback` text?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `CHECK ((aht_seconds >= (0)::numeric))`
- `CHECK ((calls >= 0))`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `UNIQUE (company_id, participant_id, day_date)`
- `FOREIGN KEY (company_id, participant_id) REFERENCES talent.participants(company_id, id)`
- `CHECK ((conversions >= 0))`
- `CHECK ((day_number > 0))`
- `CHECK ((hours_worked >= (0)::numeric))`
- `CHECK ((leads >= 0))`
- `PRIMARY KEY (company_id, id)`
- `CHECK (((qa_score >= (0)::numeric) AND (qa_score <= (100)::numeric)))`
- `CHECK ((sales >= 0))`
- `CHECK ((version > 0))`

## talent.ojt_skills

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `participant_id` text; `assessed_by` text; `assessed_at` timestamp with time zone; `manejo_objeciones` integer; `diccion_modulacion` integer; `velocidad_sistemas` integer; `empatia_escucha` integer; `tecnica_cierre` integer; `cumplimiento_procesos` integer.

- `FOREIGN KEY (company_id, assessed_by) REFERENCES talent.profiles(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id)`
- `FOREIGN KEY (company_id, participant_id) REFERENCES talent.participants(company_id, id)`
- `CHECK (((cumplimiento_procesos >= 1) AND (cumplimiento_procesos <= 5)))`
- `CHECK (((diccion_modulacion >= 1) AND (diccion_modulacion <= 5)))`
- `CHECK (((empatia_escucha >= 1) AND (empatia_escucha <= 5)))`
- `CHECK (((manejo_objeciones >= 1) AND (manejo_objeciones <= 5)))`
- `PRIMARY KEY (company_id, id)`
- `CHECK (((tecnica_cierre >= 1) AND (tecnica_cierre <= 5)))`
- `CHECK (((velocidad_sistemas >= 1) AND (velocidad_sistemas <= 5)))`

## talent.operational_admissions

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `hiring_id` text; `request_id` text; `confirmed_by` text; `confirmed_at` timestamp with time zone; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, confirmed_by) REFERENCES talent.profiles(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, hiring_id) REFERENCES talent.hiring(company_id, id)`
- `UNIQUE (company_id, hiring_id)`
- `FOREIGN KEY (company_id, request_id) REFERENCES talent.staff_requests(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.participants

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `group_id` text; `application_id` text; `status` text; `joined_at` timestamp with time zone; `day1_at` timestamp with time zone?; `final_result` text?; `validated_by` text?; `validated_at` timestamp with time zone?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, application_id) REFERENCES talent.applications(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `UNIQUE (company_id, group_id, application_id)`
- `FOREIGN KEY (company_id, group_id) REFERENCES talent.training_groups(company_id, id)`
- `UNIQUE (company_id, id, group_id)`
- `FOREIGN KEY (company_id, validated_by) REFERENCES talent.profiles(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.path_courses

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `path_id` text; `course_id` text; `ordinal` integer; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, course_id) REFERENCES talent.courses(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `UNIQUE (company_id, path_id, course_id)`
- `FOREIGN KEY (company_id, path_id) REFERENCES talent.learning_paths(company_id, id)`
- `UNIQUE (company_id, path_id, ordinal)`
- `CHECK ((ordinal > 0))`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.person_documents

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `person_id` text; `file_id` text?; `document_type` text; `status` text; `mandatory` boolean (default: `false`); `validated_by` text?; `validated_at` timestamp with time zone?; `observation` text?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, file_id) REFERENCES talent.files(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, person_id) REFERENCES talent.persons(company_id, id)`
- `FOREIGN KEY (company_id, validated_by) REFERENCES talent.profiles(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((status = ANY (ARRAY['PENDIENTE'::text, 'CARGADO'::text, 'VALIDADO'::text, 'OBSERVADO'::text, 'RECHAZADO'::text])))`
- `CHECK ((version > 0))`

## talent.person_identifiers

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `person_id` text; `kind` text; `normalized_value` text; `verified` boolean (default: `false`); `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, person_id) REFERENCES talent.persons(company_id, id)`
- `UNIQUE (company_id, person_id, kind, normalized_value)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.persons

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `full_name` text; `first_name` text?; `last_name` text?; `birth_date` date?; `phone` text?; `email` text?; `district` text?; `address` text?; `experience_months` integer?; `english_level` text?; `avatar_file_id` text?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, avatar_file_id) REFERENCES talent.files(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `CHECK ((experience_months >= 0))`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.process_stages

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `template_id` text; `stage` text; `ordinal` integer; `requirements` text?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, template_id) REFERENCES talent.process_templates(company_id, id)`
- `UNIQUE (company_id, template_id, ordinal)`
- `UNIQUE (company_id, template_id, stage)`
- `CHECK ((ordinal > 0))`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.process_templates

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `campaign_id` text; `family_id` text; `revision` integer; `name` text; `description` text?; `position_name` text?; `rules` jsonb (default: `'{}'::jsonb`); `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, campaign_id) REFERENCES talent.campaigns(company_id, id)`
- `UNIQUE (company_id, family_id, revision)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((revision > 0))`
- `CHECK ((jsonb_typeof(rules) = 'object'::text))`
- `CHECK ((version > 0))`

## talent.profiles

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `auth_user_id` uuid; `username` text; `display_name` text; `nickname` text?; `tagline` text?; `avatar_file_id` text?; `phone` text?; `email` text?; `job_title` text?; `role` text; `status` text; `enabled` boolean (default: `true`); `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT`
- `UNIQUE (auth_user_id)`
- `FOREIGN KEY (company_id, avatar_file_id) REFERENCES talent.files(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `UNIQUE (company_id, id, auth_user_id)`
- `PRIMARY KEY (company_id, id)`
- `FOREIGN KEY (role) REFERENCES talent.roles(code)`
- `CHECK ((status = ANY (ARRAY['ACTIVO'::text, 'INACTIVO'::text])))`
- `CHECK (((username = lower(btrim(username))) AND (username ~ '^[a-z0-9][a-z0-9._-]{2,47}$'::text)))`
- `UNIQUE (username)`
- `CHECK ((version > 0))`

## talent.recruitment_sources

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `name` text; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `UNIQUE (company_id, name)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.request_campaigns

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `request_id` text; `campaign_id` text; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, campaign_id) REFERENCES talent.campaigns(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `UNIQUE (company_id, request_id, campaign_id)`
- `FOREIGN KEY (company_id, request_id) REFERENCES talent.staff_requests(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.request_decisions

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `request_id` text; `actor_id` text; `previous_status` text; `new_status` text; `reason` text; `request_version` bigint; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, actor_id) REFERENCES talent.profiles(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, request_id) REFERENCES talent.staff_requests(company_id, id)`
- `UNIQUE (company_id, request_id, request_version)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.role_permissions

Campos: `role` text; `module` text; `action` text.

- `FOREIGN KEY (module) REFERENCES talent.modules(code)`
- `PRIMARY KEY (role, module, action)`
- `FOREIGN KEY (role) REFERENCES talent.roles(code)`

## talent.roles

Campos: `code` text.

- `PRIMARY KEY (code)`

## talent.salary_accounts

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `person_id` text; `bank` text?; `account_number` text?; `cci` text?; `currency` text?; `has_account` boolean; `request_opening` boolean (default: `false`); `opening_status` text?; `notes` text?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, person_id) REFERENCES talent.persons(company_id, id)`
- `UNIQUE (company_id, person_id)`
- `CHECK ((currency = ANY (ARRAY['PEN'::text, 'USD'::text])))`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.sites

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `name` text; `address` text?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.staff_requests

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `campaign_id` text; `requester_id` text; `required_headcount` integer; `requested_vacancies` integer; `priority` text; `required_date` date; `status` text (default: `'BORRADOR'::text`); `observations` text?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, campaign_id) REFERENCES talent.campaigns(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, requester_id) REFERENCES talent.profiles(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((requested_vacancies > 0))`
- `CHECK ((required_headcount > 0))`
- `CHECK ((status = ANY (ARRAY['BORRADOR'::text, 'ENVIADO'::text, 'EN_REVISION'::text, 'APROBADO'::text, 'OBSERVADO'::text, 'RECHAZADO'::text, 'EN_ATENCION'::text, 'COBERTURA_PARCIAL'::text, 'CUBIERTO'::text])))`
- `CHECK ((version > 0))`

## talent.supervision

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `supervisor_id` text; `subordinate_id` text; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `CHECK ((supervisor_id <> subordinate_id))`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, subordinate_id) REFERENCES talent.profiles(company_id, id)`
- `FOREIGN KEY (company_id, supervisor_id) REFERENCES talent.profiles(company_id, id)`
- `UNIQUE (company_id, supervisor_id, subordinate_id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.system_settings

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `name` text; `configuration` jsonb; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `UNIQUE (company_id, name)`
- `CHECK ((jsonb_typeof(configuration) = 'object'::text))`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.technical_verifications

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `application_id` text; `evaluator_id` text; `result` text; `download_mbps` numeric?; `upload_mbps` numeric?; `latency_ms` numeric?; `ram_gb` numeric?; `operating_system` text?; `processor` text?; `headset` boolean?; `quiet_environment` boolean?; `notes` text?; `verified_at` timestamp with time zone; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id, application_id) REFERENCES talent.applications(company_id, id)`
- `FOREIGN KEY (company_id, evaluator_id) REFERENCES talent.profiles(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `CHECK ((download_mbps >= (0)::numeric))`
- `CHECK ((latency_ms >= (0)::numeric))`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((ram_gb >= (0)::numeric))`
- `CHECK ((upload_mbps >= (0)::numeric))`
- `CHECK ((version > 0))`

## talent.template_responsibles

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `template_id` text; `user_id` text; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, template_id) REFERENCES talent.process_templates(company_id, id)`
- `UNIQUE (company_id, template_id, user_id)`
- `FOREIGN KEY (company_id, user_id) REFERENCES talent.profiles(company_id, id)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.training_days

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `group_id` text; `day_date` date; `phase` text; `day_number` integer; `starts_at` timestamp with time zone; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `UNIQUE (company_id, group_id, day_date)`
- `FOREIGN KEY (company_id, group_id) REFERENCES talent.training_groups(company_id, id)`
- `CHECK ((day_number > 0))`
- `CHECK ((phase = ANY (ARRAY['TEORIA'::text, 'OJT'::text])))`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`

## talent.training_groups

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `campaign_id` text; `code` text; `name` text; `trainer_id` text?; `ojt_trainer_id` text?; `coordinator_id` text?; `start_date` date; `theory_end_date` date; `ojt_start_date` date?; `ojt_end_date` date?; `theory_days` integer; `ojt_days` integer?; `extension_days` integer?; `schedule` text; `timezone` text (default: `'America/Lima'::text`); `start_time` time without time zone?; `modality` text; `site_id` text?; `room_or_link` text?; `capacity` integer?; `passing_grade` numeric?; `status` text; `closed_at` timestamp with time zone?; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `CHECK ((capacity > 0))`
- `CHECK ((theory_end_date >= start_date))`
- `CHECK (((ojt_end_date IS NULL) OR (ojt_start_date IS NULL) OR (ojt_end_date >= ojt_start_date)))`
- `FOREIGN KEY (company_id, campaign_id) REFERENCES talent.campaigns(company_id, id)`
- `UNIQUE (company_id, code)`
- `FOREIGN KEY (company_id, coordinator_id) REFERENCES talent.profiles(company_id, id)`
- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, ojt_trainer_id) REFERENCES talent.profiles(company_id, id)`
- `FOREIGN KEY (company_id, site_id) REFERENCES talent.sites(company_id, id)`
- `FOREIGN KEY (company_id, trainer_id) REFERENCES talent.profiles(company_id, id)`
- `CHECK ((extension_days >= 0))`
- `CHECK ((modality = ANY (ARRAY['PRESENCIAL'::text, 'REMOTO'::text, 'HIBRIDO'::text, 'VIRTUAL'::text])))`
- `CHECK ((ojt_days > 0))`
- `CHECK ((passing_grade >= (0)::numeric))`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((status = ANY (ARRAY['PENDIENTE_ASIGNACION'::text, 'PROGRAMADA'::text, 'EN_CAPACITACION'::text, 'EN_OJT'::text, 'EXTENSION_OJT'::text, 'FINALIZADA'::text, 'CANCELADA'::text])))`
- `CHECK ((theory_days > 0))`
- `CHECK ((version > 0))`

## talent.user_modules

Campos: `company_id` text; `id` text (default: `(gen_random_uuid())::text`); `user_id` text; `module` text; `version` bigint (default: `1`); `created_at` timestamp with time zone (default: `now()`); `updated_at` timestamp with time zone (default: `now()`); `archived_at` timestamp with time zone?.

- `FOREIGN KEY (company_id) REFERENCES talent.companies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (company_id, user_id) REFERENCES talent.profiles(company_id, id)`
- `UNIQUE (company_id, user_id, module)`
- `FOREIGN KEY (module) REFERENCES talent.modules(code)`
- `PRIMARY KEY (company_id, id)`
- `CHECK ((version > 0))`
