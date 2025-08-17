#!/usr/bin/env node

/**
 * Memory Leak Test
 * Tests for memory leaks by cycling through game states
 * and checking if objects are properly cleaned up
 */

import { fileURLToPath } from 'url';

// Test script to inject into browser
const leakTestScript = `
async function runLeakTest() {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    
    console.log('[LeakTest] 🔍 Starting memory leak test...');
    
    // Helper to get active counts
    function getActiveCounts() {
        const scene = window.game?.scene?.getScene('GameScene');
        if (!scene) return null;
        
        return {
            enemies: scene.enemyManager?.getActiveCount?.() ?? -1,
            projectiles: scene.projectileSystem?.getActiveCount?.() ?? -1,
            loot: scene.simpleLootSystem?.getActiveCount?.() ?? -1,
            vfx: scene.vfxSystem?.getActiveCount?.() ?? -1,
            timers: scene.disposableRegistry?._items?.length ?? -1
        };
    }
    
    // Run one cycle
    async function runCycle(cycleNum) {
        console.log(\`[LeakTest] Cycle \${cycleNum}/3 starting...\`);
        
        // Start game
        window.DEV?.startGame?.();
        await wait(500);
        
        // Spawn some enemies
        window.DEV?.spawnWave?.(5);
        await wait(300);
        
        // Pause
        window.DEV?.pause?.();
        await wait(200);
        
        // Resume
        window.DEV?.resume?.();
        await wait(200);
        
        // Trigger victory
        window.DEV?.victory?.();
        await wait(300);
        
        // Go to menu
        window.DEV?.gotoMainMenu?.();
        await wait(300);
        
        console.log(\`[LeakTest] Cycle \${cycleNum}/3 complete\`);
    }
    
    // Run 3 cycles
    for (let i = 1; i <= 3; i++) {
        await runCycle(i);
    }
    
    // Final check
    console.log('[LeakTest] Waiting for cleanup...');
    await wait(1000);
    
    // Start game one more time to get counts
    window.DEV?.startGame?.();
    await wait(500);
    
    const counts = getActiveCounts();
    console.log('[LeakTest] Active object counts:', counts);
    
    // Check for leaks
    const leaks = [];
    if (counts) {
        if (counts.enemies > 0) leaks.push(\`Enemies: \${counts.enemies}\`);
        if (counts.projectiles > 0) leaks.push(\`Projectiles: \${counts.projectiles}\`);
        if (counts.loot > 0) leaks.push(\`Loot: \${counts.loot}\`);
        if (counts.vfx > 5) leaks.push(\`VFX: \${counts.vfx}\`); // Allow small VFX pool
        if (counts.timers > 10) leaks.push(\`Timers: \${counts.timers}\`); // Allow some system timers
    }
    
    if (leaks.length > 0) {
        console.error('[LeakTest] ❌ Memory leaks detected:', leaks);
        return { success: false, leaks, counts };
    } else {
        console.log('[LeakTest] ✅ No memory leaks detected');
        return { success: true, counts };
    }
}

// Run test
runLeakTest().then(result => {
    if (result.success) {
        console.log('✅ LEAK TEST PASSED');
    } else {
        console.error('❌ LEAK TEST FAILED');
        console.error('Leaks found:', result.leaks);
    }
    
    // Report to parent if automated
    if (window.__leakTestCallback) {
        window.__leakTestCallback(result);
    }
});
`;

