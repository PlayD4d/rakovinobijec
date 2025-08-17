#!/bin/bash

echo "=== Enemy Refactor Guards Check ==="
echo ""

# Check for Phaser API in behaviors
echo "1. Checking for Phaser API in behaviors..."
PHASER_IN_BEHAVIORS=$(grep -r "Phaser\." js/entities/ai/behaviors/ 2>/dev/null | grep -v "// \|/\*" | wc -l)
if [ "$PHASER_IN_BEHAVIORS" -eq 0 ]; then
    echo "   ✓ No Phaser API calls in behaviors"
else
    echo "   ✗ Found Phaser API calls in behaviors:"
    grep -r "Phaser\." js/entities/ai/behaviors/ 2>/dev/null | grep -v "// \|/\*"
fi

# Check for direct scene manipulation in behaviors
echo ""
echo "2. Checking for direct scene manipulation in behaviors..."
SCENE_MANIP=$(grep -r "scene\.\(add\|physics\|sound\|events\|time\|tweens\|cameras\)" js/entities/ai/behaviors/ 2>/dev/null | wc -l)
if [ "$SCENE_MANIP" -eq 0 ]; then
    echo "   ✓ No direct scene manipulation in behaviors"
else
    echo "   ✗ Found direct scene manipulation in behaviors:"
    grep -r "scene\.\(add\|physics\|sound\|events\|time\|tweens\|cameras\)" js/entities/ai/behaviors/ 2>/dev/null
fi

# Check for cyclic dependencies
echo ""
echo "3. Checking for cyclic dependencies..."
echo "   Checking if behaviors import Enemy..."
CYCLIC_DEPS=$(grep -r "from.*Enemy" js/entities/ai/behaviors/ 2>/dev/null | wc -l)
if [ "$CYCLIC_DEPS" -eq 0 ]; then
    echo "   ✓ No cyclic dependencies found"
else
    echo "   ✗ Found potential cyclic dependencies:"
    grep -r "from.*Enemy" js/entities/ai/behaviors/ 2>/dev/null
fi

# Check that behaviors are pure functions
echo ""
echo "4. Checking that behaviors are pure functions..."
echo "   Checking for 'class' keyword in behaviors..."
CLASSES_IN_BEHAVIORS=$(grep -r "^class " js/entities/ai/behaviors/ 2>/dev/null | wc -l)
if [ "$CLASSES_IN_BEHAVIORS" -eq 0 ]; then
    echo "   ✓ No classes in behaviors (good - using pure functions)"
else
    echo "   ✗ Found classes in behaviors (should be pure functions):"
    grep -r "^class " js/entities/ai/behaviors/ 2>/dev/null
fi

# Check that EnemyCore has all capability methods
echo ""
echo "5. Checking EnemyCore capability methods..."
REQUIRED_CAPS="getPos setVelocity faceTo inRangeOfPlayer shoot playSfx spawnVfx schedule setState getState isAlive"
for cap in $REQUIRED_CAPS; do
    if grep -q "$cap(" js/entities/core/EnemyCore.js 2>/dev/null; then
        echo "   ✓ $cap() implemented"
    else
        echo "   ✗ $cap() missing"
    fi
done

echo ""
echo "=== Guards Check Complete ==="