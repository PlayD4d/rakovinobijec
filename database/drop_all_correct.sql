-- ============================================
-- SPRÁVNÝ DROP SKRIPT PRO EXISTUJÍCÍ DATABÁZI
-- ============================================
-- Tento skript vymaže všechny existující tabulky
-- podle supabase_setup.sql a supabase_analytics.sql
-- ============================================

-- 1. Dropneme funkce
DROP FUNCTION IF EXISTS get_top_10_scores() CASCADE;
DROP FUNCTION IF EXISTS is_high_score(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_game_insights() CASCADE;
DROP FUNCTION IF EXISTS update_daily_stats() CASCADE;

-- 2. Dropneme policies (musíme nejdřív vypnout RLS)
-- High scores policies
ALTER TABLE IF EXISTS high_scores DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read high scores" ON high_scores;
DROP POLICY IF EXISTS "Public can insert high scores" ON high_scores;

-- Analytics policies - game_sessions
ALTER TABLE IF EXISTS game_sessions DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert analytics" ON game_sessions;
DROP POLICY IF EXISTS "Authenticated can read analytics" ON game_sessions;

-- Analytics policies - enemy_stats
ALTER TABLE IF EXISTS enemy_stats DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert enemy stats" ON enemy_stats;
DROP POLICY IF EXISTS "Authenticated can read enemy stats" ON enemy_stats;

-- Analytics policies - powerup_events
ALTER TABLE IF EXISTS powerup_events DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert powerup events" ON powerup_events;
DROP POLICY IF EXISTS "Authenticated can read powerup events" ON powerup_events;

-- Analytics policies - death_events
ALTER TABLE IF EXISTS death_events DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert death events" ON death_events;
DROP POLICY IF EXISTS "Authenticated can read death events" ON death_events;

-- Analytics policies - boss_encounters
ALTER TABLE IF EXISTS boss_encounters DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert boss encounters" ON boss_encounters;
DROP POLICY IF EXISTS "Authenticated can read boss encounters" ON boss_encounters;

-- Analytics policies - performance_metrics
ALTER TABLE IF EXISTS performance_metrics DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert performance metrics" ON performance_metrics;
DROP POLICY IF EXISTS "Authenticated can read performance metrics" ON performance_metrics;

-- Analytics policies - daily_stats
ALTER TABLE IF EXISTS daily_stats DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read daily stats" ON daily_stats;

-- 3. Dropneme constraints (foreign keys)
ALTER TABLE IF EXISTS enemy_stats DROP CONSTRAINT IF EXISTS fk_enemy_session;
ALTER TABLE IF EXISTS powerup_events DROP CONSTRAINT IF EXISTS fk_powerup_session;
ALTER TABLE IF EXISTS death_events DROP CONSTRAINT IF EXISTS fk_death_session;
ALTER TABLE IF EXISTS boss_encounters DROP CONSTRAINT IF EXISTS fk_boss_session;
ALTER TABLE IF EXISTS performance_metrics DROP CONSTRAINT IF EXISTS fk_perf_session;

-- 4. Dropneme indexy
-- High scores indexy
DROP INDEX IF EXISTS idx_high_scores_score;

-- Analytics indexy
DROP INDEX IF EXISTS idx_sessions_player;
DROP INDEX IF EXISTS idx_sessions_score;
DROP INDEX IF EXISTS idx_sessions_created;
DROP INDEX IF EXISTS idx_enemy_session;
DROP INDEX IF EXISTS idx_enemy_type;
DROP INDEX IF EXISTS idx_powerup_session;
DROP INDEX IF EXISTS idx_powerup_name;
DROP INDEX IF EXISTS idx_death_session;
DROP INDEX IF EXISTS idx_death_killer;
DROP INDEX IF EXISTS idx_death_level;
DROP INDEX IF EXISTS idx_boss_session;
DROP INDEX IF EXISTS idx_boss_name;
DROP INDEX IF EXISTS idx_perf_session;
DROP INDEX IF EXISTS idx_daily_date;

-- 5. Dropneme tabulky (v opačném pořadí kvůli závislostem)
-- Nejdřív child tabulky (ty co mají foreign keys)
DROP TABLE IF EXISTS daily_stats CASCADE;
DROP TABLE IF EXISTS performance_metrics CASCADE;
DROP TABLE IF EXISTS boss_encounters CASCADE;
DROP TABLE IF EXISTS death_events CASCADE;
DROP TABLE IF EXISTS powerup_events CASCADE;
DROP TABLE IF EXISTS enemy_stats CASCADE;

-- Pak parent tabulky
DROP TABLE IF EXISTS game_sessions CASCADE;
DROP TABLE IF EXISTS high_scores CASCADE;

-- ============================================
-- Ověření že je vše smazáno
-- ============================================
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';
    
    IF table_count = 0 THEN
        RAISE NOTICE '✅ Databáze úspěšně vymazána! Všechny tabulky byly odstraněny.';
    ELSE
        RAISE NOTICE '⚠️ Zbývá % tabulek. Zkontrolujte výstup.', table_count;
    END IF;
END $$;

-- Seznam zbývajících tabulek (pokud nějaké jsou)
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

-- ============================================
-- Co dál?
-- ============================================
-- 1. Spusťte nové schéma:
--    - buď schema.sql (nové kompletní schéma)
--    - nebo supabase_setup.sql + supabase_analytics.sql (původní)
-- 2. Restartujte aplikaci
-- 3. Začněte sbírat nová data