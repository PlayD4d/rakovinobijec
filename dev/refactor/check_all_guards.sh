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

if [ "$ERRORS" -eq 0 ]; then
    echo "✅ Všechny guardy prošly!"
    exit 0
else
    echo "❌ Nalezeno celkem $ERRORS problémů"
    echo "💡 Tip: Pro detaily spusťte guard na konkrétní soubor"
    exit 1
fi