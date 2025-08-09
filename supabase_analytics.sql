-- Analytics System pro Rakovinobijec
-- Comprehensive game telemetry and analytics

-- 1. GAME SESSIONS - Hlavní tabulka pro každou hru
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(36) NOT NULL UNIQUE,
  player_name VARCHAR(12),
  
  -- Časové údaje
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration INTEGER, -- v sekundách
  
  -- Výsledky
  final_score INTEGER DEFAULT 0,
  final_level INTEGER DEFAULT 1,
  death_cause VARCHAR(50),
  death_position_x INTEGER,
  death_position_y INTEGER,
  
  -- Statistiky
  total_damage_dealt INTEGER DEFAULT 0,
  total_damage_taken INTEGER DEFAULT 0,
  enemies_killed INTEGER DEFAULT 0,
  bosses_defeated TEXT[] DEFAULT '{}',
  xp_collected INTEGER DEFAULT 0,
  health_pickups INTEGER DEFAULT 0,
  power_ups_collected INTEGER DEFAULT 0,
  
  -- Device info
  browser VARCHAR(100),
  user_agent TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  fps_average DECIMAL(5,2),
  connection_type VARCHAR(20), -- 'supabase' nebo 'local'
  
  -- Meta
  game_version VARCHAR(10) DEFAULT '0.1.1',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ENEMY STATISTICS - Detailní stats per enemy type per session
CREATE TABLE IF NOT EXISTS enemy_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(36) NOT NULL,
  
  enemy_type VARCHAR(20) NOT NULL, -- 'red', 'green', 'elite:purple', etc.
  enemy_level INTEGER, -- Na jakém levelu se objevil
  
  -- Statistiky
  spawn_count INTEGER DEFAULT 0,
  killed_count INTEGER DEFAULT 0,
  damage_dealt_to_player INTEGER DEFAULT 0,
  damage_taken_from_player INTEGER DEFAULT 0,
  player_deaths_caused INTEGER DEFAULT 0, -- Kolikrát zabil hráče
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. POWER-UP EVENTS - Tracking výběru a použití power-upů
CREATE TABLE IF NOT EXISTS powerup_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(36) NOT NULL,
  
  event_type VARCHAR(20) NOT NULL, -- 'offered', 'selected', 'upgraded'
  powerup_name VARCHAR(30) NOT NULL,
  level_selected INTEGER,
  current_tier INTEGER DEFAULT 1,
  
  -- Context
  options_offered TEXT[], -- Jaké byly ostatní možnosti
  player_hp_at_selection INTEGER,
  enemies_on_screen INTEGER,
  
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. DEATH EVENTS - Detailní info o každé smrti
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

-- 5. BOSS ENCOUNTERS - Speciální tracking pro boss fights
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

-- 6. PERFORMANCE METRICS - Technické metriky
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(36) NOT NULL,
  
  -- FPS tracking
  fps_min DECIMAL(5,2),
  fps_max DECIMAL(5,2),
  fps_average DECIMAL(5,2),
  fps_drops INTEGER DEFAULT 0, -- Počet poklesů pod 30 FPS
  
  -- Memory (pokud dostupné)
  memory_used_mb INTEGER,
  memory_limit_mb INTEGER,
  
  -- Latency (pro online features)
  api_latency_ms INTEGER,
  supabase_available BOOLEAN DEFAULT TRUE,
  
  -- Errors
  error_count INTEGER DEFAULT 0,
  error_types TEXT[],
  
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. AGGREGATE DAILY STATS - Denní souhrny pro rychlé dashboardy
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

-- RLS Policies pro bezpečnost
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE enemy_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE powerup_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE death_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE boss_encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

-- Povolit INSERT pro všechny (hra může zapisovat)
CREATE POLICY "Anyone can insert analytics" ON game_sessions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert enemy stats" ON enemy_stats
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert powerup events" ON powerup_events
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert death events" ON death_events
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert boss encounters" ON boss_encounters
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert performance metrics" ON performance_metrics
  FOR INSERT WITH CHECK (true);

-- SELECT pouze pro authenticated users (pro dashboard)
CREATE POLICY "Authenticated can read analytics" ON game_sessions
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can read enemy stats" ON enemy_stats
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can read powerup events" ON powerup_events
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can read death events" ON death_events
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can read boss encounters" ON boss_encounters
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can read performance metrics" ON performance_metrics
  FOR SELECT USING (auth.role() = 'authenticated');

-- Daily stats může číst kdokoliv (public stats)
CREATE POLICY "Anyone can read daily stats" ON daily_stats
  FOR SELECT USING (true);

-- Vytvoření indexů pro rychlejší dotazy
CREATE INDEX IF NOT EXISTS idx_sessions_player ON game_sessions(player_name);
CREATE INDEX IF NOT EXISTS idx_sessions_score ON game_sessions(final_score DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON game_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enemy_session ON enemy_stats(session_id);
CREATE INDEX IF NOT EXISTS idx_enemy_type ON enemy_stats(enemy_type);

CREATE INDEX IF NOT EXISTS idx_powerup_session ON powerup_events(session_id);
CREATE INDEX IF NOT EXISTS idx_powerup_name ON powerup_events(powerup_name);

CREATE INDEX IF NOT EXISTS idx_death_session ON death_events(session_id);
CREATE INDEX IF NOT EXISTS idx_death_killer ON death_events(killer_type);
CREATE INDEX IF NOT EXISTS idx_death_level ON death_events(level);

CREATE INDEX IF NOT EXISTS idx_boss_session ON boss_encounters(session_id);
CREATE INDEX IF NOT EXISTS idx_boss_name ON boss_encounters(boss_name);

CREATE INDEX IF NOT EXISTS idx_perf_session ON performance_metrics(session_id);

CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_stats(date DESC);

-- Přidání foreign key constraints
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

ALTER TABLE performance_metrics 
ADD CONSTRAINT fk_perf_session 
FOREIGN KEY (session_id) REFERENCES game_sessions(session_id) ON DELETE CASCADE;

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
    (SELECT ROUND(AVG(duration)/60)::TEXT || ' minutes' FROM game_sessions WHERE duration IS NOT NULL);
END;
$$ LANGUAGE plpgsql;

-- Trigger pro automatické vypočítání daily stats
CREATE OR REPLACE FUNCTION update_daily_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Toto by mělo běžet jako scheduled job, ne trigger
  -- Ale pro jednoduchost...
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE game_sessions IS 'Hlavní tabulka pro tracking herních sessions';
COMMENT ON TABLE enemy_stats IS 'Detailní statistiky nepřátel per session';
COMMENT ON TABLE powerup_events IS 'Tracking výběru a použití power-upů';
COMMENT ON TABLE death_events IS 'Detailní informace o každé smrti hráče';
COMMENT ON TABLE boss_encounters IS 'Speciální tracking pro boss fights';
COMMENT ON TABLE performance_metrics IS 'Technické metriky výkonu';
COMMENT ON TABLE daily_stats IS 'Agregované denní statistiky';