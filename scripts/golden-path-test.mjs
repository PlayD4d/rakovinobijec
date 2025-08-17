#!/usr/bin/env node

/**
 * Golden Path Smoke Test
 * Automated test of main game flow using DEV API
 * 
 * Flow:
 * 1. Start → Level-up → Power-up → Continue
 * 2. Pause → Resume
 * 3. Level transition → Boss → Victory → Menu
 * 4. Restart
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper for delays
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test script to inject into browser
const testScript = `
async function runGoldenPathTest() {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const errors = [];
    
    try {
        console.log('[GoldenPath] 🚀 Starting test...');
        
        // Check if DEV API is available
        if (!window.DEV) {
            throw new Error('DEV API not available');
        }
        
        // 1. Start game
        console.log('[GoldenPath] 1️⃣ Starting game...');
        window.DEV.startGame();
        await wait(1000);
        
        // Give XP to trigger level-up
        console.log('[GoldenPath] 2️⃣ Triggering level-up...');
        window.DEV.giveXP(1000);
        await wait(500);
        
        // Select first power-up
        console.log('[GoldenPath] 3️⃣ Selecting power-up...');
        window.DEV.selectPowerUp(0);
        await wait(500);
        
        // 2. Pause and resume
        console.log('[GoldenPath] 4️⃣ Testing pause/resume...');
        window.DEV.pause();
        await wait(300);
        window.DEV.resume();
        await wait(300);
        
        // 3. Level transition
        console.log('[GoldenPath] 5️⃣ Forcing level transition...');
        window.DEV.forceLevelTransition();
        await wait(500);
        
        // Spawn boss
        console.log('[GoldenPath] 6️⃣ Spawning boss...');
        window.DEV.spawnBoss('boss.karcinogenni_kral');
        await wait(500);
        
        // Kill all enemies (simulate victory)
        console.log('[GoldenPath] 7️⃣ Killing all enemies...');
        window.DEV.killAll();
        await wait(300);
        
        // Trigger victory
        console.log('[GoldenPath] 8️⃣ Triggering victory...');
        window.DEV.victory();
        await wait(500);
        
        // Go to main menu
        console.log('[GoldenPath] 9️⃣ Returning to menu...');
        window.DEV.gotoMainMenu();
        await wait(500);
        
        // 4. Restart game
        console.log('[GoldenPath] 🔟 Restarting game...');
        window.DEV.startGame();
        await wait(500);
        
        console.log('[GoldenPath] ✅ Test completed successfully!');
        return { success: true, errors: [] };
        
    } catch (error) {
        console.error('[GoldenPath] ❌ Test failed:', error);
        errors.push(error.message);
        return { success: false, errors };
    }
}

// Run test and report results
runGoldenPathTest().then(result => {
    if (result.success) {
        console.log('✅ GOLDEN PATH TEST PASSED');
    } else {
        console.error('❌ GOLDEN PATH TEST FAILED');
        console.error('Errors:', result.errors);
    }
    // Send result to parent process if running in automated mode
    if (window.__goldenPathCallback) {
        window.__goldenPathCallback(result);
    }
});
`;

// Run test in headless mode (requires puppeteer)
async function runHeadless() {
    console.log('🎮 Running Golden Path Test in headless mode...');
    console.log('Note: This requires puppeteer. For manual testing, copy the script to browser console.');
    
    try {
        // Try to import puppeteer
        const puppeteer = await import('puppeteer').catch(() => null);
        
        if (!puppeteer) {
            console.log('\n📋 Puppeteer not installed. To run headless:');
            console.log('   npm install --save-dev puppeteer');
            console.log('\n🖥️  For manual testing, open the game and run this in console:');
            console.log('─'.repeat(60));
            console.log(testScript);
            console.log('─'.repeat(60));
            return;
        }
        
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Listen for console logs
        page.on('console', msg => {
            if (msg.text().includes('[GoldenPath]')) {
                console.log(msg.text());
            }
        });
        
        // Navigate to game
        const gameUrl = process.env.GAME_URL || 'http://localhost:8080';
        console.log(`📍 Navigating to ${gameUrl}...`);
        await page.goto(gameUrl, { waitUntil: 'networkidle2' });
        
        // Wait for game to load
        await page.waitForFunction(() => window.game?.scene, { timeout: 10000 });
        
        // Inject and run test
        const result = await page.evaluate(testScript);
        
        await browser.close();
        
        // Exit with appropriate code
        process.exit(result.success ? 0 : 1);
        
    } catch (error) {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    }
}

// Check if running directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runHeadless();
}

export { testScript, runHeadless };