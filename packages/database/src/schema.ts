export const SCHEMA_VERSION = 19;
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

export const contentChangeMigration = `
CREATE TABLE content_change_previews(token TEXT PRIMARY KEY,process_id TEXT NOT NULL REFERENCES processes(id),expires_at TEXT NOT NULL,payload TEXT NOT NULL,payload_hash TEXT NOT NULL,result TEXT) STRICT;
CREATE INDEX content_preview_expiry ON content_change_previews(expires_at);
`;
export const queueClaimMigration = `
CREATE TABLE job_claims(job_id TEXT PRIMARY KEY REFERENCES jobs(id),device_id TEXT NOT NULL REFERENCES devices(id),owner_id TEXT NOT NULL,generation INTEGER NOT NULL CHECK(generation>0),expires_at INTEGER NOT NULL) STRICT;
CREATE INDEX job_claim_device ON job_claims(device_id,expires_at);
CREATE TABLE queue_events(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES jobs(id),kind TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL) STRICT;
CREATE INDEX queue_event_job ON queue_events(job_id,created_at);
`;
export const deviceRegistryMigration = `
CREATE TABLE device_profiles(device_id TEXT PRIMARY KEY REFERENCES devices(id),fingerprint TEXT NOT NULL UNIQUE,metadata TEXT,identity TEXT NOT NULL CHECK(identity IN('VERIFIED_PROPERTIES','PROVISIONAL','CONFLICT')),revision INTEGER NOT NULL CHECK(revision>=0)) STRICT;
CREATE TABLE device_transports(host_id TEXT NOT NULL,serial TEXT NOT NULL,device_id TEXT NOT NULL REFERENCES devices(id),kind TEXT NOT NULL CHECK(kind IN('USB','TCP','EMULATOR')),state TEXT NOT NULL CHECK(state IN('CONNECTED','UNAUTHORIZED','OFFLINE','NO_PERMISSIONS','DISCONNECTED')),generation INTEGER NOT NULL CHECK(generation>0),last_seen TEXT NOT NULL,identity_verified INTEGER NOT NULL CHECK(identity_verified IN(0,1)),PRIMARY KEY(host_id,serial)) STRICT;
CREATE INDEX device_transport_device ON device_transports(device_id,host_id,state);
`;
export const endpointPolicyMigration = `
CREATE TABLE device_endpoint_policies(host_id TEXT NOT NULL,endpoint TEXT NOT NULL,resolved_serial TEXT,desired INTEGER NOT NULL CHECK(desired IN(0,1)),revision INTEGER NOT NULL CHECK(revision>=0),failures INTEGER NOT NULL CHECK(failures>=0),next_attempt_utc TEXT,last_error_code TEXT,PRIMARY KEY(host_id,endpoint)) STRICT;
`;
export const timelinePagingMigration = `
CREATE TABLE query_epochs(name TEXT PRIMARY KEY,revision INTEGER NOT NULL CHECK(revision>=0)) STRICT;
INSERT INTO query_epochs VALUES('jobs',0);
CREATE TRIGGER jobs_query_insert AFTER INSERT ON jobs BEGIN UPDATE query_epochs SET revision=revision+1 WHERE name='jobs'; END;
CREATE TRIGGER jobs_query_update AFTER UPDATE ON jobs BEGIN UPDATE query_epochs SET revision=revision+1 WHERE name='jobs'; END;
CREATE TRIGGER jobs_query_delete AFTER DELETE ON jobs BEGIN UPDATE query_epochs SET revision=revision+1 WHERE name='jobs'; END;
CREATE INDEX jobs_timeline_page ON jobs(julianday(scheduled_utc),-priority,created_at,id);
`;
export const processCloneMigration = `
CREATE TABLE process_clone_previews(token TEXT PRIMARY KEY,process_id TEXT NOT NULL REFERENCES processes(id),host_id TEXT,payload TEXT NOT NULL,payload_hash TEXT NOT NULL,expires_at TEXT NOT NULL,result TEXT) STRICT;
CREATE INDEX process_clone_expiry ON process_clone_previews(expires_at);
`;
export const mediaAdoptionMigration = `
CREATE TABLE media_adoption_previews(token TEXT PRIMARY KEY,process_id TEXT NOT NULL REFERENCES processes(id),asset_id TEXT NOT NULL REFERENCES assets(id),host_id TEXT NOT NULL,payload TEXT NOT NULL,payload_hash TEXT NOT NULL,expires_at TEXT NOT NULL,result TEXT) STRICT;
CREATE INDEX media_adoption_expiry ON media_adoption_previews(expires_at);
`;
export const migrations = [
  { version: 1, sql: migration },
  { version: 2, sql: mediaMigration },
  { version: 3, sql: scheduleMigration },
  { version: 4, sql: contentChangeMigration },
  { version: 5, sql: queueClaimMigration },
  { version: 6, sql: deviceRegistryMigration },
  { version: 7, sql: endpointPolicyMigration },
  { version: 8, sql: timelinePagingMigration },
  { version: 9, sql: processCloneMigration },
  { version: 10, sql: mediaAdoptionMigration },
  {
    version: 11,
    sql: `
CREATE TABLE job_change_previews(token TEXT PRIMARY KEY,host_id TEXT,payload TEXT NOT NULL,payload_hash TEXT NOT NULL,expires_at TEXT NOT NULL,result TEXT) STRICT;
CREATE INDEX job_change_expiry ON job_change_previews(expires_at);
CREATE INDEX jobs_device_instant ON jobs(device_id,julianday(scheduled_utc));
`,
  },
  {
    version: 12,
    sql: `
CREATE INDEX jobs_app_timeline ON jobs(json_extract(snapshot,'$.bundle.workflow.appId'),julianday(scheduled_utc),-priority,created_at,id);
`,
  },
  {
    version: 13,
    sql: `
CREATE TABLE device_resolution_previews(
  token TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  device_id TEXT NOT NULL REFERENCES devices(id),
  expected_revision INTEGER NOT NULL,
  proof_hash TEXT NOT NULL CHECK(length(proof_hash)=64),
  expires_at TEXT NOT NULL,
  used_at TEXT
) STRICT;
CREATE INDEX device_resolution_preview_expiry ON device_resolution_previews(expires_at);
CREATE TABLE device_resolution_audit(
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id),
  host_id TEXT NOT NULL,
  previous_revision INTEGER NOT NULL,
  new_revision INTEGER NOT NULL,
  proof_hash TEXT NOT NULL CHECK(length(proof_hash)=64),
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX device_resolution_audit_device ON device_resolution_audit(device_id,created_at);
`,
  },
  {
    version: 14,
    sql: `
INSERT INTO query_epochs(name,revision) VALUES('content',0);
CREATE TRIGGER content_epoch_insert AFTER INSERT ON content_items BEGIN UPDATE query_epochs SET revision=revision+1 WHERE name='content'; END;
CREATE TRIGGER content_epoch_update AFTER UPDATE ON content_items BEGIN UPDATE query_epochs SET revision=revision+1 WHERE name='content'; END;
CREATE TRIGGER content_epoch_delete AFTER DELETE ON content_items BEGIN UPDATE query_epochs SET revision=revision+1 WHERE name='content'; END;
CREATE TRIGGER content_assets_epoch_insert AFTER INSERT ON content_assets BEGIN UPDATE query_epochs SET revision=revision+1 WHERE name='content'; END;
CREATE TRIGGER content_assets_epoch_delete AFTER DELETE ON content_assets BEGIN UPDATE query_epochs SET revision=revision+1 WHERE name='content'; END;
`,
  },
  {
    version: 15,
    sql: `
CREATE TABLE device_stage_transfers(
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  device_id TEXT NOT NULL REFERENCES devices(id),
  host_id TEXT NOT NULL,
  asset_id TEXT NOT NULL REFERENCES assets(id),
  ordinal INTEGER NOT NULL CHECK(ordinal>=0 AND ordinal<32),
  snapshot_hash TEXT NOT NULL CHECK(length(snapshot_hash)=64),
  expected_hash TEXT NOT NULL CHECK(length(expected_hash)=64),
  expected_bytes INTEGER NOT NULL CHECK(expected_bytes>0),
  claim_generation INTEGER NOT NULL CHECK(claim_generation>0),
  remote_path TEXT NOT NULL,
  nonce TEXT NOT NULL CHECK(length(nonce)=32),
  state TEXT NOT NULL CHECK(state IN('INTENT','TRANSFER_UNCERTAIN','SYNC_ACK_UNVERIFIED','NEEDS_REVIEW')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(job_id,ordinal),
  UNIQUE(device_id,remote_path)
) STRICT;
CREATE INDEX stage_transfer_device ON device_stage_transfers(device_id,state,job_id);
`,
  },
  {
    version: 16,
    sql: `
ALTER TABLE device_stage_transfers ADD COLUMN remote_readback_hash TEXT;
ALTER TABLE device_stage_transfers ADD COLUMN remote_readback_bytes INTEGER;
ALTER TABLE device_stage_transfers ADD COLUMN remote_readback_at TEXT;
`,
  },
  { version: 17, sql: `
ALTER TABLE device_stage_transfers ADD COLUMN mediastore_row_id TEXT;
ALTER TABLE device_stage_transfers ADD COLUMN mediastore_display_name TEXT;
ALTER TABLE device_stage_transfers ADD COLUMN mediastore_relative_path TEXT;
ALTER TABLE device_stage_transfers ADD COLUMN mediastore_mime_type TEXT;
ALTER TABLE device_stage_transfers ADD COLUMN mediastore_bytes INTEGER;
ALTER TABLE device_stage_transfers ADD COLUMN mediastore_at TEXT;
` },
  { version: 18, sql: `
CREATE TABLE device_stage_reconciliations(
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL,
 stage_id TEXT NOT NULL REFERENCES device_stage_transfers(id),
 job_id TEXT NOT NULL REFERENCES jobs(id), device_id TEXT NOT NULL REFERENCES devices(id),
 host_id TEXT NOT NULL, claim_generation INTEGER NOT NULL CHECK(claim_generation>0),
 classification TEXT NOT NULL CHECK(classification IN('REMOTE_BYTES_MATCHED','MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED','REMOTE_MISSING','REMOTE_MISMATCH','PROBE_UNSUPPORTED','REVIEW_REQUIRED')),
 observed_hash TEXT CHECK(observed_hash IS NULL OR length(observed_hash)=64),
 observed_bytes INTEGER CHECK(observed_bytes IS NULL OR observed_bytes>0),
 mediastore_status TEXT CHECK(mediastore_status IS NULL OR mediastore_status IN('INDEXED_EXACT','NOT_INDEXED','AMBIGUOUS','UNSUPPORTED')),
 created_at TEXT NOT NULL, UNIQUE(stage_id,request_id)
) STRICT;
CREATE INDEX stage_reconciliation_job ON device_stage_reconciliations(job_id,created_at);
` },
  { version: 19, sql: `
ALTER TABLE device_stage_reconciliations ADD COLUMN lease_owner_kind TEXT NOT NULL DEFAULT 'JOB' CHECK(lease_owner_kind IN('JOB','MANUAL'));
ALTER TABLE device_stage_reconciliations ADD COLUMN lease_generation INTEGER NOT NULL DEFAULT 1 CHECK(lease_generation>0);
UPDATE device_stage_reconciliations SET lease_generation=claim_generation;
` },
] as const;
