-- ============================================
-- KOMPLETNÍ DATABÁZOVÉ SCHÉMA PRO RAKOVINOBIJEC
-- ============================================
-- Verze: 0.3.0
-- Datum: 2024
-- Compatible with PR7 architecture
-- ============================================

-- 1. HIGH SCORES TABLE (z původního supabase_setup.sql)
-- ============================================
CREATE TABLE IF NOT EXISTS high_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(12) NOT NULL,
  score INTEGER NOT NULL,
  level INTEGER NOT NULL,
  enemies_killed INTEGER NOT NULL,
  play_time INTEGER NOT NULL,
  bosses_defeated INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version VARCHAR(10) DEFAULT '0.3.0'
);

-- Index pro rychlé řazení podle skóre
CREATE INDEX IF NOT EXISTS idx_high_scores_score ON high_scores(score DESC);

-- ============================================
-- 2. GAME SESSIONS - Hlavní tabulka pro herní session
-- ============================================
CREATE TABLE IF NOT EXISTS game_sessions (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(50) UNIQUE NOT NULL,
    player_name VARCHAR(100),
    
    -- Device & browser info
    browser VARCHAR(50),
    user_agent TEXT,
    screen_width INTEGER,
    screen_height INTEGER,
    game_version VARCHAR(20),
    connection_type VARCHAR(20),
    
    -- Časové údaje
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- v sekundách (pro kompatibilitu s AnalyticsManager)
    
    -- GENERATED COLUMN pro automatický výpočet duration_seconds
    duration_seconds INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN ended_at IS NOT NULL AND started_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER
            WHEN duration IS NOT NULL 
            THEN duration
            ELSE NULL
        END
    ) STORED,
    
    -- Herní statistiky (včetně aliasů pro kompatibilitu)
    final_score INTEGER DEFAULT 0,
    final_level INTEGER DEFAULT 1,
    level_reached INTEGER DEFAULT 1, -- Alias pro final_level
    score INTEGER DEFAULT 0, -- Alias pro final_score
    level INTEGER DEFAULT 1, -- Další alias pro kompatibilitu
    enemies_killed INTEGER DEFAULT 0,
    bosses_defeated TEXT[] DEFAULT '{}', -- Array of boss IDs
    xp_collected INTEGER DEFAULT 0,
    health_pickups INTEGER DEFAULT 0,
    power_ups_collected INTEGER DEFAULT 0,
    
    -- Damage statistiky
    total_damage_dealt INTEGER DEFAULT 0,
    total_damage_taken INTEGER DEFAULT 0,
    
    -- Smrt hráče
    death_cause VARCHAR(100),
    death_position_x INTEGER,
    death_position_y INTEGER,
    
    -- Performance
    fps_average FLOAT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexy pro game_sessions
