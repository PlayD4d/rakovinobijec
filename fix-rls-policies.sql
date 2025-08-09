-- ===== FIX RLS POLICIES FOR ANALYTICS TABLES =====
-- Spusť v Supabase SQL Editor

-- GAME_SESSIONS UPDATE
DROP POLICY IF EXISTS "Enable update access for all users" ON game_sessions;

CREATE POLICY "Enable update access for all users" ON game_sessions
FOR UPDATE USING (true) WITH CHECK (true);

-- DEATH_EVENTS
DROP POLICY IF EXISTS "Enable read access for all users" ON death_events;
DROP POLICY IF EXISTS "Enable insert access for all users" ON death_events;

CREATE POLICY "Enable read access for all users" ON death_events
FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON death_events
FOR INSERT WITH CHECK (true);

-- POWERUP_EVENTS  
DROP POLICY IF EXISTS "Enable read access for all users" ON powerup_events;
DROP POLICY IF EXISTS "Enable insert access for all users" ON powerup_events;

CREATE POLICY "Enable read access for all users" ON powerup_events
FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON powerup_events
FOR INSERT WITH CHECK (true);

-- BOSS_ENCOUNTERS
DROP POLICY IF EXISTS "Enable read access for all users" ON boss_encounters;
DROP POLICY IF EXISTS "Enable insert access for all users" ON boss_encounters;

CREATE POLICY "Enable read access for all users" ON boss_encounters
FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON boss_encounters
FOR INSERT WITH CHECK (true);

-- PERFORMANCE_METRICS
DROP POLICY IF EXISTS "Enable read access for all users" ON performance_metrics;
DROP POLICY IF EXISTS "Enable insert access for all users" ON performance_metrics;

CREATE POLICY "Enable read access for all users" ON performance_metrics
FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON performance_metrics
FOR INSERT WITH CHECK (true);

-- ENEMY_STATS (pro jistotu)
DROP POLICY IF EXISTS "Enable read access for all users" ON enemy_stats;
DROP POLICY IF EXISTS "Enable insert access for all users" ON enemy_stats;

CREATE POLICY "Enable read access for all users" ON enemy_stats
FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON enemy_stats
FOR INSERT WITH CHECK (true);

-- Kontrola že policies jsou aktivní
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('death_events', 'powerup_events', 'boss_encounters', 'performance_metrics', 'enemy_stats')
ORDER BY tablename, policyname;