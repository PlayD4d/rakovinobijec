-- Vytvoření tabulky pro high scores
CREATE TABLE IF NOT EXISTS high_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(12) NOT NULL,
  score INTEGER NOT NULL,
  level INTEGER NOT NULL,
  enemies_killed INTEGER NOT NULL,
  play_time INTEGER NOT NULL,
  bosses_defeated INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version VARCHAR(10) DEFAULT '0.1.1'
);

-- Index pro rychlé řazení podle skóre
CREATE INDEX IF NOT EXISTS idx_high_scores_score ON high_scores(score DESC);

-- Povolit Row Level Security
ALTER TABLE high_scores ENABLE ROW LEVEL SECURITY;

-- Policy pro čtení - všichni můžou číst high scores
CREATE POLICY "Public can read high scores" ON high_scores
  FOR SELECT USING (true);

-- Policy pro vkládání - všichni můžou vložit, ale s validací
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