-- ============================================================
-- Mission 1 — Seed data
-- Run after migration with service role (bypasses RLS).
--
-- Seeds:
--   1. Six badges (§11)
--   2. Kyniq Editorial system profile (§3.2)
--   3. Five films with real metadata
-- ============================================================

-- ============================================================
-- 1. BADGES (§11 — exactly six)
-- ============================================================

INSERT INTO public.badges (key, name, description, tier) VALUES
  ('first-reading',  'First Reading',  'Shared your first interpretation',                                'starter'),
  ('interpreter',    'Interpreter',    'One of your readings was promoted into a canonical answer',        'marquee'),
  ('curator',        'Curator',        'An edit suggestion of yours was approved',                         'achievement'),
  ('resonant',       'Resonant',       'One of your readings received many upvotes',                       'achievement'),
  ('cinephile',      'Cinephile',      'Contributed readings across many distinct films',                  'milestone'),
  ('keeper',         'Keeper',         'You maintain a canonical answer cited by an AI engine',            'pinnacle')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- 2. KYNIQ EDITORIAL — system profile (§3.2)
--    Uses a fixed UUID for referential stability.
--    Must create an auth.users row first (profiles FK constraint),
--    then the handle_new_user trigger auto-creates the profile,
--    then we UPDATE the profile with system-specific fields.
-- ============================================================

-- 2a. Create the auth.users row (system account, no real login)
INSERT INTO auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at,
  raw_user_meta_data
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'editorial@kyniq.io',
  '',               -- no password — system-only account
  now(),
  now(),
  now(),
  '{"full_name": "Kyniq Editorial"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 2b. The trigger created a profile; now upgrade it to system role
UPDATE public.profiles
SET
  username       = 'kyniq-editorial',
  display_name   = 'Kyniq Editorial',
  bio            = 'AI-assisted, human-reviewed editorial voice for Kyniq. Drafts questions and canonical answers to seed the knowledge base.',
  role           = 'system',
  is_public      = true
WHERE id = '00000000-0000-0000-0000-000000000001';


-- ============================================================
-- 3. FIVE SEED FILMS (real titles, minimal metadata)
-- ============================================================

INSERT INTO public.films (tmdb_id, title, original_title, year, director, director_slug, slug, genres, overview) VALUES
  (
    1018,
    'Mulholland Drive',
    'Mulholland Drive',
    2001,
    'David Lynch',
    'david-lynch',
    'mulholland-drive-2001',
    ARRAY['Drama', 'Mystery', 'Thriller'],
    'Blonde Betty Elms has only just arrived in Hollywood to become a movie star when she meets an enigmatic brunette with amnesia. As they work together to unravel the mystery of the brunette''s identity, they begin to uncover the dark side of the entertainment industry.'
  ),
  (
    62,
    '2001: A Space Odyssey',
    '2001: A Space Odyssey',
    1968,
    'Stanley Kubrick',
    'stanley-kubrick',
    '2001-a-space-odyssey-1968',
    ARRAY['Science Fiction', 'Mystery', 'Adventure'],
    'Humanity finds a mysterious object buried beneath the lunar surface and sets off to find its origins with the help of HAL 9000, the world''s most advanced super computer.'
  ),
  (
    963,
    'Persona',
    'Persona',
    1966,
    'Ingmar Bergman',
    'ingmar-bergman',
    'persona-1966',
    ARRAY['Drama'],
    'A young nurse, Alma, is put in charge of Elisabeth Vogler, an actress who is recovering from some kind of breakdown. As they spend time together, Alma speaks to Elisabeth constantly, and eventually their identities seem to merge.'
  ),
  (
    2337,
    'Stalker',
    'Сталкер',
    1979,
    'Andrei Tarkovsky',
    'andrei-tarkovsky',
    'stalker-1979',
    ARRAY['Science Fiction', 'Drama'],
    'A guide leads two men through an area known as the Zone to find a room that grants wishes.'
  ),
  (
    498025,
    'Burning',
    '버닝',
    2018,
    'Lee Chang-dong',
    'lee-chang-dong',
    'burning-2018',
    ARRAY['Drama', 'Mystery', 'Thriller'],
    'Deliveryman Jongsu is out on a delivery when he runs into Haemi, a girl who once lived in his neighborhood. She asks him to look after her cat while she travels to Africa, and when she returns she introduces him to Ben, a mysterious man she met there.'
  )
ON CONFLICT (tmdb_id) DO NOTHING;
