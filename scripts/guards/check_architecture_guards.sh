#!/bin/bash

# Comprehensive architecture guard checks
# Enforces rules from CLAUDE.md and CODE_STANDARDS.md

ERRORS=0
echo "Architecture Guard Checks"
echo "================================================"

# 1. game.events prohibition (MUST be zero)
echo -n "game.events usage ............. "
BAD=$(rg -n "game\.events\.(on|emit|once)" js --type js | grep -v "//.*game\.events" || true)
if [ -n "$BAD" ]; then
    echo "FAIL"
    echo "$BAD"
    ERRORS=$((ERRORS + 1))
else
    echo "PASS"
fi

# 2. physics.add.overlap outside setupCollisions.js (MUST be zero)
echo -n "physics.add.overlap outside setupCollisions ... "
BAD=$(rg -n "\.physics\.add\.overlap" js --type js | grep -v "setupCollisions.js" | grep -v "registerDynamicOverlap" || true)
if [ -n "$BAD" ]; then
    echo "FAIL"
    echo "$BAD"
    ERRORS=$((ERRORS + 1))
else
    echo "PASS"
fi

# 3. cap.scene in behaviors (MUST be zero)
echo -n "cap.scene in behaviors ........ "
BAD=$(rg -n "cap\.scene" js/entities/ai/behaviors/ --type js 2>/dev/null || true)
if [ -n "$BAD" ]; then
    echo "FAIL"
    echo "$BAD"
    ERRORS=$((ERRORS + 1))
else
    echo "PASS"
fi

# 4. forEach + destroy on group children
echo -n "forEach+destroy pattern ....... "
BAD=$(rg -n "getChildren\(\).*forEach.*destroy|forEach.*child.*destroy" js --type js || true)
if [ -n "$BAD" ]; then
    echo "FAIL"
    echo "$BAD"
    ERRORS=$((ERRORS + 1))
else
    echo "PASS"
fi

# 5. Phaser API in behaviors (MUST be zero)
echo -n "Phaser API in behaviors ....... "
BAD=$(rg -n "Phaser\.|this\.scene\." js/entities/ai/behaviors/ --type js 2>/dev/null || true)
if [ -n "$BAD" ]; then
    echo "FAIL"
    echo "$BAD"
    ERRORS=$((ERRORS + 1))
else
    echo "PASS"
fi

# 6. Direct scene.add.graphics (should use GraphicsFactory)
echo -n "Direct scene.add.graphics ..... "
BAD=$(rg -n "scene\.add\.graphics\(\)" js --type js | grep -v "GraphicsFactory" | grep -v "DebugOverlay" || true)
if [ -n "$BAD" ]; then
    echo "FAIL"
    echo "$BAD"
    ERRORS=$((ERRORS + 1))
else
    echo "PASS"
fi

# 7. Direct scene.sound.play (should use AudioSystem)
echo -n "Direct scene.sound.play ....... "
BAD=$(rg -n "scene\.sound\.play\|this\.sound\.play" js --type js | grep -v "AudioSystem\|SimplifiedAudioSystem\|SFXPlayer\|MusicPlayer" || true)
if [ -n "$BAD" ]; then
    echo "FAIL"
    echo "$BAD"
    ERRORS=$((ERRORS + 1))
else
    echo "PASS"
fi

# 8. Hardcoded depth values (should use DEPTH_LAYERS)
echo -n "Hardcoded setDepth values ..... "
BAD=$(rg -n "setDepth\(\d+\)" js --type js | grep -v "DEPTH_LAYERS\|depth\|Depth" | grep -v "js/ui/\|js/core/vfx/\|js/utils/" || true)
if [ -n "$BAD" ]; then
    echo "FAIL"
    echo "$BAD"
    ERRORS=$((ERRORS + 1))
else
    echo "PASS"
fi

echo "================================================"
if [ "$ERRORS" -eq 0 ]; then
    echo "All architecture guards passed!"
    exit 0
else
    echo "$ERRORS architecture violations found"
    exit 1
fi
