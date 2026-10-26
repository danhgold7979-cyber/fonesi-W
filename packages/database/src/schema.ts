export const SCHEMA_VERSION = 3;
export const migration = `
CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, checksum TEXT NOT NULL) STRICT;
CREATE TABLE apps(id TEXT PRIMARY KEY, metadata TEXT NOT NULL) STRICT;
CREATE TABLE devices(id TEXT PRIMARY KEY, name TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1))) STRICT;
CREATE TABLE identities(id TEXT PRIMARY KEY, app_id TEXT NOT NULL REFERENCES apps(id), device_id TEXT NOT NULL REFERENCES devices(id), kind TEXT NOT NULL, fingerprint TEXT NOT NULL) STRICT;
CREATE TABLE workflows(id TEXT PRIMARY KEY, app_id TEXT NOT NULL REFERENCES apps(id), name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN('main','sub')), archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN(0,1))) STRICT;
CREATE TABLE workflow_drafts(workflow_id TEXT PRIMARY KEY REFERENCES workflows(id), revision INTEGER NOT NULL CHECK(revision>=0), bundle TEXT NOT NULL, updated_at TEXT NOT NULL) STRICT;
CREATE TABLE workflow_versions(id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL REFERENCES workflows(id), number INTEGER NOT NULL CHECK(number>0), hash TEXT NOT NULL CHECK(length(hash)=64), bundle TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(workflow_id,number)) STRICT;
CREATE TABLE processes(id TEXT PRIMARY KEY, app_id TEXT NOT NULL REFERENCES apps(id), workflow_id TEXT REFERENCES workflows(id), workflow_version_id TEXT REFERENCES workflow_versions(id), device_id TEXT REFERENCES devices(id), account_id TEXT REFERENCES identities(id), target_id TEXT REFERENCES identities(id), revision INTEGER NOT NULL CHECK(revision>=0), archived INTEGER NOT NULL CHECK(archived IN(0,1)), definition TEXT NOT NULL) STRICT;
CREATE TABLE assets(id TEXT PRIMARY KEY, source_ref TEXT NOT NULL, relative_path TEXT NOT NULL, hash TEXT NOT NULL, kind TEXT NOT NULL, bytes INTEGER NOT NULL CHECK(bytes>=0), mtime_ms REAL NOT NULL) STRICT;
CREATE TABLE content_items(id TEXT PRIMARY KEY, process_id TEXT NOT NULL REFERENCES processes(id), revision INTEGER NOT NULL CHECK(revision>=0), fields TEXT NOT NULL, ignored INTEGER NOT NULL DEFAULT 0 CHECK(ignored IN(0,1))) STRICT;
CREATE TABLE content_assets(content_id TEXT NOT NULL REFERENCES content_items(id), asset_id TEXT NOT NULL REFERENCES assets(id), ordinal INTEGER NOT NULL CHECK(ordinal>=0), PRIMARY KEY(content_id,ordinal)) STRICT;
CREATE TABLE jobs(id TEXT PRIMARY KEY, occurrence_key TEXT NOT NULL UNIQUE, process_id TEXT NOT NULL REFERENCES processes(id), device_id TEXT NOT NULL REFERENCES devices(id), content_id TEXT NOT NULL REFERENCES content_items(id), scheduled_utc TEXT NOT NULL, state TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>=0), priority INTEGER NOT NULL DEFAULT 0, snapshot TEXT NOT NULL, snapshot_hash TEXT NOT NULL, created_at TEXT NOT NULL) STRICT;
CREATE INDEX jobs_due ON jobs(state,scheduled_utc,priority);
CREATE INDEX jobs_device ON jobs(device_id,state,scheduled_utc);
CREATE UNIQUE INDEX one_active_job ON jobs(device_id) WHERE state IN('PREFLIGHT','RUNNING','POST_INTENT','POST_PENDING','POSTED','COMMENT_PENDING');
CREATE TABLE leases(device_id TEXT PRIMARY KEY REFERENCES devices(id), owner_id TEXT, owner_kind TEXT, generation INTEGER NOT NULL CHECK(generation>0), expires_at INTEGER NOT NULL) STRICT;
CREATE TABLE effects(id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), node_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN('PUBLISH','COMMENT')), effect_key TEXT NOT NULL UNIQUE, payload_hash TEXT NOT NULL, state TEXT NOT NULL, evidence_ref TEXT, created_at TEXT NOT NULL) STRICT;
CREATE TABLE review_cases(id TEXT PRIMARY KEY, effect_id TEXT NOT NULL REFERENCES effects(id), state TEXT NOT NULL, resolution TEXT, created_at TEXT NOT NULL) STRICT;
CREATE TABLE preferences(key TEXT PRIMARY KEY, revision INTEGER NOT NULL CHECK(revision>=0), value TEXT NOT NULL) STRICT;
CREATE INDEX content_process ON content_items(process_id,ignored,id);
CREATE INDEX effects_job ON effects(job_id,state);
`;

export const mediaMigration = `
CREATE TABLE sources(id TEXT PRIMARY KEY, process_id TEXT NOT NULL REFERENCES processes(id), kind TEXT NOT NULL CHECK(kind IN('FOLDER','FILE')), root_path TEXT NOT NULL, recursive INTEGER NOT NULL CHECK(recursive IN(0,1)), watch INTEGER NOT NULL CHECK(watch IN(0,1)), revision INTEGER NOT NULL CHECK(revision>=0), active INTEGER NOT NULL CHECK(active IN(0,1)), host_id TEXT NOT NULL) STRICT;
CREATE TABLE source_entries(source_id TEXT NOT NULL REFERENCES sources(id), relative_path TEXT NOT NULL, hash TEXT NOT NULL, observed_hash TEXT NOT NULL, asset_id TEXT NOT NULL REFERENCES assets(id), content_id TEXT NOT NULL REFERENCES content_items(id), state TEXT NOT NULL CHECK(state IN('READY','CHANGED','MISSING','IGNORED')), seen_generation TEXT NOT NULL, PRIMARY KEY(source_id,relative_path)) STRICT;
CREATE TABLE source_ignores(source_id TEXT NOT NULL REFERENCES sources(id), relative_path TEXT NOT NULL, hash TEXT NOT NULL, PRIMARY KEY(source_id,relative_path,hash)) STRICT;
CREATE TABLE asset_metadata(asset_id TEXT PRIMARY KEY REFERENCES assets(id), probe TEXT NOT NULL) STRICT;
CREATE INDEX source_process ON sources(process_id,active);
CREATE INDEX source_entry_content ON source_entries(content_id);
`;

export const scheduleMigration = `
CREATE TABLE schedule_previews(token TEXT PRIMARY KEY,process_id TEXT NOT NULL REFERENCES processes(id),expires_at TEXT NOT NULL,payload TEXT NOT NULL,payload_hash TEXT NOT NULL,applied_at TEXT) STRICT;
CREATE TABLE schedule_preview_jobs(token TEXT NOT NULL REFERENCES schedule_previews(token),ordinal INTEGER NOT NULL CHECK(ordinal>=0),job_id TEXT NOT NULL UNIQUE REFERENCES jobs(id),PRIMARY KEY(token,ordinal)) STRICT;
CREATE INDEX schedule_preview_expiry ON schedule_previews(expires_at);
`;

export const migrations = [
  { version: 1, sql: migration },
  { version: 2, sql: mediaMigration },
  { version: 3, sql: scheduleMigration },
] as const;
