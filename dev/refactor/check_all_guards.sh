#!/bin/bash

# Guard skript pro kontrolu všech souborů kromě povolených výjimek

echo "🔍 Kontrola zakázaných patternů ve všech souborech..."
echo "================================================"

# Povolené výjimky - UI & systémy které smí používat Phaser API
ALLOWED_DIRS="js/ui/|js/core/vfx/|js/core/sfx/|js/core/audio/"
ALLOWED_FILES="js/scenes/GameUIScene.js|js/scenes/MainMenu.js|js/scenes/PreloadScene.js"

# Najít všechny JS soubory kromě povolených
FILES=$(find js -name "*.js" | grep -v -E "($ALLOWED_DIRS|$ALLOWED_FILES)")

ERRORS=0
TOTAL_FILES=0

for FILE in $FILES; do
    if [ ! -f "$FILE" ]; then
        continue
    fi
    
    TOTAL_FILES=$((TOTAL_FILES + 1))
    FILE_ERRORS=0
    
    # Kontrola zakázaných patternů
    if rg -q "this\.add\." "$FILE" 2>/dev/null; then
        FILE_ERRORS=$((FILE_ERRORS + 1))
    fi
    
    if rg -q "this\.physics\.add\." "$FILE" 2>/dev/null; then
        FILE_ERRORS=$((FILE_ERRORS + 1))
    fi
    
    if rg -q "this\.tweens\.add" "$FILE" 2>/dev/null; then
        FILE_ERRORS=$((FILE_ERRORS + 1))
    fi
    
    if rg -q "this\.sound\.play" "$FILE" 2>/dev/null; then
        FILE_ERRORS=$((FILE_ERRORS + 1))
    fi
    
    if rg -q "particles\.createEmitter" "$FILE" 2>/dev/null; then
        FILE_ERRORS=$((FILE_ERRORS + 1))
    fi
    
    if [ "$FILE_ERRORS" -gt 0 ]; then
        echo "❌ $FILE - $FILE_ERRORS violations"
        ERRORS=$((ERRORS + FILE_ERRORS))
    fi
done

echo "================================================"
echo "📊 Zkontrolováno souborů: $TOTAL_FILES"

# LOC check: flag any JS file in js/ over 500 lines
# Exempt: js/core/testing/ and js/utils/ (test/debug files)
echo ""
echo "📏 Kontrola LOC limitu (max 500 řádků)..."
echo "------------------------------------------------"
LOC_VIOLATIONS=0
while IFS= read -r FILE; do
    # Skip exempt directories
    if echo "$FILE" | grep -qE "^js/core/testing/|^js/utils/"; then
        continue
    fi
    LOC=$(wc -l < "$FILE" | tr -d ' ')
    if [ "$LOC" -gt 500 ]; then
        echo "❌ $FILE — $LOC LOC (limit: 500)"
        LOC_VIOLATIONS=$((LOC_VIOLATIONS + 1))
        ERRORS=$((ERRORS + 1))
    fi
done < <(find js -name "*.js" -type f)

if [ "$LOC_VIOLATIONS" -eq 0 ]; then
    echo "✅ Všechny soubory splňují LOC limit"
else
    echo "❌ $LOC_VIOLATIONS souborů překračuje 500 LOC"
fi

echo "================================================"

if [ "$ERRORS" -eq 0 ]; then
    echo "✅ Všechny guardy prošly!"
    exit 0
else
    echo "❌ Nalezeno celkem $ERRORS problémů"
    echo "💡 Tip: Pro detaily spusťte guard na konkrétní soubor"
    exit 1
fi