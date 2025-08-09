-- ===== REMOVE CONFLICTING RLS POLICIES =====
-- Odstraň starší restrictivní policies, nech jen ty permissive

-- DEATH_EVENTS - odstranit authenticated policy
DROP POLICY IF EXISTS "Authenticated can read death events" ON death_events;

-- POWERUP_EVENTS - odstranit authenticated policy  
DROP POLICY IF EXISTS "Authenticated can read powerup events" ON powerup_events;

-- BOSS_ENCOUNTERS - odstranit authenticated policy
DROP POLICY IF EXISTS "Authenticated can read boss encounters" ON boss_encounters;

-- PERFORMANCE_METRICS - odstranit authenticated policy
DROP POLICY IF EXISTS "Authenticated can read performance metrics" ON performance_metrics;

-- ENEMY_STATS - odstranit authenticated policy
DROP POLICY IF EXISTS "Authenticated can read enemy stats" ON enemy_stats;

-- Ověřit že zůstaly jen ty správné policies (true = všem dovoleno)
SELECT schemaname, tablename, policyname, permissive, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('death_events', 'powerup_events', 'boss_encounters', 'performance_metrics', 'enemy_stats')
AND cmd = 'SELECT'
ORDER BY tablename, policyname;