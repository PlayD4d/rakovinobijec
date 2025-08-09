# 📊 Game Analytics System - Design Document

## 🎯 Cíle systému

1. **Balancování hry** - identifikovat problematické části
2. **Pochopení hráčů** - jak hrají, kde umírají, co používají
3. **Technické metriky** - výkon, chyby, device info
4. **Engagement metriky** - retention, session length

## 📈 Kategorie metrik

### 1️⃣ Session Metriky (každá hra)
```javascript
{
  session_id: UUID,
  player_id: string,          // Anonymous ID nebo jméno
  start_time: timestamp,
  end_time: timestamp,
  duration: seconds,
  
  // Výsledek
  final_score: number,
  final_level: number,
  death_cause: string,        // "enemy:green", "boss:metastaza", "projectile"
  death_position: {x, y},
  
  // Souhrny
  total_damage_dealt: number,
  total_damage_taken: number,
  enemies_killed: number,
  bosses_defeated: array,     // ["boss1", "boss2"]
  xp_collected: number,
  health_pickups: number,
  
  // Device info
  browser: string,
  screen_resolution: string,
  fps_average: number,
  lag_spikes: number
}
```

### 2️⃣ Enemy Statistiky
```javascript
{
  enemy_type: string,         // "red", "green", "elite:purple"
  kills_by_enemy: number,     // Kolikrát zabil hráče
  killed_count: number,       // Kolikrát byl zabit
  average_lifetime: seconds,
  damage_dealt_total: number,
  damage_taken_total: number,
  spawn_level: number
}
```

### 3️⃣ Power-up Analytics
```javascript
{
  powerup_name: string,
  times_selected: number,
  times_offered: number,      // Pro výpočet pick rate
  selection_rate: percentage,
  avg_level_selected: number,
  
  // Výkonnost s power-upem
  avg_survival_time: seconds,
  avg_enemies_killed: number,
  avg_damage_dealt: number,
  
  // Kombinace
  common_combinations: array  // ["explosive+piercing", "shield+aura"]
}
```

### 4️⃣ Boss Performance
```javascript
{
  boss_name: string,
  encounter_count: number,
  defeat_count: number,
  win_rate: percentage,
  avg_fight_duration: seconds,
  avg_player_hp_remaining: number,
  death_patterns: {
    special_attack: number,   // Úmrtí speciálním útokem
    normal_attack: number,
    collision: number
  }
}
```

### 5️⃣ Level Progression
```javascript
{
  level_number: number,
  reached_count: number,      // Kolik hráčů dosáhlo
  death_count: number,        // Kolik zde zemřelo
  avg_time_to_reach: seconds,
  avg_player_hp: number,
  avg_score: number,
  difficulty_spike: boolean   // Auto-detekce based on death rate
}
```

### 6️⃣ Player Behavior Patterns
```javascript
{
  movement_heatmap: array,    // Grid 10x10 kde hráč tráví čas
  preferred_quadrant: string,  // "top-left", "center", etc.
  dodge_success_rate: percentage,
  pickup_response_time: ms,    // Jak rychle sbírá XP/health
  aggression_score: number     // Based on movement towards enemies
}
```

## 🗄️ Databázové schéma (Supabase)

### Tabulka: `game_sessions`
```sql
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(36) NOT NULL,
  player_name VARCHAR(12),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration INTEGER,
  
  -- Results
  final_score INTEGER,
  final_level INTEGER,
  death_cause VARCHAR(50),
  death_x INTEGER,
  death_y INTEGER,
  
  -- Stats
  total_damage_dealt INTEGER,
  total_damage_taken INTEGER,
  enemies_killed INTEGER,
  bosses_defeated TEXT[], -- Array of boss names
  xp_collected INTEGER,
  health_pickups INTEGER,
  
  -- Device
  browser VARCHAR(50),
  screen_width INTEGER,
  screen_height INTEGER,
  fps_average DECIMAL(5,2),
  
  -- Meta
  game_version VARCHAR(10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Tabulka: `enemy_stats`
```sql
CREATE TABLE enemy_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(36) REFERENCES game_sessions(session_id),
  enemy_type VARCHAR(20),
  killed_count INTEGER DEFAULT 0,
  damage_dealt INTEGER DEFAULT 0,
  damage_taken INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Tabulka: `powerup_events`
