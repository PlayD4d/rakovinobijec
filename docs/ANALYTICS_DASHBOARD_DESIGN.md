# 📊 Analytics Dashboard - Design Document

## 🎯 Přehled

Analytics Dashboard pro Rakovinobijec je interní nástroj pro sledování a analýzu herních dat v reálném čase. Poskytuje kompletní přehled o chování hráčů, výkonnosti hry a balance mechanik.

## 🏗️ Architektura

### Frontend Stack
- **Vanilla JavaScript + HTML5/CSS3** - rychlost a jednoduchost
- **Chart.js 4.x** - vizualizace dat (grafy, charts)
- **CSS Grid/Flexbox** - responzivní layout
- **WebSocket/SSE** - real-time updates (budoucí)

### Backend Integration
- **Supabase REST API** - přímé dotazy na analytics tabulky
- **PostgreSQL Views** - předpočítané agregace
- **RLS Policies** - zabezpečený přístup k datům

### Data Flow
```
Analytics Data (7 tables) → Supabase → Dashboard API → Chart.js → UI
```

## 📈 Klíčové Metriky (KPIs)

### 1. 🎮 Gameplay Metrics

**Session Analytics:**
- Průměrná délka session (minuty)
- Sessions per day/week/month
- Retention rate (D1, D7, D30)
- Quit points (kdy hráči odchází)

**Player Progression:**
- Průměrný level reach
- Level distribution histogram
- Score distribution
- XP collection patterns

**Death Analysis:**
- Death rate per level
- Nejčastější příčiny smrti
- Death heat map (pozice na mapě)
- Time to death distribution

### 2. ⚔️ Combat & Balance

**Enemy Analytics:**
- Kill/death ratio per enemy type
- Elite vs normal enemy performance
- Enemy spawn vs kill rate
- Damage dealt/taken ratios

**Power-up Usage:**
- Popularity ranking power-upů
- Selection rate per power-up
- Win rate s konkrétními power-upy
- Power-up kombinace (co se vybírá společně)

**Boss Performance:**
- Success rate per boss
- Average attempts per boss
- Boss damage dealt/taken
- Time to defeat distribution

### 3. 🔧 Technical Metrics

**Performance:**
- FPS distribution (min/avg/max)
- Loading time statistics
- Error rate and types
- Memory usage patterns

**Platform Stats:**
- Browser usage
- Screen resolution distribution
- Connection type (online/offline)
- Device performance correlation

## 🎨 UI/UX Design

### Layout Structure
```
┌─────────────────────────────────────────┐
│ HEADER: Rakovinobijec Analytics         │
│ [Live Status] [Last Update] [Filters]   │
├─────────────────────────────────────────┤
│ SIDEBAR                │ MAIN CONTENT   │
│ • Overview            │                 │
│ • Gameplay            │     CHARTS      │
│ • Players             │   & METRICS     │
│ • Deaths              │                 │
│ • Power-ups           │                 │
│ • Bosses              │                 │
│ • Performance         │                 │
│ • Trends              │                 │
└─────────────────────────────────────────┘
```

### Design Principles
- **Dark theme** - konzistentní s herní estetikou
- **Cancer fighter colors** - červená/zelená/modrá z hry
- **Minimalist** - focus na data, ne na dekoraci
- **Mobile responsive** - funkční i na tabletu
- **Fast loading** - pod 3 sekundy load time

## 📊 Dashboard Sekce

### 1. 📈 Overview (Default)
**Hlavní KPIs jako karty:**
- Sessions Today: 45 (+12%)
- Active Players: 23 (live)
- Avg Session: 8.5 min
- Total Deaths: 1,247

**Time Series Graphs:**
- Sessions per hour (24h)
- Player activity heatmap
- Score progression trend

### 2. 🎮 Gameplay
**Charts:**
- Level distribution (histogram)
- Death rate per level (line chart)
- XP collection rate (area chart)
- Score quartiles (box plot)

**Tables:**
- Top players by score
- Longest sessions
- Most killed enemies

### 3. 👤 Players
**Segmentation:**
- New vs Returning players
- Session length categories
- Skill level distribution

**Behavior:**
- Play time patterns (heatmap)
- Retention funnel
- Churn analysis

### 4. 💀 Deaths
**Analysis:**
- Death causes pie chart
- Death positions heat map
- Survival time distribution
- Death per level trend

**Tables:**
- Deadliest enemies
- Most dangerous levels
- Common death scenarios

### 5. 💊 Power-ups
**Usage Stats:**
- Selection frequency (bar chart)
- Win rate with power-ups
- Power-up combinations matrix
- Upgrade path analysis