CREATE INDEX IF NOT EXISTS idx_game_sessions_started_at ON game_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_game_sessions_player_name ON game_sessions(player_name);
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_version ON game_sessions(game_version);
CREATE INDEX IF NOT EXISTS idx_sessions_player ON game_sessions(player_name);
CREATE INDEX IF NOT EXISTS idx_sessions_score ON game_sessions(final_score DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON game_sessions(created_at DESC);

-- ============================================
-- 2. ENEMY STATS - Statistiky nepřátel
-- ============================================
CREATE TABLE IF NOT EXISTS enemy_stats (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) REFERENCES game_sessions(session_id) ON DELETE CASCADE,
    enemy_type VARCHAR(100) NOT NULL,
    enemy_level INTEGER DEFAULT 1,
    
    -- Spawn a kill statistiky
    spawn_count INTEGER DEFAULT 0,
    killed_count INTEGER DEFAULT 0,
    
    -- Damage statistiky
    damage_dealt_to_player INTEGER DEFAULT 0,
    damage_taken_from_player INTEGER DEFAULT 0,
    
    -- Speciální
    player_deaths_caused INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexy pro enemy_stats
CREATE INDEX IF NOT EXISTS idx_enemy_stats_session_id ON enemy_stats(session_id);
CREATE INDEX IF NOT EXISTS idx_enemy_stats_enemy_type ON enemy_stats(enemy_type);
CREATE INDEX IF NOT EXISTS idx_enemy_session ON enemy_stats(session_id);
CREATE INDEX IF NOT EXISTS idx_enemy_type ON enemy_stats(enemy_type);

-- ============================================
-- 3. PERFORMANCE METRICS - Výkonnostní metriky
-- ============================================
CREATE TABLE IF NOT EXISTS performance_metrics (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) REFERENCES game_sessions(session_id) ON DELETE CASCADE,
    
    -- FPS metriky
    fps_min FLOAT,
    fps_max FLOAT,
    fps_average FLOAT,
    fps_drops INTEGER DEFAULT 0,
    
    -- Memory metriky (pokud dostupné)
    memory_used_mb FLOAT,
    memory_limit_mb FLOAT,
    memory_percent FLOAT,
    
    -- Herní objekty
    entities_count INTEGER,
    particles_count INTEGER,
    projectiles_count INTEGER,
    
    -- Časové razítko
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    time_since_start_ms INTEGER,
    
    -- Event type
    snapshot_type VARCHAR(50), -- 'regular', 'low_fps', 'error', 'boss_fight'
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexy pro performance_metrics
CREATE INDEX IF NOT EXISTS idx_performance_metrics_session_id ON performance_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_snapshot_type ON performance_metrics(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_perf_session ON performance_metrics(session_id);

-- ============================================
-- 4. DEATH EVENTS - Události smrti hráče
-- ============================================
CREATE TABLE IF NOT EXISTS death_events (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) REFERENCES game_sessions(session_id) ON DELETE CASCADE,
    
    -- Hráč info
    player_name VARCHAR(100),
    level INTEGER,
    score INTEGER,
    survival_time INTEGER, -- sekundy
    
    -- Příčina smrti
    killer_type VARCHAR(100),
    killer_damage INTEGER,
    overkill_damage INTEGER,
    
    -- Stav hráče
    player_hp_before INTEGER,
    player_max_hp INTEGER,
    position_x INTEGER,
    position_y INTEGER,
    active_power_ups TEXT[],
    
    -- Kontext
    enemies_on_screen INTEGER,
    projectiles_on_screen INTEGER,
    was_boss_fight BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexy pro death_events
CREATE INDEX IF NOT EXISTS idx_death_events_session_id ON death_events(session_id);
CREATE INDEX IF NOT EXISTS idx_death_events_killer_type ON death_events(killer_type);
CREATE INDEX IF NOT EXISTS idx_death_session ON death_events(session_id);
CREATE INDEX IF NOT EXISTS idx_death_killer ON death_events(killer_type);
CREATE INDEX IF NOT EXISTS idx_death_level ON death_events(level);

-- ============================================
-- 5. POWER UP EVENTS - Události sbírání power-upů
-- ============================================
CREATE TABLE IF NOT EXISTS powerup_events (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) REFERENCES game_sessions(session_id) ON DELETE CASCADE,
    
    -- Power-up info
    powerup_id VARCHAR(100),
    powerup_level INTEGER DEFAULT 1,
    
    -- Kontext
    player_level INTEGER,
    game_time_ms INTEGER,
    position_x INTEGER,
    position_y INTEGER,
    
    -- Výběr
    choices_offered TEXT[], -- Jaké možnosti byly nabídnuty
    choice_index INTEGER, -- Kterou možnost hráč vybral
    time_to_choose_ms INTEGER, -- Jak dlouho trvalo rozhodnout se
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexy pro powerup_events
CREATE INDEX IF NOT EXISTS idx_powerup_events_session_id ON powerup_events(session_id);
CREATE INDEX IF NOT EXISTS idx_powerup_events_powerup_id ON powerup_events(powerup_id);
CREATE INDEX IF NOT EXISTS idx_powerup_session ON powerup_events(session_id);
CREATE INDEX IF NOT EXISTS idx_powerup_name ON powerup_events(powerup_id);

-- ============================================
-- 6. BOSS EVENTS - Události soubojů s bossy
-- ============================================
CREATE TABLE IF NOT EXISTS boss_events (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) REFERENCES game_sessions(session_id) ON DELETE CASCADE,
    
    -- Boss info
    boss_id VARCHAR(100),
    boss_level INTEGER DEFAULT 1,
    
    -- Výsledek
    result VARCHAR(20), -- 'victory', 'defeat', 'timeout'
    fight_duration_ms INTEGER,
    
    -- Statistiky
    damage_dealt INTEGER,
    damage_taken INTEGER,
    projectiles_fired INTEGER,
    powerups_used TEXT[],
    
    -- Kontext
    player_level INTEGER,
    player_hp_start INTEGER,
    player_hp_end INTEGER,
    game_time_ms INTEGER,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexy pro boss_events
CREATE INDEX IF NOT EXISTS idx_boss_events_session_id ON boss_events(session_id);
CREATE INDEX IF NOT EXISTS idx_boss_events_boss_id ON boss_events(boss_id);
CREATE INDEX IF NOT EXISTS idx_boss_events_result ON boss_events(result);
CREATE INDEX IF NOT EXISTS idx_boss_session ON boss_events(session_id);
CREATE INDEX IF NOT EXISTS idx_boss_name ON boss_events(boss_id);

-- ============================================
-- 7. LOOT EVENTS - Události dropů a lootů
-- ============================================
CREATE TABLE IF NOT EXISTS loot_events (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) REFERENCES game_sessions(session_id) ON DELETE CASCADE,
    
    -- Loot info
    loot_id VARCHAR(100),
    loot_source VARCHAR(100), -- enemy ID nebo 'chest', 'boss', etc.
    
    -- Akce
    action VARCHAR(20), -- 'dropped', 'collected', 'expired'
    
    -- Kontext
    position_x INTEGER,
    position_y INTEGER,
    game_time_ms INTEGER,
    player_level INTEGER,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexy pro loot_events
CREATE INDEX IF NOT EXISTS idx_loot_events_session_id ON loot_events(session_id);
CREATE INDEX IF NOT EXISTS idx_loot_events_loot_id ON loot_events(loot_id);
CREATE INDEX IF NOT EXISTS idx_loot_events_action ON loot_events(action);

-- ============================================
-- 8. WAVE EVENTS - Události vln nepřátel
-- ============================================
CREATE TABLE IF NOT EXISTS wave_events (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) REFERENCES game_sessions(session_id) ON DELETE CASCADE,
    
    -- Wave info
    wave_number INTEGER,
    wave_difficulty VARCHAR(50),
    spawn_table_id VARCHAR(100),
    
    -- Statistiky
    enemies_spawned INTEGER,
    enemies_killed INTEGER,
    wave_duration_ms INTEGER,
    
    -- Výsledek
    completed BOOLEAN DEFAULT FALSE,
    player_hp_start INTEGER,
    player_hp_end INTEGER,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexy pro wave_events
CREATE INDEX IF NOT EXISTS idx_wave_events_session_id ON wave_events(session_id);
CREATE INDEX IF NOT EXISTS idx_wave_events_wave_number ON wave_events(wave_number);

-- ============================================
-- VIEWS pro snadnější analýzu
-- ============================================

-- Přehled session s vypočítanými metrikami
CREATE OR REPLACE VIEW session_summary AS
SELECT 
    session_id,
    player_name,
    game_version,
    started_at,
    ended_at,
    duration_seconds,
    level_reached,
    score,
    enemies_killed,
    death_cause,
    fps_average,
    CASE 
        WHEN duration_seconds < 60 THEN 'very_short'
        WHEN duration_seconds < 300 THEN 'short'
        WHEN duration_seconds < 900 THEN 'medium'
        WHEN duration_seconds < 1800 THEN 'long'
        ELSE 'very_long'
    END as session_length_category
FROM game_sessions;

-- Nejčastější příčiny smrti
CREATE OR REPLACE VIEW death_causes_summary AS
SELECT 
    killer_type,
    COUNT(*) as death_count,
    AVG(survival_time) as avg_survival_time,
    AVG(level) as avg_player_level,
    AVG(overkill_damage) as avg_overkill
FROM death_events
GROUP BY killer_type
ORDER BY death_count DESC;

-- Performance problémy
CREATE OR REPLACE VIEW performance_issues AS
SELECT 
    session_id,
    COUNT(*) as low_fps_events,
    MIN(fps_min) as worst_fps,
    AVG(fps_average) as avg_fps
FROM performance_metrics
WHERE fps_average < 30 OR snapshot_type = 'low_fps'
GROUP BY session_id;

-- ============================================
-- RLS (Row Level Security) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE high_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE enemy_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE death_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE powerup_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE boss_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE loot_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE wave_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies pro high_scores
CREATE POLICY "Public can read high scores" ON high_scores
  FOR SELECT USING (true);

CREATE POLICY "Public can insert high scores" ON high_scores
  FOR INSERT WITH CHECK (
    LENGTH(name) <= 12 AND
    LENGTH(name) >= 1 AND
    score >= 0 AND 
    score <= 999999999 AND
    level >= 1 AND
    level <= 999 AND
    enemies_killed >= 0 AND
    play_time >= 0 AND
    bosses_defeated >= 0
  );

-- Allow anonymous inserts (for analytics)
CREATE POLICY "Anyone can insert analytics" ON game_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert enemy stats" ON enemy_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert performance metrics" ON performance_metrics FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert death events" ON death_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert powerup events" ON powerup_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert boss events" ON boss_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert loot events" ON loot_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert wave events" ON wave_events FOR INSERT WITH CHECK (true);

-- Allow anonymous updates on game_sessions (for session end)
CREATE POLICY "Anyone can update analytics" ON game_sessions FOR UPDATE USING (true);

-- Allow public reads for leaderboards/stats
CREATE POLICY "Public can read sessions" ON game_sessions FOR SELECT USING (true);

-- Authenticated reads for other analytics tables
CREATE POLICY "Authenticated can read enemy stats" ON enemy_stats
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can read powerup events" ON powerup_events
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can read death events" ON death_events
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can read boss events" ON boss_events
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can read performance metrics" ON performance_metrics
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can read loot events" ON loot_events
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can read wave events" ON wave_events
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================

-- Přidání foreign key constraints s ON DELETE CASCADE
ALTER TABLE enemy_stats 
ADD CONSTRAINT fk_enemy_session 
FOREIGN KEY (session_id) REFERENCES game_sessions(session_id) ON DELETE CASCADE;

ALTER TABLE powerup_events 
ADD CONSTRAINT fk_powerup_session 
FOREIGN KEY (session_id) REFERENCES game_sessions(session_id) ON DELETE CASCADE;

ALTER TABLE death_events 
ADD CONSTRAINT fk_death_session 
FOREIGN KEY (session_id) REFERENCES game_sessions(session_id) ON DELETE CASCADE;

ALTER TABLE boss_events 
ADD CONSTRAINT fk_boss_session 
FOREIGN KEY (session_id) REFERENCES game_sessions(session_id) ON DELETE CASCADE;

ALTER TABLE performance_metrics 
ADD CONSTRAINT fk_perf_session 
FOREIGN KEY (session_id) REFERENCES game_sessions(session_id) ON DELETE CASCADE;

ALTER TABLE loot_events 
ADD CONSTRAINT fk_loot_session 
FOREIGN KEY (session_id) REFERENCES game_sessions(session_id) ON DELETE CASCADE;

ALTER TABLE wave_events 
ADD CONSTRAINT fk_wave_session 
FOREIGN KEY (session_id) REFERENCES game_sessions(session_id) ON DELETE CASCADE;

-- ============================================
-- DAILY STATS TABLE (pro agregované statistiky)
-- ============================================

CREATE TABLE IF NOT EXISTS daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  
  -- Základní metriky
  total_sessions INTEGER DEFAULT 0,
  unique_players INTEGER DEFAULT 0,
  total_playtime_minutes INTEGER DEFAULT 0,
  
  -- Průměry
  avg_session_length INTEGER,
  avg_score INTEGER,
  avg_level_reached DECIMAL(5,2),
  
  -- Top stats
  highest_score INTEGER,
  highest_level INTEGER,
  most_killed_enemy VARCHAR(50),
  most_deadly_enemy VARCHAR(50),
  most_picked_powerup VARCHAR(50),
  
  -- Completion rates
  boss1_defeat_rate DECIMAL(5,2),
  boss2_defeat_rate DECIMAL(5,2),
  level10_reach_rate DECIMAL(5,2),
  level20_reach_rate DECIMAL(5,2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pro daily_stats
CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_stats(date DESC);

-- RLS pro daily_stats
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read daily stats" ON daily_stats
  FOR SELECT USING (true);

-- ============================================
-- Helper functions
-- ============================================

-- Funkce pro výpočet session statistik
CREATE OR REPLACE FUNCTION calculate_session_stats(p_session_id VARCHAR)
RETURNS TABLE (
    total_damage_dealt INTEGER,
    total_damage_taken INTEGER,
    unique_enemies_encountered INTEGER,
    power_ups_collected INTEGER,
    boss_fights INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(es.damage_taken_from_player), 0)::INTEGER as total_damage_dealt,
        COALESCE(SUM(es.damage_dealt_to_player), 0)::INTEGER as total_damage_taken,
        COUNT(DISTINCT es.enemy_type)::INTEGER as unique_enemies_encountered,
        COUNT(DISTINCT pe.id)::INTEGER as power_ups_collected,
        COUNT(DISTINCT be.id)::INTEGER as boss_fights
    FROM game_sessions gs
    LEFT JOIN enemy_stats es ON gs.session_id = es.session_id
    LEFT JOIN powerup_events pe ON gs.session_id = pe.session_id
    LEFT JOIN boss_events be ON gs.session_id = be.session_id
    WHERE gs.session_id = p_session_id
    GROUP BY gs.session_id;
END;
$$ LANGUAGE plpgsql;

-- Funkce pro získání TOP 10 scores
CREATE OR REPLACE FUNCTION get_top_10_scores()
RETURNS TABLE (
  name VARCHAR,
  score INTEGER,
  level INTEGER,
  enemies_killed INTEGER,
  play_time INTEGER,
  bosses_defeated INTEGER,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    hs.name,
    hs.score,
    hs.level,
    hs.enemies_killed,
    hs.play_time,
    hs.bosses_defeated,
    hs.created_at
  FROM high_scores hs
  ORDER BY hs.score DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Funkce pro kontrolu, zda je skóre v TOP 10
CREATE OR REPLACE FUNCTION is_high_score(check_score INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  tenth_score INTEGER;
  score_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO score_count FROM high_scores;
  
  IF score_count < 10 THEN
    RETURN TRUE;
  END IF;
  
  SELECT score INTO tenth_score
  FROM high_scores
  ORDER BY score DESC
  LIMIT 1 OFFSET 9;
  
  RETURN check_score > tenth_score;
END;
$$ LANGUAGE plpgsql;

-- Funkce pro získání zajímavých statistik
CREATE OR REPLACE FUNCTION get_game_insights()
RETURNS TABLE (
  metric_name VARCHAR,
  metric_value TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'Total Games Played', COUNT(*)::TEXT FROM game_sessions
  UNION ALL
  SELECT 'Average Score', ROUND(AVG(final_score))::TEXT FROM game_sessions
  UNION ALL
  SELECT 'Highest Score Ever', MAX(final_score)::TEXT FROM game_sessions
  UNION ALL
  SELECT 'Most Deadly Enemy', 
    (SELECT killer_type FROM death_events 
     GROUP BY killer_type 
     ORDER BY COUNT(*) DESC 
     LIMIT 1)
  UNION ALL
  SELECT 'Most Popular Powerup',
    (SELECT powerup_id FROM powerup_events 
     GROUP BY powerup_id 
     ORDER BY COUNT(*) DESC 
     LIMIT 1)
  UNION ALL
  SELECT 'Average Survival Time',
    (SELECT ROUND(AVG(duration_seconds)/60)::TEXT || ' minutes' 
     FROM game_sessions WHERE duration_seconds IS NOT NULL);
END;
$$ LANGUAGE plpgsql;

-- Placeholder pro update_daily_stats (mělo by běžet jako scheduled job)
CREATE OR REPLACE FUNCTION update_daily_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Toto by mělo běžet jako scheduled job, ne trigger
  -- Pro jednoduchost zatím prázdné
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- KOMENTÁŘE
-- ============================================

COMMENT ON TABLE game_sessions IS 'Hlavní tabulka pro tracking herních sessions';
COMMENT ON TABLE enemy_stats IS 'Detailní statistiky nepřátel per session';
COMMENT ON TABLE powerup_events IS 'Tracking výběru a použití power-upů';
COMMENT ON TABLE death_events IS 'Detailní informace o každé smrti hráče';
COMMENT ON TABLE boss_events IS 'Speciální tracking pro boss fights';
COMMENT ON TABLE performance_metrics IS 'Technické metriky výkonu';
COMMENT ON TABLE loot_events IS 'Tracking dropů a collectibles';
COMMENT ON TABLE wave_events IS 'Statistiky jednotlivých vln';
COMMENT ON TABLE daily_stats IS 'Agregované denní statistiky';
COMMENT ON TABLE high_scores IS 'Tabulka nejvyšších skóre';
COMMENT ON COLUMN game_sessions.duration_seconds IS 'Automaticky vypočítaná délka hry v sekundách';

-- ============================================
-- KONEC SCHÉMATU
-- ============================================