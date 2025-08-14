#!/usr/bin/env node
/**
 * Telemetry Validation Script
 * 
 * Validates that all telemetry components are properly integrated.
 * Checks import paths, class definitions, and API exposure.
 */

import { readFile, access } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const requiredFiles = [
    'js/core/TelemetryLogger.js',
    'js/ui/DebugOverlay.js', 
    'js/core/debug/Phase5Debug.js',
    'js/scenes/GameScene.js',
    'data/config/features.json5'
];

const validationChecks = {
    'TelemetryLogger': {
        file: 'js/core/TelemetryLogger.js',
        exports: ['TelemetryLogger'],
        methods: ['logEvent', 'logSpawn', 'logLootDrop', 'logKill', 'getRealtimeStats'],
        features: ['buffering', 'localStorage', 'sessionTracking']
    },
    'DebugOverlay': {
        file: 'js/ui/DebugOverlay.js',
        exports: ['DebugOverlay'],
        methods: ['initialize', 'toggle', 'updateMetrics', 'getMetrics'],
        features: ['F3Toggle', 'realtimeUpdates', 'featureFlags']
    },
    'Phase5Debug': {
        file: 'js/core/debug/Phase5Debug.js',
        exports: ['Phase5Debug'],
        methods: ['dumpTelemetry', 'clearTelemetry', 'getTelemetryStatus', 'exportTelemetryData'],
        features: ['debugAPI', 'windowExposure', 'telemetryCommands']
    },
    'GameScene Integration': {
        file: 'js/scenes/GameScene.js',
        imports: ['TelemetryLogger', 'DebugOverlay', 'Phase5Debug'],
        initialization: ['telemetryLogger', 'newDebugOverlay', 'phase5Debug'],
        hooks: ['recordPlayerDamage', 'recordPlayerDamageTaken', 'updateMetrics']
    }
};

async function validateFile(filePath) {
    try {
        await access(join(projectRoot, filePath));
        return { exists: true, path: filePath };
    } catch (error) {
        return { exists: false, path: filePath, error: error.message };
    }
}

async function analyzeFileContent(filePath, checks) {
    try {
        const fullPath = join(projectRoot, filePath);
        const content = await readFile(fullPath, 'utf8');
        
        const results = {
            filePath,
            size: content.length,
            lines: content.split('\n').length,
            exports: [],
            methods: [],
            features: [],
            issues: []
        };
        
        // Check exports
        if (checks.exports) {
            checks.exports.forEach(exportName => {
                if (content.includes(`export class ${exportName}`) || 
                    content.includes(`export { ${exportName}`)) {
                    results.exports.push(exportName);
                } else {
                    results.issues.push(`Missing export: ${exportName}`);
                }
            });
        }
        
        // Check methods
        if (checks.methods) {
            checks.methods.forEach(method => {
                if (content.includes(`${method}(`)) {
                    results.methods.push(method);
                } else {
                    results.issues.push(`Missing method: ${method}`);
                }
            });
        }
        
        // Check imports in GameScene
        if (checks.imports) {
            checks.imports.forEach(importName => {
                if (content.includes(`import { ${importName}`) || 
                    content.includes(`import ${importName}`)) {
                    results.features.push(`Import: ${importName}`);
                } else {
                    results.issues.push(`Missing import: ${importName}`);
                }
            });
        }
        
        // Check initialization
        if (checks.initialization) {
            checks.initialization.forEach(init => {
                if (content.includes(`this.${init} = new`) || 
                    content.includes(`this.${init} =`)) {
                    results.features.push(`Initialization: ${init}`);
                } else {
                    results.issues.push(`Missing initialization: ${init}`);
                }
            });
        }
        
        // Check feature hooks
        if (checks.hooks) {
            checks.hooks.forEach(hook => {
                if (content.includes(hook)) {
                    results.features.push(`Hook: ${hook}`);
                } else {
                    results.issues.push(`Missing hook: ${hook}`);
                }
            });
        }
        
        return results;
        
    } catch (error) {
        return {
            filePath,
            error: error.message,
            issues: [`Failed to read file: ${error.message}`]
        };
    }
}