### 6. 👑 Bosses
**Performance:**
- Success rate per boss
- Average attempts
- Damage analysis
- Fight duration

### 7. ⚡ Performance
**Technical Metrics:**
- FPS distribution
- Loading times
- Error rates
- Platform breakdown

### 8. 📈 Trends
**Historical Analysis:**
- Weekly player trends
- Monthly performance
- Seasonal patterns
- Growth metrics

## 🔍 Filtering & Controls

### Time Filters
- Last 1 hour
- Last 24 hours
- Last 7 days
- Last 30 days
- Custom range

### Data Filters
- Player segments
- Level ranges
- Boss encounters only
- High performers only

### Real-time Toggle
- Live data (auto-refresh)
- Static snapshot
- Refresh rate control

## 💾 Data Queries

### Key SQL Views
```sql
-- Dashboard overview
CREATE VIEW dashboard_overview AS
SELECT 
    COUNT(DISTINCT session_id) as total_sessions,
    COUNT(DISTINCT player_name) as unique_players,
    AVG(duration) as avg_session_duration,
    SUM(enemies_killed) as total_kills
FROM game_sessions 
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Death analysis
CREATE VIEW death_analysis AS
SELECT 
    killer_type,
    COUNT(*) as death_count,
    AVG(level) as avg_level_at_death,
    AVG(survival_time) as avg_survival_time
FROM death_events
GROUP BY killer_type
ORDER BY death_count DESC;

-- Power-up popularity
CREATE VIEW powerup_popularity AS
SELECT 
    powerup_name,
    COUNT(*) as selection_count,
    COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as selection_percentage
FROM powerup_events 
WHERE event_type = 'selected'
GROUP BY powerup_name
ORDER BY selection_count DESC;
```

## 🔐 Security & Access

### Authentication
- Password protected access
- Session-based auth (30 min timeout)
- Admin-only access

### Data Privacy
- No personal data displayed
- Aggregated data only
- GDPR compliant

### Performance
- Cached queries (5 min TTL)
- Lazy loading for charts
- Pagination for large datasets

## 🚀 Implementation Plan

### Phase 1: Core Structure (Day 1)
- [ ] Basic HTML/CSS layout
- [ ] Sidebar navigation
- [ ] Overview section with key metrics
- [ ] Chart.js integration

### Phase 2: Data Integration (Day 2)
- [ ] Supabase API connection
- [ ] Key SQL queries/views
- [ ] Real data in charts
- [ ] Error handling

### Phase 3: Advanced Features (Day 3)
- [ ] Time filters
- [ ] All dashboard sections
- [ ] Export functionality
- [ ] Mobile responsive

### Phase 4: Polish & Optimization (Day 4)
- [ ] Performance optimization
- [ ] Real-time updates
- [ ] Advanced visualizations
- [ ] Documentation

## 📁 File Structure
```
analytics-dashboard/
├── index.html                 # Main dashboard
├── css/
│   ├── dashboard.css         # Main styles
│   ├── charts.css           # Chart-specific styles
│   └── responsive.css       # Mobile styles
├── js/
│   ├── main.js              # Dashboard initialization
│   ├── api.js               # Supabase integration
│   ├── charts.js            # Chart.js helpers
│   ├── sections/
│   │   ├── overview.js      # Overview section
│   │   ├── gameplay.js      # Gameplay analytics
│   │   ├── players.js       # Player analytics
│   │   ├── deaths.js        # Death analysis
│   │   ├── powerups.js      # Power-up analytics
│   │   ├── bosses.js        # Boss analytics
│   │   ├── performance.js   # Technical metrics
│   │   └── trends.js        # Historical trends
│   └── utils/
│       ├── filters.js       # Time/data filtering
│       ├── export.js        # Data export
│       └── realtime.js      # Live updates
├── assets/
│   ├── logo.png            # Rakovinobijec logo
│   └── favicon.ico         # Dashboard favicon
└── README.md               # Dashboard documentation
```

## 🎯 Success Metrics

Dashboard bude považován za úspěšný pokud:
- ✅ Load time < 3 sekundy
- ✅ Všechny klíčové metriky zobrazeny správně
- ✅ Responzivní na tablet/desktop
- ✅ Real-time data refresh funguje
- ✅ Export funkcionalita funguje
- ✅ Žádné JS chyby v konzoli
- ✅ Data odpovídají skutečnosti ze hry

---

*Dokument vytvořen: Leden 2025*
*Verze: 1.0*