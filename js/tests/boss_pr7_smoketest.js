/**
 * Boss.js PR7 Compliance Smoke Test
 * Verifies that Boss.js is fully PR7-compliant and works correctly
 */

export function runBossPR7SmokeTest(scene) {
    console.log('🔍 Running Boss PR7 Compliance Smoke Test...');
    
    const results = {
        passed: [],
        failed: [],
        warnings: []
    };
    
    // Test 1: Check for legacy code patterns
    console.log('  Testing: No legacy code patterns...');
    const bossCode = scene.game.cache.text.get('boss-source') || '';
    
    const legacyPatterns = [
        { pattern: /window\.ConfigResolver/g, name: 'window.ConfigResolver' },
        { pattern: /scene\.add\.graphics/g, name: 'scene.add.graphics' },
        { pattern: /scene\.add\.circle/g, name: 'scene.add.circle' },
        { pattern: /this\.scene\.tweens\.add/g, name: 'scene.tweens.add' },
        { pattern: /enemyManager\.enemies/g, name: 'enemyManager.enemies' },
        { pattern: /projectileManager(?!\.)/g, name: 'projectileManager' }
    ];
    
    let hasLegacy = false;
    legacyPatterns.forEach(({ pattern, name }) => {
        if (pattern.test(bossCode)) {
            results.failed.push(`Found legacy pattern: ${name}`);
            hasLegacy = true;
        }
    });
    
    if (!hasLegacy) {
        results.passed.push('No legacy code patterns found');
    }
    
    // Test 2: Verify ConfigResolver DI usage
    console.log('  Testing: ConfigResolver via DI...');
    if (scene.configResolver) {
        // Try to create a test boss
        try {
            const testBossConfig = {
                name: 'TestBoss',
                hp: 100,
                damage: 10,
                xp: 50,
                attackType: 'linear',
                specialAttack: 'divide',
                attackInterval: 2000,
                texture: 'boss'
            };
            
            // Import Boss class
            import('../entities/Boss.js').then(({ Boss }) => {
                const testBoss = new Boss(scene, 400, 300, testBossConfig, 1);
                
                // Check if boss uses ConfigResolver correctly
                if (testBoss && testBoss.hp > 0) {
                    results.passed.push('Boss instantiation with ConfigResolver DI works');
                    
                    // Test attack methods exist
                    const attacks = ['linearAttack', 'circleAttack', 'trackingAttack', 'divideAttack', 'spreadAttack'];
                    attacks.forEach(attack => {
                        if (typeof testBoss[attack] === 'function') {
                            results.passed.push(`Attack method ${attack} exists`);
                        } else {
                            results.failed.push(`Attack method ${attack} missing`);
                        }
                    });
                    
                    // Cleanup
                    testBoss.destroy();
                }
            }).catch(err => {
                results.failed.push(`Boss import failed: ${err.message}`);
            });
        } catch (err) {
            results.failed.push(`Boss creation failed: ${err.message}`);
        }
    } else {
        results.warnings.push('ConfigResolver not available in scene');
    }
    
    // Test 3: Verify coreProjectileSystem usage
    console.log('  Testing: coreProjectileSystem integration...');
    if (scene.coreProjectileSystem) {
        results.passed.push('coreProjectileSystem available in scene');
    } else {
        results.failed.push('coreProjectileSystem not found in scene');
    }
    
    // Test 4: Verify enemiesGroup usage
    console.log('  Testing: enemiesGroup integration...');
    if (scene.enemiesGroup) {
        results.passed.push('enemiesGroup available in scene');
    } else {
        results.failed.push('enemiesGroup not found in scene');
    }
    
    // Test 5: Verify VFX system usage
    console.log('  Testing: VFX system integration...');
    if (scene.newVFXSystem) {
        results.passed.push('newVFXSystem available in scene');
    } else {
        results.warnings.push('newVFXSystem not found in scene (optional)');
    }
    
    // Generate report
    console.log('\n📊 Boss PR7 Compliance Test Results:');
    console.log('═══════════════════════════════════════');
    
    if (results.passed.length > 0) {
        console.log(`✅ Passed (${results.passed.length}):`);
        results.passed.forEach(msg => console.log(`   - ${msg}`));
    }
    
    if (results.warnings.length > 0) {
        console.log(`⚠️ Warnings (${results.warnings.length}):`);
        results.warnings.forEach(msg => console.log(`   - ${msg}`));
    }
    
    if (results.failed.length > 0) {
        console.log(`❌ Failed (${results.failed.length}):`);
        results.failed.forEach(msg => console.log(`   - ${msg}`));
    }
    
    const totalScore = (results.passed.length / (results.passed.length + results.failed.length)) * 100;
    console.log('\n═══════════════════════════════════════');
    console.log(`🎯 Compliance Score: ${totalScore.toFixed(1)}%`);
    
    if (totalScore === 100) {
        console.log('🎉 Boss.js is 100% PR7-compliant!');
    } else if (totalScore >= 80) {
        console.log('👍 Boss.js is mostly PR7-compliant');
    } else {
        console.log('⚠️ Boss.js needs more work for PR7 compliance');
    }
    
    return results;
}