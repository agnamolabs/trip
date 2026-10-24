-- Authoritative per-trip registry, ACLs, and compatibility records.
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL DEFAULT '',
  record_json TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  updated_at TEXT NOT NULL,
  write_token TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS trips_owner_updated_idx ON trips(owner, updated_at DESC);
CREATE TABLE IF NOT EXISTS trip_acl (
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Owner','Editor','Viewer')),
  PRIMARY KEY (trip_id, user_id)
);
CREATE INDEX IF NOT EXISTS trip_acl_user_trip_idx ON trip_acl(user_id, trip_id);
CREATE TABLE IF NOT EXISTS app_records (
  key TEXT PRIMARY KEY,
  value TEXT,
  expires_at INTEGER,
  tombstone INTEGER NOT NULL DEFAULT 0 CHECK (tombstone IN (0,1))
);
CREATE TABLE IF NOT EXISTS store_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS page_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  renderer TEXT NOT NULL,
  bucket TEXT NOT NULL,
  primary_nav INTEGER NOT NULL CHECK (primary_nav IN (0,1)),
  sort_order INTEGER NOT NULL
);
