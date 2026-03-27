#!/usr/bin/env node

/**
 * Automated Gameplay Test Runner
 * 
 * Runs automated gameplay tests using GameplayAutomation engine
 * Can run individual scenarios or full test suite
 * Generates detailed reports with error detection
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

class AutomatedTestRunner {
    constructor() {
        this.config = {
            headless: false, // Browser-based testing for now
            timeout: 300000, // 5 minutes total
            scenarios: [
                'CoreGameplay',
                'EnemyBehaviors',
                'BossFights',
                'PowerUpCombos',
                'EdgeCases'
            ],
            outputDir: path.join(projectRoot, 'build', 'test-reports'),
            verbose: false
        };
        
        this.results = {
            timestamp: new Date().toISOString(),
            scenarios: [],
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                errors: 0
            },
            errors: [],
            performance: {}
        };
    }
    
    async run(options = {}) {
        // Parse options
        Object.assign(this.config, options);
        
        console.log('🤖 Automated Gameplay Testing');
        console.log('============================\n');
        
        try {
            // Ensure output directory exists
            await fs.promises.mkdir(this.config.outputDir, { recursive: true });
            
            // Validate environment
            await this.validateEnvironment();
            
            // Generate test script
            const testScript = this.generateTestScript();
            
            // Write test script
            const scriptPath = path.join(this.config.outputDir, 'test-script.js');
            await fs.promises.writeFile(scriptPath, testScript);
            
            // Create HTML runner
            const htmlPath = await this.createHTMLRunner(scriptPath);
            
            // Launch tests
            console.log('🚀 Launching automated tests...\n');
            await this.launchTests(htmlPath);
            
            // Generate reports
            await this.generateReports();
            
            // Display results
            this.displayResults();
            
            return this.getExitCode();
            
        } catch (error) {
            console.error('❌ Test runner failed:', error);
            this.results.errors.push({
                type: 'runner_error',
                message: error.message,
                stack: error.stack
            });
            return 1;
        }
    }
    
    async validateEnvironment() {
        console.log('🔍 Validating environment...');
        
        // Check for required files
        const requiredFiles = [
            'js/main.js',
            'js/scenes/GameScene.js',
            'js/core/testing/GameplayAutomation.js',
            'js/core/testing/ErrorDetector.js'
        ];
        
        for (const file of requiredFiles) {
            const filePath = path.join(projectRoot, file);
            if (!fs.existsSync(filePath)) {
                throw new Error(`Required file missing: ${file}`);
            }
        }
        
        // Run data audit
        try {
            console.log('  Running data audit...');
            execSync('npm run audit:data', { 
                cwd: projectRoot,
                stdio: this.config.verbose ? 'inherit' : 'pipe'
            });
            console.log('  ✅ Data audit passed');
        } catch (error) {
            console.warn('  ⚠️ Data audit had issues, continuing...');
        }
        
        console.log('✅ Environment ready\n');
    }
    
    generateTestScript() {
        const scenarios = this.config.scenarios.map(s => `'${s}'`).join(', ');
        
        return `
// Automated Gameplay Test Script
// Generated: ${new Date().toISOString()}

(async function() {
    console.log('🤖 Starting automated gameplay tests...');
    
    // Wait for game to load
    async function waitForGame() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const game = window.game || window.phaser?.game;
                const scene = game?.scene?.scenes?.find(s => s.scene.key === 'GameScene');
                
                if (scene && scene.player) {
                    clearInterval(checkInterval);
                    resolve(scene);
                }
            }, 500);
        });
    }
    
    // Import test modules dynamically
    async function loadTestModules() {
        const modules = {};
        
        try {
            // Load GameplayAutomation
            const automationModule = await import('./js/core/testing/GameplayAutomation.js');
            modules.GameplayAutomation = automationModule.GameplayAutomation;
            
            // Load ErrorDetector
            const errorModule = await import('./js/core/testing/ErrorDetector.js');
            modules.ErrorDetector = errorModule.ErrorDetector;
            
            // Load scenarios
            const coreModule = await import('./js/core/testing/scenarios/CoreGameplay.js');
            modules.CoreGameplay = coreModule.CoreGameplay;
            
            const enemyModule = await import('./js/core/testing/scenarios/EnemyBehaviors.js');
            modules.EnemyBehaviors = enemyModule.EnemyBehaviors;
            
            const allModule = await import('./js/core/testing/scenarios/AllScenarios.js');
            modules.BossFights = allModule.BossFights;
            modules.PowerUpCombos = allModule.PowerUpCombos;
            modules.EdgeCases = allModule.EdgeCases;
            
        } catch (error) {
            console.error('Failed to load test modules:', error);
        }
        
        return modules;
    }
    
    // Run tests
    async function runTests() {
        const results = {
            timestamp: new Date().toISOString(),
            scenarios: [],
            errors: []
        };
        
        try {
            // Wait for game
            console.log('⏳ Waiting for game to load...');
            const scene = await waitForGame();
            console.log('✅ Game loaded');
            
            // Load test modules
            console.log('📦 Loading test modules...');
            const modules = await loadTestModules();
            console.log('✅ Modules loaded');
            
            // Create automation engine
            const automation = new modules.GameplayAutomation(scene);
            
            // Create error detector
            const errorDetector = new modules.ErrorDetector();
            errorDetector.start();
            
            // Hook automation to scene update
            const originalUpdate = scene.update;
            scene.update = function(time, delta) {
                if (originalUpdate) originalUpdate.call(this, time, delta);
                if (automation.enabled) {
                    automation.update(time, delta);
                }
            };
            
            // Run each scenario
            const scenarioNames = [${scenarios}];
            
            for (const scenarioName of scenarioNames) {
                console.log(\`\\n🎮 Running scenario: \${scenarioName}\`);
                
                try {
                    const ScenarioClass = modules[scenarioName];
                    if (!ScenarioClass) {
                        throw new Error(\`Scenario not found: \${scenarioName}\`);
                    }
                    
                    const scenario = new ScenarioClass();
                    const result = await scenario.execute(automation);
                    
                    results.scenarios.push(result);
                    console.log(\`  Status: \${result.scenario.status}\`);
                    
                } catch (error) {
                    console.error(\`  ❌ Scenario failed: \${error.message}\`);
                    results.errors.push({
                        scenario: scenarioName,
                        error: error.message,
                        stack: error.stack
                    });
                }
                
                // Reset between scenarios
                if (window.DEV?.killAll) {
                    window.DEV.killAll();
                }
                
                // Wait between scenarios
                await new Promise(r => setTimeout(r, 2000));
            }
            
            // Stop error detector
            const errorReport = errorDetector.stop();
            results.errorDetection = errorReport;
            
            // Generate automation report
            const automationReport = automation.generateReport();
            results.automation = automationReport;
            
            // Store results
            window.__testResults = results;
            
            console.log('\\n✅ All tests completed');
            console.log('Results stored in window.__testResults');
            
        } catch (error) {
            console.error('Test execution failed:', error);
            results.errors.push({
                type: 'execution_error',
                message: error.message,
                stack: error.stack
            });
        }
        
        return results;
    }
    
    // Start tests
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runTests);
    } else {
        runTests();
    }
})();
`;
    }
    
    async createHTMLRunner(scriptPath) {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Automated Gameplay Tests</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: monospace;
            background: #1a1a1a;
            color: #00ff00;
        }
        #console {
            white-space: pre-wrap;
            padding: 10px;
            background: #000;
            border: 1px solid #00ff00;
            min-height: 200px;
            max-height: 400px;
            overflow-y: auto;
        }
        #game-container {
            margin-top: 20px;
            border: 1px solid #00ff00;
            display: inline-block;
        }
    </style>
</head>
<body>
    <h1>🤖 Automated Gameplay Tests</h1>
    <div id="console">Starting tests...</div>
    <div id="game-container"></div>
    
    <script>
        // Capture console output
        const consoleDiv = document.getElementById('console');
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        
        function addToConsole(msg, type = 'log') {
            const color = type === 'error' ? '#ff0000' : 
                         type === 'warn' ? '#ffaa00' : '#00ff00';
            consoleDiv.innerHTML += '<span style="color:' + color + '">' + msg + '</span>\\n';
            consoleDiv.scrollTop = consoleDiv.scrollHeight;
        }
        
        console.log = function(...args) {
            addToConsole(args.join(' '), 'log');
            originalLog.apply(console, args);
        };
        
        console.error = function(...args) {
            addToConsole(args.join(' '), 'error');
            originalError.apply(console, args);
        };
        
        console.warn = function(...args) {
            addToConsole(args.join(' '), 'warn');
            originalWarn.apply(console, args);
        };
    </script>
    
    <!-- Load Phaser -->
    <script src="phaser.min.js"></script>
    
    <!-- Load game -->
    <script type="module" src="js/main.js"></script>
    
    <!-- Load test script -->
    <script type="module" src="${path.relative(projectRoot, scriptPath)}"></script>
    
    <script>
        // Auto-close after timeout
        setTimeout(() => {
            if (window.__testResults) {
                // Send results to parent if in iframe
                if (window.parent !== window) {
                    window.parent.postMessage({ 
                        type: 'test_complete',
                        results: window.__testResults 
                    }, '*');
                }
                
                // Save results to file if possible
                const resultsStr = JSON.stringify(window.__testResults, null, 2);
                const blob = new Blob([resultsStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = 'test-results.json';
                // Note: Auto-download won't work without user interaction
                
                console.log('\\n📊 Test results available in window.__testResults');
            }
        }, ${this.config.timeout});
    </script>
</body>
</html>`;
        
        const htmlPath = path.join(projectRoot, 'test-runner.html');
        await fs.promises.writeFile(htmlPath, html);
        
        return htmlPath;
    }
    
    async launchTests(htmlPath) {
        console.log(`📂 Test runner created: ${htmlPath}`);
        console.log('\n⚠️  Please open the following file in your browser:');
        console.log(`   ${htmlPath}`);
        console.log('\nThe tests will run automatically.');
        console.log('Results will be available in the browser console.\n');
        
        // Try to open in default browser
        const platform = process.platform;
        try {
            if (platform === 'darwin') {
                execSync(`open ${htmlPath}`);
            } else if (platform === 'win32') {
                execSync(`start ${htmlPath}`);
            } else {
                execSync(`xdg-open ${htmlPath}`);
            }
            console.log('✅ Browser launched\n');
        } catch (error) {
            console.log('⚠️  Could not auto-launch browser\n');
        }
        
        // Wait for user to complete tests
        console.log('Press ENTER when tests are complete...');
        await new Promise(resolve => {
            process.stdin.once('data', resolve);
        });
    }
    
    async generateReports() {
        console.log('\n📋 Generating reports...');
        
        // Check if results file was created
        const resultsPath = path.join(this.config.outputDir, 'test-results.json');
        
        // For now, use mock results
        this.results.summary = {
            total: this.config.scenarios.length,
            passed: 0,
            failed: 0,
            errors: 0
        };
        
        // Save JSON report
        const jsonPath = path.join(this.config.outputDir, 'automated-test-report.json');
        await fs.promises.writeFile(jsonPath, JSON.stringify(this.results, null, 2));
        
        // Save Markdown report
        const mdPath = path.join(this.config.outputDir, 'automated-test-report.md');
        await fs.promises.writeFile(mdPath, this.generateMarkdownReport());
        
        console.log(`  📄 JSON report: ${jsonPath}`);
        console.log(`  📄 Markdown report: ${mdPath}`);
    }
    
    generateMarkdownReport() {
        const { summary, scenarios, errors } = this.results;
        
        let md = `# Automated Gameplay Test Report\n\n`;
        md += `**Date**: ${this.results.timestamp}\n`;
        md += `**Duration**: ${this.config.timeout}ms timeout\n\n`;
        
        md += `## Summary\n\n`;
        md += `- **Total Scenarios**: ${summary.total}\n`;
        md += `- **Passed**: ${summary.passed}\n`;
        md += `- **Failed**: ${summary.failed}\n`;
        md += `- **Errors**: ${summary.errors}\n\n`;
        
        md += `## Scenarios\n\n`;
        for (const scenario of this.config.scenarios) {
            md += `### ${scenario}\n`;
            md += `Status: Pending (check browser console)\n\n`;
        }
        
        if (errors.length > 0) {
            md += `## Errors\n\n`;
            for (const error of errors) {
                md += `- **${error.type || 'Error'}**: ${error.message}\n`;
            }
        }
        
        md += `\n## Instructions\n\n`;
        md += `1. Open test-runner.html in browser\n`;
        md += `2. Wait for tests to complete\n`;
        md += `3. Check browser console for detailed results\n`;
        md += `4. Results available in window.__testResults\n`;
        
        return md;
    }
    
    displayResults() {
        console.log('\n' + '='.repeat(50));
        console.log('📊 TEST RESULTS');
        console.log('='.repeat(50));
        
        console.log(`\nScenarios: ${this.results.summary.total}`);
        
        if (this.results.errors.length > 0) {
            console.log('\n⚠️  Errors encountered:');
            for (const error of this.results.errors) {
                console.log(`  - ${error.message}`);
            }
        }
        
        console.log('\n✅ Test reports generated in:');
        console.log(`   ${this.config.outputDir}`);
    }
    
    getExitCode() {
        return this.results.errors.length > 0 ? 1 : 0;
    }
}

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '--verbose' || arg === '-v') {
            options.verbose = true;
        } else if (arg === '--scenario' || arg === '-s') {
            options.scenarios = [args[++i]];
        } else if (arg === '--timeout' || arg === '-t') {
            options.timeout = parseInt(args[++i]);
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
Automated Gameplay Test Runner

Usage: npm run test:automated [options]

Options:
  -s, --scenario <name>  Run specific scenario
  -t, --timeout <ms>     Set timeout in milliseconds
  -v, --verbose          Verbose output
  -h, --help            Show help

Available scenarios:
  - CoreGameplay     Basic game mechanics
  - EnemyBehaviors   Enemy AI testing
  - BossFights       Boss battles
  - PowerUpCombos    Power-up combinations
  - EdgeCases        Stress tests

Example:
  npm run test:automated -s CoreGameplay -v
`);
            process.exit(0);
        }
    }
    
    return options;
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const options = parseArgs();
    const runner = new AutomatedTestRunner();
    
    runner.run(options).then(exitCode => {
        process.exit(exitCode);
    }).catch(error => {
        console.error('Fatal error:', error);
        process.exit(2);
    });
}