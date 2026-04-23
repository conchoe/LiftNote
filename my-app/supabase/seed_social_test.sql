-- Social / marketplace / community seed for manual testing
-- Run in: Supabase Dashboard → SQL Editor (as postgres; bypasses RLS)
--
-- PREREQ — create 5 auth users (Authentication → Add user, or sign up in the app)
--   Use these emails EXACTLY, or change e1..e5 in the DECLARE block to match your accounts.
--     1) capstone.seed.1@example.com
--     2) capstone.seed.2@example.com
--     3) capstone.seed.3@example.com
--     4) capstone.seed.4@example.com
--     5) capstone.seed.5@example.com
--   Confirm sign-up: trigger should create public.profiles rows automatically.
--
-- RERUN: safe to re-run: upserts friend rows, deletes prior [SEED] splits + dependent likes, recreates.
--
-- REMOVE SEED: DELETE FROM public.splits WHERE name LIKE '[SEED] %';

BEGIN;

DO $seed$
DECLARE
  e1 text := 'capstone.seed.1@example.com';
  e2 text := 'capstone.seed.2@example.com';
  e3 text := 'capstone.seed.3@example.com';
  e4 text := 'capstone.seed.4@example.com';
  e5 text := 'capstone.seed.5@example.com';

  u1 uuid; -- alice: public, friends with 2, pending->3, workout logs
  u2 uuid; -- bob: public, friend alice
  u3 uuid; -- carol: private, has incoming from 1, pending/edges
  u4 uuid; -- dave: public, marketplace "winner" lots of recent split likes
  u5 uuid; -- eve: public, likes people’s splits

  s_dave_hot uuid;   -- [SEED] PPL A — should trend + all-time
  s_dave_alt uuid;   -- [SEED] Upper/Lower
  s_dave_cool uuid;  -- [SEED] Bro split
  s_bob_a uuid;      -- [SEED] Bob 5x5
  s_alice uuid;      -- [SEED] Alice home

  wl1 uuid; wl2 uuid;
  payload jsonb;