// Enhanced version that also checks browser memory
const enhancedLeakTestScript = `
async function runEnhancedLeakTest() {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    
    console.log('[LeakTest] 🔍 Starting enhanced memory leak test...');
    
    // Get initial memory baseline
    let initialMemory = null;
    if (performance.memory) {
        initialMemory = performance.memory.usedJSHeapSize;
        console.log(\`[LeakTest] Initial heap: \${(initialMemory / 1024 / 1024).toFixed(2)} MB\`);
    }
    
    // Track memory over cycles
    const memorySnapshots = [];
    
    // Helper to get comprehensive counts
    function getSystemState() {
        const scene = window.game?.scene?.getScene('GameScene');
        if (!scene) return null;
        
        const state = {
            enemies: scene.enemyManager?.getActiveCount?.() ?? 0,
            projectiles: scene.projectileSystem?.getActiveCount?.() ?? 0,
            loot: scene.simpleLootSystem?.getActiveCount?.() ?? 0,
            vfx: scene.vfxSystem?.getActiveCount?.() ?? 0,
            timers: scene.disposableRegistry?._items?.length ?? 0,
            
            // Additional checks
            enemyGroups: {
                enemies: scene.enemiesGroup?.children?.size ?? 0,
                bosses: scene.bossGroup?.children?.size ?? 0
            },
            
            // Phaser object pools
            tweens: scene.tweens?.getAllTweens?.()?.length ?? 0,
            timers: scene.time?.events?.length ?? 0
        };
        
        // Memory snapshot if available
        if (performance.memory) {
            state.memory = {
                heap: performance.memory.usedJSHeapSize,
                heapMB: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)
            };
        }
        
        return state;
    }
    
    // Run stress cycle
    async function runStressCycle(cycleNum) {
        console.log(\`[LeakTest] 🔄 Stress cycle \${cycleNum}/5...\`);
        
        // Start game
        window.DEV?.startGame?.();
        await wait(500);
        
        // Spawn lots of enemies
        for (let i = 0; i < 3; i++) {
            window.DEV?.spawnWave?.(10, 'enemy.viral_swarm');
            await wait(200);
        }
        
        // Fire projectiles
        window.DEV?.stressTestBullets?.(50);
        await wait(300);
        
        // Spawn boss
        window.DEV?.spawnBoss?.('boss.karcinogenni_kral');
        await wait(200);
        
        // Kill everything
        window.DEV?.killAll?.();
        await wait(200);
        
        // Victory and return to menu
        window.DEV?.victory?.();
        await wait(300);
        window.DEV?.gotoMainMenu?.();
        await wait(300);
        
        // Take snapshot
        const state = getSystemState();
        memorySnapshots.push({ cycle: cycleNum, ...state });
        
        console.log(\`[LeakTest] Cycle \${cycleNum} state:`, state);
    }
    
    // Run 5 stress cycles
    for (let i = 1; i <= 5; i++) {
        await runStressCycle(i);
        
        // Force GC if available (Chrome with --expose-gc flag)
        if (window.gc) {
            window.gc();
            await wait(100);
        }
    }
    
    // Analyze results
    console.log('[LeakTest] 📊 Analyzing results...');
    
    const finalState = getSystemState();
    const issues = [];
    
    // Check for object leaks
    if (finalState.enemies > 0) issues.push(\`Active enemies: \${finalState.enemies}\`);
    if (finalState.projectiles > 0) issues.push(\`Active projectiles: \${finalState.projectiles}\`);
    if (finalState.loot > 0) issues.push(\`Active loot: \${finalState.loot}\`);
    if (finalState.vfx > 10) issues.push(\`Excessive VFX: \${finalState.vfx}\`);
    if (finalState.tweens > 5) issues.push(\`Active tweens: \${finalState.tweens}\`);
    
    // Check memory growth
    if (initialMemory && performance.memory) {
        const currentMemory = performance.memory.usedJSHeapSize;
        const growth = currentMemory - initialMemory;
        const growthMB = growth / 1024 / 1024;
        
        console.log(\`[LeakTest] Memory growth: \${growthMB.toFixed(2)} MB\`);
        
        if (growthMB > 50) {
            issues.push(\`Excessive memory growth: \${growthMB.toFixed(2)} MB\`);
        }
    }
    
    // Report
    const result = {
        success: issues.length === 0,
        issues,
        finalState,
        snapshots: memorySnapshots,
        memoryGrowth: initialMemory ? 
            ((performance.memory.usedJSHeapSize - initialMemory) / 1024 / 1024).toFixed(2) + ' MB' : 
            'N/A'
    };
    
    if (result.success) {
        console.log('[LeakTest] ✅ No memory leaks detected!');
    } else {
        console.error('[LeakTest] ❌ Memory issues detected:', issues);
    }
    
    return result;
}

// Run enhanced test
runEnhancedLeakTest().then(result => {
    console.log('════════════════════════════════════════');
    if (result.success) {
        console.log('✅ ENHANCED LEAK TEST PASSED');
    } else {
        console.error('❌ ENHANCED LEAK TEST FAILED');
        console.error('Issues:', result.issues);
    }
    console.log('Memory growth:', result.memoryGrowth);
    console.log('════════════════════════════════════════');
    
    if (window.__leakTestCallback) {
        window.__leakTestCallback(result);
    }
});
`;

// Export for use in automated testing
export { leakTestScript, enhancedLeakTestScript };

// If running directly, print the script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    console.log('📋 Memory Leak Test Scripts\n');
    console.log('Basic test (copy to browser console):');
    console.log('─'.repeat(60));
    console.log(leakTestScript);
    console.log('─'.repeat(60));
    console.log('\nEnhanced test with memory tracking:');
    console.log('─'.repeat(60));
    console.log(enhancedLeakTestScript);
    console.log('─'.repeat(60));
    console.log('\n💡 Tip: For memory profiling in Chrome, use --expose-gc flag');
}