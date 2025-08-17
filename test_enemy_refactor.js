/**
 * Test script for Enemy refactor
 * Checks if all components load correctly
 */

console.log('=== Enemy Refactor Test ===');

// Test imports
async function testImports() {
    try {
        console.log('Testing imports...');
        
        // Try to import each module
        const modules = [
            './js/entities/core/EnemyCore.js',
            './js/entities/EnemyBehaviors.js',
            './js/entities/ai/behaviors/idle.js',
            './js/entities/ai/behaviors/chase.js',
            './js/entities/ai/behaviors/shoot.js',
            './js/entities/Enemy.js'
        ];
        
        for (const mod of modules) {
            try {
                const imported = await import(mod);
                console.log(`✓ ${mod} loaded successfully`);
                
                // Check exports
                if (imported.default) {
                    console.log(`  - Has default export: ${imported.default.name || typeof imported.default}`);
                }
                const namedExports = Object.keys(imported).filter(k => k !== 'default');
                if (namedExports.length > 0) {
                    console.log(`  - Named exports: ${namedExports.join(', ')}`);
                }
            } catch (err) {
                console.error(`✗ Failed to load ${mod}:`, err.message);
            }
        }
        
        console.log('\n=== Import Test Complete ===');
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run test
testImports();