BEGIN
  SELECT id INTO u1 FROM auth.users WHERE lower(email) = lower(e1) LIMIT 1;
  SELECT id INTO u2 FROM auth.users WHERE lower(email) = lower(e2) LIMIT 1;
  SELECT id INTO u3 FROM auth.users WHERE lower(email) = lower(e3) LIMIT 1;
  SELECT id INTO u4 FROM auth.users WHERE lower(email) = lower(e4) LIMIT 1;
  SELECT id INTO u5 FROM auth.users WHERE lower(email) = lower(e5) LIMIT 1;

  IF u1 IS NULL OR u2 IS NULL OR u3 IS NULL OR u4 IS NULL OR u5 IS NULL THEN
    RAISE EXCEPTION
      'All 5 users must exist in auth.users. Create the accounts with the capstone.seed.*@example.com (or your edited) emails, then re-run. Missing: 1=%,2=%,3=%,4=%,5=%',
      u1, u2, u3, u4, u5;
  END IF;

  -- Profiles: public (except carol) + readable usernames
  UPDATE public.profiles
  SET username = 'seed_alice', is_private = false, bio = 'SEED: Alice'
  WHERE id = u1;
  UPDATE public.profiles
  SET username = 'seed_bob', is_private = false, bio = 'SEED: Bob'
  WHERE id = u2;
  UPDATE public.profiles
  SET username = 'seed_carol', is_private = true, bio = 'SEED: Carol (private)'
  WHERE id = u3;
  UPDATE public.profiles
  SET username = 'seed_dave', is_private = false, bio = 'SEED: Dave (marketplace test)'
  WHERE id = u4;
  UPDATE public.profiles
  SET username = 'seed_eve', is_private = false, bio = 'SEED: Eve'
  WHERE id = u5;

  -- Optional cleanup from a previous run (same names)
  DELETE FROM public.likes
  WHERE target_id IN (SELECT id FROM public.splits WHERE name LIKE '[SEED] %');
  DELETE FROM public.workout_logs
  WHERE user_id IN (u1, u2) AND split_name IN ('[SEED] 5x5 GAINZ', '[SEED] Home gym');
  DELETE FROM public.splits WHERE name LIKE '[SEED] %';

  -- Friends: alice–bob accepted; alice→carol pending (carol can accept in Community)
  INSERT INTO public.friends (user_id, friend_id, status)
  VALUES
    (u1, u2, 'accepted'),
    (u1, u3, 'pending')
  ON CONFLICT (user_id, friend_id) DO UPDATE
  SET status = excluded.status;
  -- note: (u2,u1) not required for your app; one row covers both in feed code

  INSERT INTO public.splits (creator_id, name, description, structure_json, created_at)
  VALUES (
    u4,
    '[SEED] PPL A',
    'Hot split for likes',
    jsonb_build_object(
      'slots', jsonb_build_array(
        jsonb_build_object('workoutName', 'Push', 'exerciseNames', jsonb_build_array('Bench', 'OHP', 'Dips')),
        jsonb_build_object('workoutName', 'Pull', 'exerciseNames', jsonb_build_array('Row', 'Pulldown', 'Curl')),
        null, null, null, null, null
      )
    ),
    now() - interval '2 days'
  )
  RETURNING id INTO s_dave_hot;

  INSERT INTO public.splits (creator_id, name, description, structure_json, created_at)
  VALUES (
    u4,
    '[SEED] Upper / Lower B',
    'Other Dave split',
    jsonb_build_object(
      'slots', jsonb_build_array(
        jsonb_build_object('workoutName', 'Upper', 'exerciseNames', jsonb_build_array('Press', 'Row')),
        jsonb_build_object('workoutName', 'Lower', 'exerciseNames', jsonb_build_array('Squat', 'RDL')),
        null, null, null, null, null
      )
    ),
    now() - interval '5 days'
  )
  RETURNING id INTO s_dave_alt;

  INSERT INTO public.splits (creator_id, name, description, structure_json, created_at)
  VALUES (
    u4,
    '[SEED] Bro 3x',
    'Backup',
    jsonb_build_object(
      'slots', jsonb_build_array(
        jsonb_build_object('workoutName', 'Arms', 'exerciseNames', jsonb_build_array('Curl', 'Pushdown')),
        null, null, null, null, null, null
      )
    ),
    now() - interval '10 days'
  )
  RETURNING id INTO s_dave_cool;

  INSERT INTO public.splits (creator_id, name, description, structure_json, created_at)
  VALUES (
    u2,
    '[SEED] 5x5 GAINZ',
    'Bob public split',
    jsonb_build_object(
      'slots', jsonb_build_array(
        jsonb_build_object('workoutName', 'A day', 'exerciseNames', jsonb_build_array('Squat', 'Bench', 'Row')),
        null, null, null, null, null, null
      )
    ),
    now() - interval '20 days'
  )
  RETURNING id INTO s_bob_a;

  INSERT INTO public.splits (creator_id, name, description, structure_json, created_at)
  VALUES (
    u1,
    '[SEED] Home gym',
    'Alice',
    jsonb_build_object(
      'slots', jsonb_build_array(
        jsonb_build_object('workoutName', 'Full body', 'exerciseNames', jsonb_build_array('Kettlebell', 'Pullup')),
        null, null, null, null, null, null
      )
    ),
    now() - interval '30 days'
  )
  RETURNING id INTO s_alice;

  -- Split likes: UNIQUE (user_id, target_id, type) — at most one like per user per split.
  -- Dave: 4 people × 3 splits = 12 “weekly” events (all last 7 days) → beats Bob’s 5 on one split.
  INSERT INTO public.likes (user_id, target_id, type, created_at) VALUES
    (u1, s_dave_hot, 'split', now() - interval '1 day'),
    (u2, s_dave_hot, 'split', now() - interval '2 days'),
    (u3, s_dave_hot, 'split', now() - interval '1 day 6 hours'),
    (u5, s_dave_hot, 'split', now() - interval '3 hours'),
    (u1, s_dave_alt, 'split', now() - interval '2 days'),
    (u2, s_dave_alt, 'split', now() - interval '1 day 12 hours'),
    (u3, s_dave_alt, 'split', now() - interval '3 days'),
    (u5, s_dave_alt, 'split', now() - interval '6 days'),
    (u1, s_dave_cool, 'split', now() - interval '4 days'),
    (u2, s_dave_cool, 'split', now() - interval '5 days'),
    (u3, s_dave_cool, 'split', now() - interval '3 days 5 hours'),
    (u5, s_dave_cool, 'split', now() - interval '1 day 2 hours');

  -- Bob’s split: fewer in-window likes than Dave; extra older rows for all-time / variety
  INSERT INTO public.likes (user_id, target_id, type, created_at) VALUES
    (u1, s_bob_a, 'split', now() - interval '2 days'),
    (u4, s_bob_a, 'split', now() - interval '1 day'),
    (u5, s_bob_a, 'split', now() - interval '4 days'),
    (u2, s_bob_a, 'split', now() - interval '20 days'),
    (u3, s_bob_a, 'split', now() - interval '25 days'),
    (u2, s_alice, 'split', now() - interval '2 days');

  -- Friend activity: Bob + Alice each log a workout (so Community shows entries when viewing as the other)
  wl1 := gen_random_uuid();
  payload := jsonb_build_object(
    'id', wl1::text,
    'completedAt', to_char(now() - interval '1 hour', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'localDate', to_char((now() - interval '1 hour')::date, 'YYYY-MM-DD'),
    'splitId', s_bob_a::text,
    'splitNameSnapshot', '[SEED] 5x5 GAINZ',
    'workoutSlotIndex', 0,
    'workoutNameSnapshot', 'A day',
    'sets', jsonb_build_array(
      jsonb_build_object(
        'exerciseId', 'ex1',
        'exerciseNameSnapshot', 'Squat',
        'setIndex', 1,
        'reps', 5,
        'weight', 200,
        'rpe', 7
      )
    )
  );
  INSERT INTO public.workout_logs (id, user_id, payload, volume_total, workout_name, split_name, created_at, likes_count)
  VALUES (wl1, u2, payload, 200 * 5, 'A day', '[SEED] 5x5 GAINZ', now() - interval '1 hour', 0);

  wl2 := gen_random_uuid();
  payload := jsonb_build_object(
    'id', wl2::text,
    'completedAt', to_char(now() - interval '2 hour', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'localDate', to_char((now() - interval '2 hour')::date, 'YYYY-MM-DD'),
    'splitId', s_alice::text,
    'splitNameSnapshot', '[SEED] Home gym',
    'workoutSlotIndex', 0,
    'workoutNameSnapshot', 'Full body',
    'sets', jsonb_build_array(
      jsonb_build_object('exerciseId', 'e2', 'exerciseNameSnapshot', 'Kettlebell', 'setIndex', 1, 'reps', 10, 'weight', 50, 'rpe', 6)
    )
  );
  INSERT INTO public.workout_logs (id, user_id, payload, volume_total, workout_name, split_name, created_at, likes_count)
  VALUES (wl2, u1, payload, 500, 'Full body', '[SEED] Home gym', now() - interval '2 hours', 0);
END
$seed$;

COMMIT;

-- Verify (optional)
-- select id, email from auth.users where email like 'capstone.seed%';
-- select name, likes_count, creator_id from public.splits where name like '[SEED]%';
-- select * from public.friends where user_id in (select id from public.profiles where username like 'seed\_%' escape '\');
