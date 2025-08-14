-- ============================================
-- KOMPLETNÍ DATABÁZOVÉ SCHÉMA PRO RAKOVINOBIJEC
-- ============================================
-- Verze: 0.3.0
-- Datum: 2024
-- Kompatibilní s PR7 architekturou
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
-- 2. GAME SESSIONS - Hlavní tabulka pro každou hru
-- ============================================
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(36) NOT NULL UNIQUE,
  player_name VARCHAR(12),
  
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
  
  -- Výsledky (kompatibilní s původním schématem)
  final_score INTEGER DEFAULT 0,
  final_level INTEGER DEFAULT 1,
  level_reached INTEGER DEFAULT 1, -- Alias pro final_level
  death_cause VARCHAR(50),
  death_position_x INTEGER,
  death_position_y INTEGER,
  
  -- Core statistiky (používané v kódu)
  score INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  enemies_killed INTEGER DEFAULT 0,
  xp_collected INTEGER DEFAULT 0,
  
  -- Damage statistiky
  total_damage_dealt INTEGER DEFAULT 0,
  total_damage_taken INTEGER DEFAULT 0,
  
  -- Pickups a collectibles
  health_pickups INTEGER DEFAULT 0,
  power_ups_collected INTEGER DEFAULT 0,
  bosses_defeated TEXT[] DEFAULT '{}',
  
  -- Device info
  browser VARCHAR(100),
  user_agent TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  fps_average DECIMAL(5,2),
  connection_type VARCHAR(20), -- 'supabase' nebo 'local'
  
  -- Meta
  game_version VARCHAR(10) DEFAULT '0.3.0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ENEMY STATISTICS - Detailní stats per enemy type per session
