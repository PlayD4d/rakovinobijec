/**
 * Test script for PR7 Blueprint Compliance
 * Verifies that all stats from blueprints are properly applied to entities
 */

// Test function to verify blueprint stats are applied correctly
window.testBlueprintCompliance = function() {
    console.log('=== PR7 BLUEPRINT COMPLIANCE TEST ===');
    console.log('Testing if all stats from blueprints are properly applied...\n');
    
    const scene = window.game.scene.getScene('GameScene');
    if (!scene || !scene.blueprintLoader) {
        console.error('GameScene or BlueprintLoader not available. Start the game first!');
        return;
    }
    
    const results = [];
    
    // Test enemies
    const enemiesToTest = [
        'enemy.micro_shooter',
        'enemy.necrotic_cell',
        'enemy.viral_swarm'
    ];
    
    enemiesToTest.forEach(enemyId => {
        // Get blueprint
        const blueprint = scene.blueprintLoader.get(enemyId);
        if (!blueprint) {
            console.error(`Blueprint not found: ${enemyId}`);
            return;
        }
        
        // Spawn enemy
        const enemy = scene.spawnDirector.spawnEnemy(enemyId);
        if (!enemy) {
            console.error(`Failed to spawn: ${enemyId}`);
            return;
        }
        
        // Compare stats
        const expectedStats = blueprint.stats;
        const actualStats = {
            hp: enemy.hp,
            maxHp: enemy.maxHp,
            damage: enemy.damage,
            speed: enemy.speed,
            size: enemy.size,
            armor: enemy.armor,
            xp: enemy.xp
        };
        
        const issues = [];
        
        // Check each stat
        if (expectedStats.hp !== actualStats.hp) {
            issues.push(`HP: expected ${expectedStats.hp}, got ${actualStats.hp}`);
        }
        if (expectedStats.hp !== actualStats.maxHp) {
            issues.push(`MaxHP: expected ${expectedStats.hp}, got ${actualStats.maxHp}`);
        }
        if (expectedStats.damage !== actualStats.damage) {
            issues.push(`Damage: expected ${expectedStats.damage}, got ${actualStats.damage}`);
        }
        if (expectedStats.speed !== actualStats.speed) {
            issues.push(`Speed: expected ${expectedStats.speed}, got ${actualStats.speed}`);
        }
        if (expectedStats.size !== actualStats.size) {
            issues.push(`Size: expected ${expectedStats.size}, got ${actualStats.size}`);
        }
        if (expectedStats.armor !== undefined && expectedStats.armor !== actualStats.armor) {
            issues.push(`Armor: expected ${expectedStats.armor}, got ${actualStats.armor || 'undefined'}`);
        }
        if (expectedStats.xp !== actualStats.xp) {
            issues.push(`XP: expected ${expectedStats.xp}, got ${actualStats.xp}`);
        }
        
        // Also check display size
        const displaySize = {
            width: enemy.displayWidth,
            height: enemy.displayHeight
        };
        
        if (Math.round(displaySize.width) !== expectedStats.size || Math.round(displaySize.height) !== expectedStats.size) {
            issues.push(`Display Size: expected ${expectedStats.size}x${expectedStats.size}, got ${Math.round(displaySize.width)}x${Math.round(displaySize.height)}`);
        }
        
        // Report results
        results.push({
            enemyId: enemyId,
            success: issues.length === 0,
            issues: issues,
            blueprint: expectedStats,
            actual: actualStats,
            displaySize: displaySize
        });
        
        // Clean up
        enemy.destroy();
    });
    
    // Display results
    console.log('\n=== TEST RESULTS ===\n');
    
    let allPassed = true;
    results.forEach(result => {
        if (result.success) {
            console.log(`✅ ${result.enemyId}: All stats match blueprint`);
        } else {
            console.log(`❌ ${result.enemyId}: Stats DO NOT match blueprint`);
            console.log('   Issues found:');
            result.issues.forEach(issue => {
                console.log(`   - ${issue}`);
            });
            allPassed = false;
        }
        
        console.log(`   Blueprint stats:`, result.blueprint);
        console.log(`   Actual stats:`, result.actual);
        console.log(`   Display size: ${Math.round(result.displaySize.width)}x${Math.round(result.displaySize.height)}\n`);
    });
    
    if (allPassed) {
        console.log('✅ ALL TESTS PASSED - PR7 Blueprint compliance verified!');
    } else {
        console.log('❌ TESTS FAILED - Blueprint values are not being properly applied!');
        console.log('\nPR7 VIOLATION: Blueprints are not the single source of truth!');
    }
    
    return results;
};

// Instructions
console.log('Blueprint Compliance Test loaded!');
console.log('Run testBlueprintCompliance() to verify PR7 compliance');
console.log('This will check if hp, damage, speed, size, armor, and xp from blueprints are properly applied.');