```sql
CREATE TABLE powerup_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(36) REFERENCES game_sessions(session_id),
  powerup_name VARCHAR(30),
  level_selected INTEGER,
  options_offered TEXT[], -- Jaké byly ostatní možnosti
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Tabulka: `death_events`
```sql
CREATE TABLE death_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(36),
  player_name VARCHAR(12),
  level INTEGER,
  score INTEGER,
  killer_type VARCHAR(50),
  killer_damage INTEGER,
  player_hp_before INTEGER,
  position_x INTEGER,
  position_y INTEGER,
  power_ups TEXT[], -- Active power-ups at death
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 📡 Implementace v kódu

### Analytics Manager
```javascript
class AnalyticsManager {
  constructor(supabase) {
    this.supabase = supabase;
    this.sessionId = this.generateSessionId();
    this.sessionData = {};
    this.eventQueue = [];
    this.flushInterval = 30000; // 30 sekund
  }
  
  // Track events
  trackEnemyKill(enemy) { }
  trackDamageDeal(amount, target) { }
  trackDamageTaken(amount, source) { }
  trackPowerUpSelection(powerup, options) { }
  trackBossDefeat(boss) { }
  trackPlayerDeath(cause, position) { }
  
  // Batch upload
  async flushEvents() { }
}
```

## 📊 Analytics Dashboard (Základní)

### Klíčové metriky k zobrazení:
1. **Death Heatmap** - Kde hráči nejvíc umírají
2. **Enemy Danger Rating** - Který nepřítel zabíjí nejvíc
3. **Power-up Tier List** - Nejúspěšnější kombinace
4. **Level Funnel** - Kde hráči odpadávají
5. **Boss Difficulty** - Win rate per boss
6. **Session Metrics** - Avg. playtime, score distribution

## 🔒 Privacy & GDPR

### Zásady:
1. **Anonymní ID** - Žádné osobní údaje
2. **Opt-in** - Hráč může vypnout
3. **Data retention** - Max 90 dní
4. **Transparent** - Info co sbíráme

### Implementace:
```javascript
// První spuštění
if (!localStorage.getItem('analytics_consent')) {
  showConsentDialog();
}

// Možnost vypnout v settings
settings.allowAnalytics = true/false;
```

## 🚀 Fáze implementace

### Fáze 1: Základní tracking (MVP)
- [ ] Session start/end
- [ ] Death events
- [ ] Score submission
- [ ] Basic enemy kills

### Fáze 2: Detailní metriky
- [ ] Power-up tracking
- [ ] Boss analytics
- [ ] Damage tracking
- [ ] Level progression

### Fáze 3: Advanced
- [ ] Movement heatmaps
- [ ] Player behavior patterns
- [ ] Performance metrics
- [ ] A/B testing support

### Fáze 4: Dashboard
- [ ] Real-time metrics
- [ ] Historical graphs
- [ ] Export do CSV
- [ ] Automated reports

## 💡 Use Cases

### Pro vývojáře:
1. **"Level 15 má 70% death rate"** → Snížit obtížnost
2. **"Nikdo nepoužívá Metabolic Booster"** → Buff nebo redesign
3. **"Elite Purple oneshot kills 40% hráčů"** → Nerf damage
4. **"Průměrná session je 3 minuty"** → Příliš těžký začátek?

### Pro hráče (public stats):
1. **"Jsi lepší než 85% hráčů"**
2. **"Tvůj oblíbený power-up: Chemotherapy"**
3. **"Přežil jsi o 2 minuty déle než průměr"**
4. **"Zabil jsi 2x více bossů než ostatní"**

## 🎯 KPIs k sledování

1. **Retention Rate** - Vrací se hráči?
2. **Session Length** - Jak dlouho hrají?
3. **Level Distribution** - Kam se dostávají?
4. **Death Distribution** - Co je zabíjí?
5. **Power-up Meta** - Co je OP?
6. **Device Performance** - Funguje všude?

---

*Tento systém nám umožní data-driven development a kontinuální vylepšování hry!*