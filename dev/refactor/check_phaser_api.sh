#!/bin/bash

# Specifická kontrola Phaser API mimo povolené systémy

echo "🔍 Kontrola Phaser API použití mimo povolené moduly..."
echo "================================================"

# Povolené výjimky - moduly které smí používat Phaser API přímo
# UI & scene files
# Entity core files (extend Phaser.Physics.Arcade.Sprite)
# Systems that need direct Phaser API access
# Handlers, managers, and debug utilities
ALLOWED='(js/ui/|js/core/vfx/|js/core/sfx/|js/core/audio/|js/scenes/GameUIScene\.js|js/scenes/MainMenu\.js|js/scenes/PreloadScene\.js|js/entities/Player\.js|js/entities/core/EnemyCore\.js|js/entities/boss/BossCore\.js|js/entities/boss/BossMovement\.js|js/handlers/setupCollisions\.js|js/managers/SystemsInitializer\.js|js/core/systems/ProjectileSystem\.js|js/core/systems/SimpleLootSystem\.js|js/core/graphics/GraphicsFactory\.js|js/core/systems/powerup/abilities/DamageZoneAbilities\.js|js/core/systems/powerup/abilities/ShieldRegeneration\.js|js/utils/DebugOverlay\.js|js/managers/EnemyManager\.js)'

# Patterny zakázaného Phaser API
PATTERNS='(this\.sound\.play|this\.add\.particles|particles\.createEmitter|this\.add\.(sprite|image|text|graphics|container|rectangle|circle)|scene\.add\.|scene\.physics\.add\.|scene\.tweens\.add)'

# Najít všechny výskyty
BAD=$(rg -n "$PATTERNS" js --type js | grep -v -E "$ALLOWED" || true)

if [ -n "$BAD" ]; then
    echo "❌ Nalezeno použití Phaser API mimo povolené moduly:"
    echo "------------------------------------------------"
    echo "$BAD" | head -20
    
    COUNT=$(echo "$BAD" | wc -l)
    echo "------------------------------------------------"
    echo "❌ Celkem nalezeno: $COUNT výskytů"
    
    # Ukázat, které soubory jsou problematické
    echo ""
    echo "📁 Problematické soubory:"
    echo "$BAD" | cut -d':' -f1 | sort -u
    
    exit 1
else
    echo "✅ Phaser API použití je správně omezeno na povolené moduly"
    echo ""
    echo "📋 Povolené moduly:"
    echo "  - js/ui/* (UI komponenty)"
    echo "  - js/core/vfx/* (VFX systém)"
    echo "  - js/core/sfx/* (SFX systém)"
    echo "  - js/core/audio/* (Audio systém)"
    echo "  - js/scenes/GameUIScene.js, MainMenu.js, PreloadScene.js"
    echo "  - js/entities/Player.js, core/EnemyCore.js, boss/BossCore.js, boss/BossMovement.js"
    echo "  - js/handlers/setupCollisions.js"
    echo "  - js/managers/SystemsInitializer.js, EnemyManager.js"
    echo "  - js/core/systems/ProjectileSystem.js, SimpleLootSystem.js"
    echo "  - js/core/graphics/GraphicsFactory.js"
    echo "  - js/core/systems/powerup/abilities/DamageZoneAbilities.js, ShieldRegeneration.js"
    echo "  - js/utils/DebugOverlay.js"
    exit 0
fi