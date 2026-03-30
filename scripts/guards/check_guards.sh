#!/bin/bash

# Guard skript pro kontrolu zakázaných patternů v GameScene.js

echo "🔍 Kontrola zakázaných patternů v GameScene.js..."
echo "================================================"

GAME_SCENE="js/scenes/GameScene.js"
ERRORS=0

# Kontrola this.add.*
echo -n "❌ this.add.* ..................... "
if rg -q "this\.add\." "$GAME_SCENE" 2>/dev/null; then
    echo "FOUND!"
    rg -n "this\.add\." "$GAME_SCENE" | head -5
    ERRORS=$((ERRORS + 1))
else
    echo "✅ OK"
fi

# Kontrola this.physics.add.*
echo -n "❌ this.physics.add.* ............. "
if rg -q "this\.physics\.add\." "$GAME_SCENE" 2>/dev/null; then
    echo "FOUND!"
    rg -n "this\.physics\.add\." "$GAME_SCENE" | head -5
    ERRORS=$((ERRORS + 1))
else
    echo "✅ OK"
fi

# Kontrola this.tweens.add
echo -n "❌ this.tweens.add ................ "
if rg -q "this\.tweens\.add" "$GAME_SCENE" 2>/dev/null; then
    echo "FOUND!"
    rg -n "this\.tweens\.add" "$GAME_SCENE" | head -5
    ERRORS=$((ERRORS + 1))
else
    echo "✅ OK"
fi

# Kontrola generateTexture a graphics primitives
echo -n "❌ generateTexture/add.graphics .... "
COUNT=$(grep -c "generateTexture\|\.add\.graphics\|\.add\.circle\|\.add\.rectangle\|\.add\.text\|\.add\.container\|\.add\.sprite\|\.add\.image" "$GAME_SCENE" 2>/dev/null | tail -1)
COUNT=${COUNT:-0}
if (( COUNT > 0 )); then
    echo "FOUND! ($COUNT výskytů)"
    grep -n "generateTexture\|\.add\.graphics\|\.add\.circle\|\.add\.rectangle\|\.add\.text\|\.add\.container\|\.add\.sprite\|\.add\.image" "$GAME_SCENE" | head -5
    ERRORS=$((ERRORS + 1))
else
    echo "✅ OK"
fi

# Kontrola hardcoded setDepth s čísly
echo -n "❌ setDepth(číslo) ................ "
if rg -q "setDepth\(\d+\)" "$GAME_SCENE" 2>/dev/null; then
    echo "FOUND!"
    rg -n "setDepth\(\d+\)" "$GAME_SCENE" | head -5
    ERRORS=$((ERRORS + 1))
else
    echo "✅ OK"
fi

# Kontrola physics.add.overlap/collide
echo -n "❌ physics.add.overlap/collide .... "
if rg -q "physics\.add\.(overlap|collide)" "$GAME_SCENE" 2>/dev/null; then
    echo "FOUND!"
    rg -n "physics\.add\.(overlap|collide)" "$GAME_SCENE" | head -5
    ERRORS=$((ERRORS + 1))
else
    echo "✅ OK"
fi

# Kontrola this.sound.play
echo -n "❌ this.sound.play ................ "
if rg -q "this\.sound\.play" "$GAME_SCENE" 2>/dev/null; then
    echo "FOUND!"
    rg -n "this\.sound\.play" "$GAME_SCENE" | head -5
    ERRORS=$((ERRORS + 1))
else
    echo "✅ OK"
fi

# Kontrola particles.createEmitter
echo -n "❌ particles.createEmitter ........ "
if rg -q "particles\.createEmitter" "$GAME_SCENE" 2>/dev/null; then
    echo "FOUND!"
    rg -n "particles\.createEmitter" "$GAME_SCENE" | head -5
    ERRORS=$((ERRORS + 1))
else
    echo "✅ OK"
fi

# Kontrola scene.(add|physics.add|tweens.add)
echo -n "❌ scene.(add|physics|tweens) ..... "
if rg -q "scene\.(add|physics\.add|tweens\.add)" "$GAME_SCENE" 2>/dev/null; then
    echo "FOUND!"
    rg -n "scene\.(add|physics\.add|tweens\.add)" "$GAME_SCENE" | head -5
    ERRORS=$((ERRORS + 1))
else
    echo "✅ OK"
fi

echo "================================================"

# LOC check
LOC=$(wc -l < "$GAME_SCENE" | tr -d ' ')
echo "📏 GameScene.js LOC: $LOC"

if [ "$LOC" -le 500 ]; then
    echo "✅ LOC cíl splněn (≤ 500)"
else
    echo "❌ LOC cíl nesplněn (cíl: ≤ 500)"
    ERRORS=$((ERRORS + 1))
fi

echo "================================================"

if [ "$ERRORS" -eq 0 ]; then
    echo "✅ Všechny guardy prošly!"
    exit 0
else
    echo "❌ Nalezeno $ERRORS problémů"
    exit 1
fi