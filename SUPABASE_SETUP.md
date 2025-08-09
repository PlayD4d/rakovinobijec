# 🚀 Supabase Setup pro Rakovinobijec

## 📋 Krok za krokem návod

### 1. Vytvoř Supabase účet
1. Jdi na [supabase.com](https://supabase.com)
2. Zaregistruj se (zdarma)
3. Vytvoř nový projekt

### 2. Nastav databázi
1. V Supabase dashboard klikni na **SQL Editor** (ikona terminálu v levém menu)
2. Klikni na **New query**
3. Zkopíruj celý obsah souboru `supabase_setup.sql`
4. Vlož ho do SQL editoru
5. Klikni **Run** (zelené tlačítko)
6. Měl bys vidět zprávu "Success. No rows returned"

### 3. Ověř tabulku
1. Jdi do **Table Editor** (ikona tabulky v levém menu)
2. Měl bys vidět tabulku `high_scores`
3. Klikni na ni - měla by být prázdná ale s těmito sloupci:
   - id, name, score, level, enemies_killed, time, bosses_defeated, created_at, version

### 4. Konfigurace je už hotová!
Hra již obsahuje Supabase konfiguraci přímo v kódu (`js/managers/GlobalHighScoreManager.js`).
Nemusíš nic nastavovat - vše funguje automaticky!

### 5. Test
1. Otevři hru v prohlížeči
2. Otevři Developer Console (F12)
3. Měl bys vidět: `✅ Supabase client initialized`
4. Zahraj hru a udělej high score
5. V Supabase Table Editor zkontroluj, že se záznam uložil

## 🔒 Bezpečnost

### Co je BEZPEČNÉ:
✅ **anon/public key** - tento klíč je navržený pro client-side použití
✅ **Project URL** - je veřejná informace
✅ Máme nastavené RLS policies které omezují co může kdokoliv dělat

### Co NIKDY nesdílej:
❌ **service_role key** - tento klíč má plný přístup k databázi
❌ **Database password** - heslo k PostgreSQL
❌ Connection string s heslem

## 🛡️ RLS (Row Level Security)

Naše policies dovolují:
- ✅ Číst high scores (kdokoliv)
- ✅ Vložit nové high score (kdokoliv, ale s validací)
- ❌ Upravovat existující záznamy (nikdo)
- ❌ Mazat záznamy (nikdo)

## 🐛 Troubleshooting

**"Supabase client not loaded"**
- Zkontroluj internetové připojení
- Zkontroluj že máš správně vytvořený `js/config.supabase.js`

**"Failed to fetch global scores"**
- Zkontroluj že tabulka `high_scores` existuje
- Zkontroluj RLS policies v Table Editor → high_scores → RLS Policies

**High scores se neukládají**
- Otevři Network tab v Developer Tools
- Hledej request na supabase.co
- Zkontroluj response - měl by obsahovat error message

## 📝 Poznámky

- Supabase free tier má limit 500MB databáze a 2GB přenosu/měsíc
- Pro hru typu Rakovinobijec to bohatě stačí (každý záznam je ~100 bytes)
- Anon key MŮŽE být v public repozitáři (je k tomu navržený)
- Ale je lepší praxe ho mít v config souboru