-- Migration: add_calendar_connection
-- Run this on your local PostgreSQL (kairo_db) to create the CalendarConnection table.
-- Then run: npx prisma generate  (to regenerate the Prisma client)

CREATE TABLE IF NOT EXISTS calendar_connections (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                VARCHAR NOT NULL,          -- 'oauth_google' | 'oauth_microsoft' | 'ics_url' | 'caldav'
  label               VARCHAR,
  is_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  calendar_id         VARCHAR DEFAULT 'primary', -- for OAuth: which Google calendar
  provider_account_id VARCHAR,                   -- e.g. Google email
  access_token        TEXT,
  refresh_token       TEXT,
  expiry_date         TIMESTAMPTZ,
  last_sync_at        TIMESTAMPTZ,
  last_sync_error     TEXT,
  -- Option 2 backup fields (ICS/CalDAV) -- future use
  ics_url             TEXT,
  caldav_url          TEXT,
  caldav_username     VARCHAR,
  caldav_password     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_user_id ON calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_type_enabled ON calendar_connections(type, is_enabled);