-- ============================================
CREATE TABLE IF NOT EXISTS enemy_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(36) NOT NULL,
  
  enemy_type VARCHAR(50) NOT NULL, -- Sanitizovaný typ nepřítele
  enemy_level INTEGER, -- Na jakém levelu se objevil
  
  -- Statistiky
  spawn_count INTEGER DEFAULT 0,
  killed_count INTEGER DEFAULT 0,
  damage_dealt_to_player INTEGER DEFAULT 0,
  damage_taken_from_player INTEGER DEFAULT 0,
  player_deaths_caused INTEGER DEFAULT 0, -- Kolikrát zabil hráče
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. POWER-UP EVENTS - Tracking výběru a použití power-upů
-- ============================================
CREATE TABLE IF NOT EXISTS powerup_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(36) NOT NULL,
  
  event_type VARCHAR(20) NOT NULL, -- 'offered', 'selected', 'upgraded'
  powerup_name VARCHAR(30) NOT NULL,
  powerup_id VARCHAR(50), -- ID z blueprintu
  level_selected INTEGER,
  current_tier INTEGER DEFAULT 1,
  powerup_level INTEGER DEFAULT 1, -- Alias pro current_tier
  
  -- Context
  options_offered TEXT[], -- Jaké byly ostatní možnosti
  choices_offered TEXT[], -- Alias pro options_offered
  player_hp_at_selection INTEGER,
  enemies_on_screen INTEGER,
  
  -- Výběr
  choice_index INTEGER, -- Kterou možnost hráč vybral
  time_to_choose_ms INTEGER, -- Jak dlouho trvalo rozhodnout se
  
  -- Pozice a čas
  player_level INTEGER,
  game_time_ms INTEGER,
  position_x INTEGER,
  position_y INTEGER,
  
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. DEATH EVENTS - Detailní info o každé smrti
-- ============================================
CREATE TABLE IF NOT EXISTS death_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(36) NOT NULL,
  
  player_name VARCHAR(12),
  level INTEGER NOT NULL,
  score INTEGER NOT NULL,
  survival_time INTEGER, -- sekundy
  
  -- Killer info
  killer_type VARCHAR(50) NOT NULL, -- 'enemy:green', 'boss:metastaza', 'projectile:homing'
  killer_damage INTEGER,
  overkill_damage INTEGER, -- O kolik víc damage než měl hráč HP
  
  -- Player state
  player_hp_before INTEGER,
  player_max_hp INTEGER,
  position_x INTEGER,
  position_y INTEGER,
  active_power_ups TEXT[], -- Seznam aktivních power-upů
  
  -- Context
  enemies_on_screen INTEGER,
  projectiles_on_screen INTEGER,
  was_boss_fight BOOLEAN DEFAULT FALSE,
  
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. BOSS ENCOUNTERS - Speciální tracking pro boss fights
-- ============================================
CREATE TABLE IF NOT EXISTS boss_encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(36) NOT NULL,
  
  boss_name VARCHAR(50) NOT NULL,
  boss_level INTEGER NOT NULL,
  
  -- Výsledek
  defeated BOOLEAN DEFAULT FALSE,
  fight_duration INTEGER, -- sekundy
  
  -- Statistiky
  damage_dealt_to_boss INTEGER DEFAULT 0,
  damage_taken_from_boss INTEGER DEFAULT 0,
  player_hp_start INTEGER,
  player_hp_end INTEGER,
  special_attacks_used INTEGER DEFAULT 0,
  
  -- Death info (pokud hráč zemřel)
  death_by_special BOOLEAN DEFAULT FALSE,
  death_phase INTEGER, -- Ve které fázi boss fightu
  
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6b. BOSS EVENTS (alternativní tabulka pro kompatibilitu)
-- ============================================
CREATE TABLE IF NOT EXISTS boss_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(36) NOT NULL,
  
  boss_id VARCHAR(50), -- ID bossu
  boss_type VARCHAR(50), -- Typ bossu
  boss_level INTEGER DEFAULT 1,
  
  -- Event info
  event_type VARCHAR(20), -- 'spawned', 'damaged', 'defeated', 'killed_player'
  result VARCHAR(20), -- 'victory', 'defeat', 'timeout'
  
  -- Statistiky
  boss_hp INTEGER,
  player_hp INTEGER,
  damage_dealt INTEGER,
  damage_taken INTEGER,
  fight_duration_ms INTEGER,
  
  -- Kontext
  player_level INTEGER,
  player_hp_start INTEGER,
  player_hp_end INTEGER,
  game_time_ms INTEGER,
  projectiles_fired INTEGER,
  powerups_used TEXT[],
  
  -- Pozice
  level INTEGER,
  
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. PERFORMANCE METRICS - Technické metriky
-- ============================================
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(36) NOT NULL,
  
  -- FPS tracking
  fps_min DECIMAL(5,2),
  fps_max DECIMAL(5,2),
  fps_average DECIMAL(5,2),
  fps_current DECIMAL(5,2), -- Pro snapshoty
  fps_drops INTEGER DEFAULT 0, -- Počet poklesů pod 30 FPS
  
  -- Memory (pokud dostupné)
  memory_used_mb INTEGER,
  memory_limit_mb INTEGER,
  memory_percent FLOAT,
  
  -- Entity counts
  entities_count INTEGER,
  enemy_count INTEGER, -- Alias pro entities_count
  projectiles_count INTEGER,
  projectile_count INTEGER, -- Alias pro projectiles_count
  particles_count INTEGER,
  particle_count INTEGER, -- Alias pro particles_count
  
  -- Snapshot info
  snapshot_type VARCHAR(50), -- 'regular', 'low_fps', 'error', 'boss_fight'
  
  -- Časové info
  time_since_start_ms INTEGER,
  
  -- Latency (pro online features)
  api_latency_ms INTEGER,
  supabase_available BOOLEAN DEFAULT TRUE,
  
  -- Errors
  error_count INTEGER DEFAULT 0,
  error_types TEXT[],
  
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. LOOT EVENTS - Tracking dropů a lootů
-- ============================================
CREATE TABLE IF NOT EXISTS loot_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(36) NOT NULL,
  
  -- Loot info
  loot_id VARCHAR(100),
  loot_type VARCHAR(50) NOT NULL,
  loot_source VARCHAR(100), -- enemy ID nebo 'chest', 'boss', etc.
  source VARCHAR(50), -- Alias pro loot_source
  
  -- Akce
  action VARCHAR(20), -- 'dropped', 'collected', 'expired'
  collected BOOLEAN DEFAULT FALSE,
  value INTEGER, -- XP hodnota, heal amount, atd.
  
  -- Kontext
  level INTEGER,
  position_x INTEGER,
  position_y INTEGER,
  game_time_ms INTEGER,
  player_level INTEGER,
  
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. WAVE EVENTS - Události vln nepřátel
-- ============================================
CREATE TABLE IF NOT EXISTS wave_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(36) NOT NULL,
  
  -- Wave info
  wave_number INTEGER NOT NULL,
  wave_difficulty VARCHAR(50),
  spawn_table_id VARCHAR(100),
  
  -- Statistiky
  enemies_spawned INTEGER,
  enemies_killed INTEGER,
  wave_duration_ms INTEGER,
  duration_seconds INTEGER, -- Alias pro wave_duration_ms / 1000
  
  -- Výsledek
  completed BOOLEAN DEFAULT FALSE,
  player_hp_start INTEGER,
  player_hp_end INTEGER,
  powerups_used TEXT[],
  
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. DAILY STATS - Denní souhrny pro rychlé dashboardy
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
  most_killed_enemy VARCHAR(20),
  most_deadly_enemy VARCHAR(20),
  most_picked_powerup VARCHAR(30),
  
  -- Completion rates
  boss1_defeat_rate DECIMAL(5,2),
  boss2_defeat_rate DECIMAL(5,2),
  level10_reach_rate DECIMAL(5,2),
  level20_reach_rate DECIMAL(5,2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXY PRO VÝKON
-- ============================================

-- High scores
CREATE INDEX IF NOT EXISTS idx_high_scores_score ON high_scores(score DESC);

-- Game sessions
CREATE INDEX IF NOT EXISTS idx_sessions_player ON game_sessions(player_name);
CREATE INDEX IF NOT EXISTS idx_sessions_score ON game_sessions(final_score DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON game_sessions(created_at DESC);

-- Enemy stats
CREATE INDEX IF NOT EXISTS idx_enemy_session ON enemy_stats(session_id);
CREATE INDEX IF NOT EXISTS idx_enemy_type ON enemy_stats(enemy_type);

-- Powerup events
CREATE INDEX IF NOT EXISTS idx_powerup_session ON powerup_events(session_id);
CREATE INDEX IF NOT EXISTS idx_powerup_name ON powerup_events(powerup_name);

-- Death events
CREATE INDEX IF NOT EXISTS idx_death_session ON death_events(session_id);
CREATE INDEX IF NOT EXISTS idx_death_killer ON death_events(killer_type);
CREATE INDEX IF NOT EXISTS idx_death_level ON death_events(level);

-- Boss encounters
CREATE INDEX IF NOT EXISTS idx_boss_session ON boss_encounters(session_id);
CREATE INDEX IF NOT EXISTS idx_boss_name ON boss_encounters(boss_name);

-- Boss events
CREATE INDEX IF NOT EXISTS idx_boss_events_session ON boss_events(session_id);
CREATE INDEX IF NOT EXISTS idx_boss_events_boss_id ON boss_events(boss_id);
CREATE INDEX IF NOT EXISTS idx_boss_events_result ON boss_events(result);

-- Performance metrics
CREATE INDEX IF NOT EXISTS idx_perf_session ON performance_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_perf_snapshot ON performance_metrics(snapshot_type);

-- Loot events
CREATE INDEX IF NOT EXISTS idx_loot_events_session ON loot_events(session_id);
CREATE INDEX IF NOT EXISTS idx_loot_events_loot_id ON loot_events(loot_id);
CREATE INDEX IF NOT EXISTS idx_loot_events_action ON loot_events(action);

-- Wave events
CREATE INDEX IF NOT EXISTS idx_wave_events_session ON wave_events(session_id);
CREATE INDEX IF NOT EXISTS idx_wave_events_wave_number ON wave_events(wave_number);

-- Daily stats
CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_stats(date DESC);

-- ============================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================

ALTER TABLE enemy_stats 
ADD CONSTRAINT fk_enemy_session 
FOREIGN KEY (session_id) REFERENCES game_sessions(session_id) ON DELETE CASCADE;

ALTER TABLE powerup_events 
ADD CONSTRAINT fk_powerup_session 
FOREIGN KEY (session_id) REFERENCES game_sessions(session_id) ON DELETE CASCADE;

ALTER TABLE death_events 
ADD CONSTRAINT fk_death_session 
FOREIGN KEY (session_id) REFERENCES game_sessions(session_id) ON DELETE CASCADE;

ALTER TABLE boss_encounters 
ADD CONSTRAINT fk_boss_session 
FOREIGN KEY (session_id) REFERENCES game_sessions(session_id) ON DELETE CASCADE;

ALTER TABLE boss_events 
ADD CONSTRAINT fk_boss_events_session 
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
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE high_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE enemy_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE powerup_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE death_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE boss_encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE boss_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE loot_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE wave_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

-- High scores policies
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

-- Game sessions policies
CREATE POLICY "Anyone can insert analytics" ON game_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update analytics" ON game_sessions
  FOR UPDATE USING (true);

CREATE POLICY "Authenticated can read analytics" ON game_sessions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Public can read sessions" ON game_sessions
  FOR SELECT USING (true);

-- Analytics tables - INSERT pro všechny
CREATE POLICY "Anyone can insert enemy stats" ON enemy_stats
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can insert powerup events" ON powerup_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can insert death events" ON death_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can insert boss encounters" ON boss_encounters
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can insert boss events" ON boss_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can insert performance metrics" ON performance_metrics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can insert loot events" ON loot_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can insert wave events" ON wave_events
  FOR INSERT WITH CHECK (true);

-- Analytics tables - SELECT pro authenticated users
CREATE POLICY "Authenticated can read enemy stats" ON enemy_stats
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can read powerup events" ON powerup_events
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can read death events" ON death_events
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can read boss encounters" ON boss_encounters
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can read boss events" ON boss_events
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can read performance metrics" ON performance_metrics
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can read loot events" ON loot_events
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can read wave events" ON wave_events
  FOR SELECT USING (auth.role() = 'authenticated');

-- Daily stats - public read
CREATE POLICY "Anyone can read daily stats" ON daily_stats
  FOR SELECT USING (true);

-- ============================================
-- VIEWS PRO ANALÝZU
-- ============================================

-- Souhrn sessions
CREATE OR REPLACE VIEW session_summary AS
SELECT 
  s.session_id,
  s.player_name,
  s.score,
  s.level_reached,
  s.enemies_killed,
  s.duration_seconds,
  s.death_cause,
  s.game_version,
  s.started_at,
  COUNT(DISTINCT e.enemy_type) as unique_enemies_faced,
  COUNT(DISTINCT p.powerup_name) as unique_powerups_collected
FROM game_sessions s
LEFT JOIN enemy_stats e ON s.session_id = e.session_id
LEFT JOIN powerup_events p ON s.session_id = p.session_id AND p.event_type = 'selected'
GROUP BY s.session_id, s.player_name, s.score, s.level_reached, 
         s.enemies_killed, s.duration_seconds, s.death_cause, 
         s.game_version, s.started_at;

-- Nejčastější příčiny smrti
CREATE OR REPLACE VIEW death_causes_summary AS
SELECT 
  death_cause,
  COUNT(*) as death_count,
  AVG(level_reached) as avg_level,
  AVG(score) as avg_score,
  AVG(duration_seconds) as avg_duration
FROM game_sessions
WHERE death_cause IS NOT NULL
GROUP BY death_cause
ORDER BY death_count DESC;

-- Sessions s problémy s výkonem
CREATE OR REPLACE VIEW performance_issues AS
SELECT 
  s.session_id,
  s.player_name,
  s.game_version,
  AVG(p.fps_average) as avg_fps,
  MIN(p.fps_min) as worst_fps,
  MAX(p.fps_drops) as max_fps_drops,
  s.started_at
FROM game_sessions s
JOIN performance_metrics p ON s.session_id = p.session_id
GROUP BY s.session_id, s.player_name, s.game_version, s.started_at
HAVING AVG(p.fps_average) < 45 OR MIN(p.fps_min) < 20;

-- ============================================
-- HELPER FUNKCE
-- ============================================

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

-- Funkce pro získání statistik session
CREATE OR REPLACE FUNCTION calculate_session_stats(p_session_id VARCHAR)
RETURNS TABLE (
  total_enemies_killed INTEGER,
  total_damage_dealt INTEGER,
  total_damage_taken INTEGER,
  unique_enemies INTEGER,
  unique_powerups INTEGER,
  boss_fights INTEGER,
  performance_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(e.killed_count), 0)::INTEGER as total_enemies_killed,
    COALESCE(SUM(e.damage_taken_from_player), 0)::INTEGER as total_damage_dealt,
    COALESCE(SUM(e.damage_dealt_to_player), 0)::INTEGER as total_damage_taken,
    COUNT(DISTINCT e.enemy_type)::INTEGER as unique_enemies,
    COUNT(DISTINCT p.powerup_name)::INTEGER as unique_powerups,
    COUNT(DISTINCT b.boss_name)::INTEGER as boss_fights,
    COALESCE(AVG(pm.fps_average), 60)::DECIMAL as performance_score
  FROM game_sessions s
  LEFT JOIN enemy_stats e ON s.session_id = e.session_id
  LEFT JOIN powerup_events p ON s.session_id = p.session_id AND p.event_type = 'selected'
  LEFT JOIN boss_encounters b ON s.session_id = b.session_id
  LEFT JOIN performance_metrics pm ON s.session_id = pm.session_id
  WHERE s.session_id = p_session_id
  GROUP BY s.session_id;
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
    (SELECT powerup_name FROM powerup_events 
     WHERE event_type = 'selected'
     GROUP BY powerup_name 
     ORDER BY COUNT(*) DESC 
     LIMIT 1)
  UNION ALL
  SELECT 'Average Survival Time',
    (SELECT ROUND(AVG(duration_seconds)/60)::TEXT || ' minutes' 
     FROM game_sessions WHERE duration_seconds IS NOT NULL);
END;
$$ LANGUAGE plpgsql;

-- Funkce pro automatické vypočítání daily stats (z původního schématu)
CREATE OR REPLACE FUNCTION update_daily_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Toto by mělo běžet jako scheduled job, ne trigger
  -- Ale pro jednoduchost...
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- KOMENTÁŘE
-- ============================================

COMMENT ON TABLE high_scores IS 'Tabulka pro globální high scores';
COMMENT ON TABLE game_sessions IS 'Hlavní tabulka pro tracking herních sessions';
COMMENT ON TABLE enemy_stats IS 'Detailní statistiky nepřátel per session';
COMMENT ON TABLE powerup_events IS 'Tracking výběru a použití power-upů';
COMMENT ON TABLE death_events IS 'Detailní informace o každé smrti hráče';
COMMENT ON TABLE boss_encounters IS 'Speciální tracking pro boss fights';
COMMENT ON TABLE boss_events IS 'Alternativní tracking pro boss eventy';
COMMENT ON TABLE performance_metrics IS 'Technické metriky výkonu';
COMMENT ON TABLE loot_events IS 'Tracking dropů a collectibles';
COMMENT ON TABLE wave_events IS 'Statistiky jednotlivých vln';
COMMENT ON TABLE daily_stats IS 'Agregované denní statistiky';
COMMENT ON COLUMN game_sessions.duration_seconds IS 'Automaticky vypočítaná délka hry v sekundách (GENERATED)';

-- ============================================
-- KONEC SCHÉMATU
-- ============================================
-- Po spuštění tohoto skriptu budete mít kompletní databázi
-- připravenou pro Rakovinobijec s plnou podporou analytiky
-- ============================================