async function runValidation() {
    console.log('🔍 Validating Telemetry System Integration...\n');
    
    // Check if all required files exist
    console.log('📁 File Existence Check:');
    const fileResults = await Promise.all(
        requiredFiles.map(file => validateFile(file))
    );
    
    fileResults.forEach(result => {
        const status = result.exists ? '✅' : '❌';
        console.log(`${status} ${result.path}`);
        if (!result.exists) {
            console.log(`   Error: ${result.error}`);
        }
    });
    
    const missingFiles = fileResults.filter(r => !r.exists);
    if (missingFiles.length > 0) {
        console.log(`\n❌ ${missingFiles.length} required files are missing!`);
        return false;
    }
    
    console.log('\n📊 Component Analysis:');
    
    // Analyze each component
    const analysisResults = {};
    for (const [componentName, checks] of Object.entries(validationChecks)) {
        console.log(`\n🔧 ${componentName}:`);
        
        const result = await analyzeFileContent(checks.file, checks);
        analysisResults[componentName] = result;
        
        if (result.error) {
            console.log(`   ❌ Analysis failed: ${result.error}`);
            continue;
        }
        
        console.log(`   📄 File: ${result.filePath} (${result.lines} lines, ${Math.round(result.size/1024)}KB)`);
        
        if (result.exports.length > 0) {
            console.log(`   ✅ Exports: ${result.exports.join(', ')}`);
        }
        
        if (result.methods.length > 0) {
            console.log(`   ✅ Methods: ${result.methods.slice(0, 3).join(', ')}${result.methods.length > 3 ? '...' : ''}`);
        }
        
        if (result.features.length > 0) {
            console.log(`   ✅ Features: ${result.features.slice(0, 3).join(', ')}${result.features.length > 3 ? '...' : ''}`);
        }
        
        if (result.issues.length > 0) {
            console.log(`   ⚠️  Issues:`);
            result.issues.forEach(issue => console.log(`      • ${issue}`));
        }
    }
    
    // Summary
    console.log('\n📋 Validation Summary:');
    
    const totalIssues = Object.values(analysisResults)
        .reduce((sum, result) => sum + (result.issues?.length || 0), 0);
    
    const totalComponents = Object.keys(validationChecks).length;
    const validComponents = Object.values(analysisResults)
        .filter(result => !result.error && (result.issues?.length || 0) === 0).length;
    
    console.log(`Components: ${validComponents}/${totalComponents} valid`);
    console.log(`Issues found: ${totalIssues}`);
    
    if (totalIssues === 0) {
        console.log('\n🎉 Telemetry system validation PASSED!');
        console.log('\nNext steps:');
        console.log('1. Start the game and press F3 to test debug overlay');
        console.log('2. Check browser console for telemetry initialization');
        console.log('3. Use __phase5Debug.telemetry.status() to verify');
        console.log('4. Run a 5-minute test session');
        return true;
    } else {
        console.log('\n❌ Telemetry system validation FAILED!');
        console.log('Please fix the issues above before proceeding.');
        return false;
    }
}

// ConfigResolver feature flags check
async function validateFeatureFlags() {
    console.log('\n🚩 Feature Flags Validation:');
    
    try {
        const configPath = join(projectRoot, 'data/config/features.json5');
        const configContent = await readFile(configPath, 'utf8');
        
        const requiredFlags = [
            'debugOverlay',
            'telemetryLogger', 
            'devConsole',
            'perfProfiler'
        ];
        
        const foundFlags = requiredFlags.filter(flag => 
            configContent.includes(`"${flag}"`) || configContent.includes(`'${flag}'`)
        );
        
        console.log(`✅ Found ${foundFlags.length}/${requiredFlags.length} required feature flags`);
        foundFlags.forEach(flag => console.log(`   • ${flag}`));
        
        const missingFlags = requiredFlags.filter(flag => !foundFlags.includes(flag));
        if (missingFlags.length > 0) {
            console.log('⚠️  Missing flags:');
            missingFlags.forEach(flag => console.log(`   • ${flag}`));
        }
        
        return missingFlags.length === 0;
        
    } catch (error) {
        console.log(`❌ Failed to validate feature flags: ${error.message}`);
        return false;
    }
}

// Main execution
async function main() {
    const validationPassed = await runValidation();
    const flagsValid = await validateFeatureFlags();
    
    const overallSuccess = validationPassed && flagsValid;
    
    console.log(`\n${overallSuccess ? '🎉' : '❌'} Overall validation: ${overallSuccess ? 'PASSED' : 'FAILED'}`);
    
    process.exit(overallSuccess ? 0 : 1);
}

main().catch(error => {
    console.error('❌ Validation script failed:', error);
    process.exit(1);
});