-- agnamo · trip — Supabase schema
-- Run this in: Dashboard → SQL Editor → New query
-- Then: Settings → API → Exposed schemas → add 'public' (should be default)

CREATE TABLE IF NOT EXISTS public.trips (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city        TEXT,
  country     TEXT,
  cc          TEXT,
  lat         DOUBLE PRECISION,
  lon         DOUBLE PRECISION,
  tz          TEXT,
  depart      DATE,
  return_date DATE,
  airline     TEXT,
  flight_num  TEXT,
  flight_time TEXT,
  booking_ref TEXT,
  items       JSONB DEFAULT '{}'::jsonb,
  closet      JSONB DEFAULT '[]'::jsonb,
  style        JSONB DEFAULT '[]'::jsonb,
  weather     JSONB,
  source      TEXT DEFAULT 'manual',
  raw_ocr     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.trips FOR ALL TO anon USING (true) WITH CHECK (true);
