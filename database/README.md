# Databázové schéma - Rakovinobijec Analytics

## Přehled

Databázové schéma pro sběr analytických dat ze hry Rakovinobijec. Navrženo pro Supabase (PostgreSQL) s důrazem na:
- 📊 Kompletní herní telemetrii
- 🔒 Row Level Security (RLS) 
- 🚀 Optimalizované indexy pro rychlé dotazy
- 📈 Připravené views pro analýzu

## Instalace

### 1. Vytvoření nové databáze v Supabase

1. Přihlaste se do [Supabase Console](https://app.supabase.com)
2. Vytvořte nový projekt nebo použijte existující
3. Přejděte do SQL Editor

### 2. Aplikace schématu

```sql
-- Spusťte celý obsah souboru schema.sql v SQL editoru
```

### 3. Ověření

```sql
-- Zkontrolujte, že všechny tabulky byly vytvořeny
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

## Struktura tabulek

### 📋 `game_sessions`
Hlavní tabulka pro herní session. Každá hra vytvoří jeden záznam.

**Klíčové sloupce:**
- `session_id` - Unikátní ID session
- `duration_seconds` - GENERATED sloupec, automaticky počítá délku hry
- `level_reached` - Nejvyšší dosažený level
- `death_cause` - Příčina smrti (pokud hráč zemřel)

### ⚔️ `enemy_stats`
Agregované statistiky nepřátel za session.

**Klíčové sloupce:**
- `enemy_type` - Typ nepřítele (např. "enemy.necrotic_cell")
- `spawn_count` - Kolikrát byl spawnut
- `killed_count` - Kolikrát byl zabit
- `damage_dealt_to_player` - Celkové damage hráči

### 📊 `performance_metrics`
Výkonnostní metriky v čase.

**Snapshot typy:**
- `regular` - Pravidelný snapshot
- `low_fps` - Při poklesu FPS
- `error` - Při chybě
- `boss_fight` - Během boss fightu

### 💀 `death_events`
Detailní informace o každé smrti hráče.

### ⚡ `powerup_events`
Sledování sbírání a výběru power-upů.

### 🐉 `boss_events`
Statistiky soubojů s bossy.

### 💎 `loot_events`
Sledování dropů a jejich sbírání.

### 🌊 `wave_events`
Statistiky jednotlivých vln nepřátel.

## Views pro analýzu

### `session_summary`
Přehled všech sessions s vypočítanými metrikami.

```sql
SELECT * FROM session_summary 
WHERE game_version = '0.3.0'
ORDER BY started_at DESC;
```

### `death_causes_summary`
Nejčastější příčiny smrti.

```sql
SELECT * FROM death_causes_summary
LIMIT 10;
```

### `performance_issues`
Sessions s problémy s výkonem.

```sql
SELECT * FROM performance_issues
WHERE avg_fps < 30;
```

## Pomocné funkce

### `calculate_session_stats(session_id)`
Vypočítá souhrnné statistiky pro danou session.

```sql
SELECT * FROM calculate_session_stats('session_123');
```

## RLS (Row Level Security)

Všechny tabulky mají povolené RLS s těmito politikami:
- ✅ Anonymous INSERT - hra může zapisovat data
- ✅ Anonymous UPDATE na `game_sessions` - pro aktualizaci na konci hry
- ✅ Public SELECT na `game_sessions` - pro leaderboardy

## Maintenance

### Vyčištění starých dat

```sql
-- Smazat sessions starší než 30 dní
DELETE FROM game_sessions 
WHERE started_at < NOW() - INTERVAL '30 days';
```

### Optimalizace

```sql
-- Reindex po velkém množství dat
REINDEX TABLE game_sessions;
VACUUM ANALYZE game_sessions;
```

## Příklady dotazů

### Top 10 hráčů podle skóre

```sql
SELECT 
    player_name,
    MAX(score) as best_score,
    MAX(level_reached) as best_level,
    COUNT(*) as games_played
FROM game_sessions
WHERE game_version = '0.3.0'
GROUP BY player_name
ORDER BY best_score DESC
LIMIT 10;
```

### Průměrná délka hry podle levelu

```sql
SELECT 
    level_reached,
    AVG(duration_seconds) as avg_duration,
    COUNT(*) as session_count
FROM game_sessions
WHERE duration_seconds > 0
GROUP BY level_reached
ORDER BY level_reached;
```

### Nejnebezpečnější nepřátelé

```sql
SELECT 
    enemy_type,
    SUM(player_deaths_caused) as total_kills,
    AVG(damage_dealt_to_player) as avg_damage
FROM enemy_stats
GROUP BY enemy_type
ORDER BY total_kills DESC
LIMIT 10;
```

## Migrace

Při aktualizaci schématu:

1. Vždy zálohujte data před migrací
2. Používejte `IF NOT EXISTS` pro nové tabulky
3. Pro změny sloupců používejte `ALTER TABLE`
4. Dokumentujte všechny změny

## Troubleshooting

### Foreign key constraint error
Znamená, že se snažíte vložit data do child tabulky bez existujícího parent záznamu.
**Řešení:** Vždy vytvořte `game_session` před jakýmikoli jinými eventy.

### Performance issues
Pokud jsou dotazy pomalé:
1. Zkontrolujte indexy: `\d table_name`
2. Použijte EXPLAIN ANALYZE: `EXPLAIN ANALYZE SELECT ...`
3. Zvažte přidání dalších indexů

## Kontakt

Pro problémy s databází vytvořte issue na GitHubu projektu.