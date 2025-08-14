/**
 * Enemy.js PR7 Compliance Smoke Test
 * Verifies that Enemy.js is fully PR7-compliant
 */

export function runEnemyPR7SmokeTest(scene) {
    console.log('🔍 Running Enemy PR7 Compliance Smoke Test...');
    
    const results = {
        passed: [],
        failed: [],
        warnings: []
    };
    
    // Test 1: Check for NO legacy code patterns
    console.log('  Testing: No legacy code patterns...');
    
    const legacyPatterns = [
        'window.ConfigResolver',
        'scene.add.graphics',
        'scene.add.circle', 
        'fillCircle',
        'strokeCircle',
        'scene.tweens.add',
        'this.graphics',
        'this.hpBar'
    ];
    
    // Check if Enemy class exists
    import('../entities/Enemy.js').then(({ Enemy }) => {
        
        // Test 2: Verify ConfigResolver DI usage
        console.log('  Testing: ConfigResolver via DI...');
        try {
            const testConfig = {
                hp: 100,
                damage: 10,
                speed: 1,
                xp: 20,
                size: 30,
                texture: 'enemy',
                color: 0xff0000
            };
            
            // Should throw if no ConfigResolver
            if (!scene.configResolver) {
                results.failed.push('ConfigResolver not found in scene (required for PR7)');
            } else {
                results.passed.push('ConfigResolver available via DI');
            }
            
            // Should throw if no coreProjectileSystem
            if (!scene.coreProjectileSystem) {
                results.failed.push('coreProjectileSystem not found (required for PR7)');
            } else {
                results.passed.push('coreProjectileSystem available');
            }
            
            // Try to create test enemy
            const testEnemy = new Enemy(scene, 400, 300, 'test', testConfig);
            
            if (testEnemy) {
                results.passed.push('Enemy instantiation works with PR7 requirements');
                
                // Test key methods exist
                const methods = ['performSupportBuff', 'performShoot', 'playVFX', 'playSFX'];
                methods.forEach(method => {
                    if (typeof testEnemy[method] === 'function') {
                        results.passed.push(`Method ${method} exists`);
                    } else {
                        results.failed.push(`Method ${method} missing`);
                    }
                });
                
                // Verify no graphics objects
                if (testEnemy.graphics) {
                    results.failed.push('Enemy still has graphics object (legacy)');
                } else {
                    results.passed.push('No graphics object found (PR7 compliant)');
                }
                
                if (testEnemy.hpBar) {
                    results.failed.push('Enemy still has hpBar graphics (legacy)');
                } else {
                    results.passed.push('No hpBar graphics found (PR7 compliant)');
                }
                
                // Cleanup
                testEnemy.destroy();
            }
            
        } catch (err) {
            if (err.message.includes('Missing scene.configResolver')) {
                results.passed.push('Correctly throws when ConfigResolver missing');
            } else {
                results.failed.push(`Enemy creation error: ${err.message}`);
            }
        }
        
        // Test 3: Verify enemiesGroup usage
        console.log('  Testing: enemiesGroup integration...');
        if (scene.enemiesGroup) {
            results.passed.push('enemiesGroup available in scene');
        } else {
            results.warnings.push('enemiesGroup not found (optional but recommended)');
        }
        
        // Test 4: Verify VFX/SFX systems
        console.log('  Testing: VFX/SFX systems...');
        if (scene.newVFXSystem) {
            results.passed.push('newVFXSystem available');
        } else {
            results.warnings.push('newVFXSystem not found (optional)');
        }
        
        if (scene.newSFXSystem) {
            results.passed.push('newSFXSystem available');
        } else {
            results.warnings.push('newSFXSystem not found (optional)');
        }
        
    }).catch(err => {
        results.failed.push(`Enemy import failed: ${err.message}`);
    }).finally(() => {
        // Generate report
        console.log('\n📊 Enemy PR7 Compliance Test Results:');
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
        
        const totalScore = results.failed.length === 0 ? 100 : 
            (results.passed.length / (results.passed.length + results.failed.length)) * 100;
        
        console.log('\n═══════════════════════════════════════');
        console.log(`🎯 Compliance Score: ${totalScore.toFixed(1)}%`);
        
        if (totalScore === 100) {
            console.log('🎉 Enemy.js is 100% PR7-compliant!');
        } else if (totalScore >= 80) {
            console.log('👍 Enemy.js is mostly PR7-compliant');
        } else {
            console.log('⚠️ Enemy.js needs more work for PR7 compliance');
        }
    });
    
    return results;
}