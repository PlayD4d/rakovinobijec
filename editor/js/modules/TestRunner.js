/**
 * TestRunner.js - Test blueprints in a minimal game environment
 * Spawns entities and provides basic testing functionality
 */

export class TestRunner {
    constructor(editor) {
        this.editor = editor;
        this.currentBlueprint = null;
        this.isRunning = false;
        this.testOutput = [];
        this.maxOutputLines = 100;
        
        this.init();
    }
    
    init() {
        // Get DOM elements
        this.outputContainer = document.getElementById('test-output');
        
        // Setup button handlers
        document.getElementById('btn-spawn').addEventListener('click', () => this.spawn());
        document.getElementById('btn-reset').addEventListener('click', () => this.reset());
        document.getElementById('btn-pause').addEventListener('click', () => this.pause());
        
        // Listen to editor events
        this.editor.on('blueprint:loaded', (data) => {
            this.currentBlueprint = data.blueprint;
            this.updateButtons();
        });
        
        this.editor.on('test:run', (blueprint) => {
            this.currentBlueprint = blueprint;
            this.spawn();
        });
        
        // Initialize output
        this.log('Test Runner initialized');
        this.log('Load a blueprint to begin testing');
    }
    
    /**
     * Spawn entity for testing
     */
    spawn() {
        if (!this.currentBlueprint) {
            this.error('No blueprint loaded');
            return;
        }
        
        this.log(`Spawning ${this.currentBlueprint.id}...`);
        
        try {
            // Validate blueprint first
            const validation = this.editor.schemaValidator.validate(this.currentBlueprint);
            
            if (!validation.valid) {
                this.error(`Blueprint validation failed:`);
                validation.errors.forEach(err => this.error(`  • ${err}`));
                return;
            }
            
            if (validation.warnings.length > 0) {
                this.warn(`Blueprint has warnings:`);
                validation.warnings.forEach(warn => this.warn(`  • ${warn}`));
            }
            
            // Test different entity types
            switch (this.currentBlueprint.type) {
                case 'enemy':
                case 'elite':
                case 'unique':
                    this.testEnemy();
                    break;
                    
                case 'boss':
                    this.testBoss();
                    break;
                    
                case 'powerup':
                    this.testPowerup();
                    break;
                    
                case 'projectile':
                    this.testProjectile();
                    break;
                    
                case 'spawn':
                    this.testSpawnTable();
                    break;
                    
                default:
                    this.warn(`Testing for ${this.currentBlueprint.type} not implemented`);
                    this.testGeneric();
            }
            
        } catch (error) {
            this.error(`Test failed: ${error.message}`);
            console.error(error);
        }
    }
    
    /**
     * Test enemy blueprint
     */
    testEnemy() {
        const bp = this.currentBlueprint;
        
        this.log('=== Enemy Test ===');
        this.log(`ID: ${bp.id}`);
        this.log(`Type: ${bp.type}`);
        
        // Test stats
        if (bp.stats) {
            this.log('Stats:');
            this.log(`  HP: ${bp.stats.hp || 'not set'}`);
            this.log(`  Damage: ${bp.stats.damage || 'not set'}`);
            this.log(`  Speed: ${bp.stats.speed || 'not set'}`);
            this.log(`  Size: ${bp.stats.size || 'not set'}`);
            this.log(`  Armor: ${bp.stats.armor || 'not set'}`);
            this.log(`  XP: ${bp.stats.xp || 'not set'}`);
            
            // Validate ranges
            if (bp.stats.hp && bp.stats.hp <= 0) this.error('HP must be > 0');
            if (bp.stats.damage && bp.stats.damage < 0) this.error('Damage must be >= 0');
            if (bp.stats.speed && bp.stats.speed < 0) this.error('Speed must be >= 0');
        } else {
            this.error('Missing stats object');
        }
        
        // Test AI
        if (bp.ai) {
            this.log(`AI Behavior: ${bp.ai.behavior || 'not set'}`);
            if (bp.ai.params) {
                this.log(`  Aggro Range: ${bp.ai.params.aggroRange || 'not set'}`);
            }
        } else {
            this.warn('No AI configuration');
        }
        
        // Test graphics
        if (bp.graphics || bp.visuals) {
            const gfx = bp.graphics || bp.visuals;
            this.log(`Graphics: ${gfx.sprite || 'no sprite'}`);
            if (gfx.tint) this.log(`  Tint: ${this.formatColor(gfx.tint)}`);
        }
        
        // Simulate spawn
        this.log('Simulating spawn...');
        this.success('Enemy spawn test completed');
    }
    
    /**
     * Test boss blueprint
     */
    testBoss() {
        const bp = this.currentBlueprint;
        
        this.log('=== Boss Test ===');
        this.log(`ID: ${bp.id}`);
        this.log(`Name: ${bp.name || bp.id}`);
        
        // Test mechanics
        if (bp.mechanics) {
            this.log('Mechanics:');
            
            // Test phases
            if (bp.mechanics.phases) {
                this.log(`  Phases: ${bp.mechanics.phases.length}`);
                bp.mechanics.phases.forEach((phase, i) => {
                    this.log(`    Phase ${i + 1}: ${phase.id || 'unnamed'}`);
                    this.log(`      Threshold: ${(phase.thresholdPct * 100).toFixed(1)}%`);
                    this.log(`      Abilities: ${phase.abilities?.length || 0}`);
                });
            } else {
                this.error('Boss missing phases');
            }
            
            // Test abilities
            if (bp.mechanics.abilities) {
                const abilityCount = Object.keys(bp.mechanics.abilities).length;
                this.log(`  Total Abilities: ${abilityCount}`);
                
                for (const [id, ability] of Object.entries(bp.mechanics.abilities)) {
                    this.log(`    ${id}:`);
                    if (ability.damage) this.log(`      Damage: ${ability.damage}`);
                    if (ability.cooldown) this.log(`      Cooldown: ${ability.cooldown}ms`);
                    if (ability.range) this.log(`      Range: ${ability.range}`);
                }
            }
        } else {
            this.error('Boss missing mechanics');
        }
        
        this.success('Boss test completed');
    }
    
    /**
     * Test powerup blueprint
     */
    testPowerup() {
        const bp = this.currentBlueprint;

        this.log('=== Powerup Test ===');
        this.log(`ID: ${bp.id}`);

        // Test mechanics.modifiersPerLevel (new format)
        if (bp.mechanics && bp.mechanics.modifiersPerLevel && Array.isArray(bp.mechanics.modifiersPerLevel)) {
            this.log(`Modifiers per level: ${bp.mechanics.modifiersPerLevel.length}`);

            bp.mechanics.modifiersPerLevel.forEach((mod, i) => {
                this.log(`  Modifier ${i + 1}:`);
                this.log(`    Path: ${mod.path || 'not set'}`);
                this.log(`    Type: ${mod.type || 'not set'}`);
                this.log(`    Value: ${mod.value !== undefined ? mod.value : 'not set'}`);

                if (!mod.path) this.error(`Modifier ${i + 1} missing path`);
                if (!mod.type) this.error(`Modifier ${i + 1} missing type`);
                if (mod.value === undefined) this.error(`Modifier ${i + 1} missing value`);
            });

            this.log(`Stackable: ${bp.mechanics.stackable || false}`);
            this.log(`Persistent: ${bp.mechanics.persistent || false}`);
        } else if (bp.effects && Array.isArray(bp.effects)) {
            // Legacy format support
            this.warn('Using legacy effects[] format');
            this.log(`Effects: ${bp.effects.length}`);

            bp.effects.forEach((effect, i) => {
                this.log(`  Effect ${i + 1}:`);
                this.log(`    Stat: ${effect.stat || 'not set'}`);
                this.log(`    Type: ${effect.type || 'not set'}`);
                this.log(`    Value: ${effect.value !== undefined ? effect.value : 'not set'}`);
            });
        } else {
            this.error('Powerup missing mechanics.modifiersPerLevel or effects array');
        }

        // Test stats
        if (bp.stats) {
            this.log(`Max Level: ${bp.stats.maxLevel || 'not set'}`);
            if (bp.stats.rarity) this.log(`Rarity: ${bp.stats.rarity}`);
        }

        // Test display
        if (bp.display) {
            this.log(`Display Name: ${bp.display.name || 'not set'}`);
        }

        this.success('Powerup test completed');
    }
    
    /**
     * Test projectile blueprint
     */
    testProjectile() {
        const bp = this.currentBlueprint;

        this.log('=== Projectile Test ===');
        this.log(`ID: ${bp.id}`);

        // Support both new format (stats) and old format (physics/damage)
        if (bp.stats) {
            this.log('Stats:');
            if (bp.stats.speed !== undefined) this.log(`  Speed: ${bp.stats.speed}`);
            if (bp.stats.damage !== undefined) this.log(`  Damage: ${bp.stats.damage}`);
            if (bp.stats.size !== undefined) this.log(`  Size: ${bp.stats.size}`);
            if (bp.stats.pierce !== undefined) this.log(`  Pierce: ${bp.stats.pierce}`);
            if (bp.stats.lifetime !== undefined) this.log(`  Lifetime: ${bp.stats.lifetime}`);
            if (bp.stats.range !== undefined) this.log(`  Range: ${bp.stats.range}`);

            if (bp.stats.speed !== undefined && bp.stats.speed <= 0) this.error('Speed must be > 0');
            if (bp.stats.damage !== undefined && bp.stats.damage <= 0) this.error('Damage must be > 0');
        } else if (bp.physics) {
            this.log('Physics (legacy format):');
            this.log(`  Speed: ${bp.physics.speed || 'not set'}`);
            this.log(`  Size: ${bp.physics.size || 'not set'}`);
            this.log(`  Piercing: ${bp.physics.piercing || false}`);
            this.log(`  Lifespan: ${bp.physics.lifespan || 'infinite'}`);

            if (bp.physics.speed <= 0) this.error('Speed must be > 0');
            if (bp.physics.size <= 0) this.error('Size must be > 0');
        } else {
            this.warn('Projectile missing stats or physics');
        }

        // Test damage (old format)
        if (bp.damage) {
            this.log(`Damage: ${bp.damage.amount || 'not set'}`);
            this.log(`Type: ${bp.damage.type || 'normal'}`);
        }

        // Test graphics
        if (bp.graphics) {
            this.log('Graphics:');
            if (bp.graphics.shape) this.log(`  Shape: ${bp.graphics.shape}`);
            if (bp.graphics.color) this.log(`  Color: ${this.formatColor(bp.graphics.color)}`);
        }

        this.success('Projectile test completed');
    }
    
    /**
     * Test spawn table blueprint
     */
    testSpawnTable() {
        const bp = this.currentBlueprint;
        
        this.log('=== Spawn Table Test ===');
        this.log(`ID: ${bp.id}`);
        this.log(`Level: ${bp.level || 'not set'}`);
        
        // Count spawn types
        let totalSpawns = 0;
        
        if (bp.enemyWaves) {
            this.log(`Enemy Waves: ${bp.enemyWaves.length}`);
            totalSpawns += bp.enemyWaves.length;
        }
        
        if (bp.eliteWindows) {
            this.log(`Elite Windows: ${bp.eliteWindows.length}`);
            totalSpawns += bp.eliteWindows.length;
        }
        
        if (bp.uniqueSpawns) {
            this.log(`Unique Spawns: ${bp.uniqueSpawns.length}`);
            totalSpawns += bp.uniqueSpawns.length;
        }
        
        if (bp.bossTriggers) {
            this.log(`Boss Triggers: ${bp.bossTriggers.length}`);
            totalSpawns += bp.bossTriggers.length;
        }
        
        if (totalSpawns === 0) {
            this.warn('Spawn table has no spawn definitions');
        }
        
        // Test difficulty
        if (bp.difficulty) {
            this.log('Difficulty multipliers:');
            this.log(`  HP: ×${bp.difficulty.enemyHpMultiplier || 1}`);
            this.log(`  Damage: ×${bp.difficulty.enemyDamageMultiplier || 1}`);
            this.log(`  Speed: ×${bp.difficulty.enemySpeedMultiplier || 1}`);
            this.log(`  Spawn Rate: ×${bp.difficulty.spawnRateMultiplier || 1}`);
        }
        
        this.success('Spawn table test completed');
    }
    
    /**
     * Generic test for unknown types
     */
    testGeneric() {
        const bp = this.currentBlueprint;
        
        this.log('=== Generic Test ===');
        this.log(`ID: ${bp.id}`);
        this.log(`Type: ${bp.type}`);
        
        // Show all top-level properties
        const props = Object.keys(bp).filter(k => !k.startsWith('_'));
        this.log(`Properties: ${props.join(', ')}`);
        
        // Basic structure checks
        if (!bp.id) this.error('Missing required field: id');
        if (!bp.type) this.error('Missing required field: type');
        
        this.success('Generic test completed');
    }
    
    /**
     * Reset test environment
     */
    reset() {
        this.log('=== Test Reset ===');
        this.testOutput = [];
        this.updateOutput();
        this.log('Test environment reset');
        this.isRunning = false;
        this.updateButtons();
    }
    
    /**
     * Pause/resume testing
     */
    pause() {
        this.isRunning = !this.isRunning;
        this.log(this.isRunning ? 'Tests resumed' : 'Tests paused');
        this.updateButtons();
    }
    
    /**
     * Log message
     */
    log(message) {
        this.addOutput(message, 'log');
    }
    
    /**
     * Log warning
     */
    warn(message) {
        this.addOutput(message, 'warn');
    }
    
    /**
     * Log error
     */
    error(message) {
        this.addOutput(message, 'error');
    }
    
    /**
     * Log success
     */
    success(message) {
        this.addOutput(message, 'success');
    }
    
    /**
     * Add output line
     */
    addOutput(message, type = 'log') {
        const timestamp = new Date().toLocaleTimeString();
        const line = {
            timestamp,
            message,
            type
        };
        
        this.testOutput.push(line);
        
        // Limit output lines
        if (this.testOutput.length > this.maxOutputLines) {
            this.testOutput.shift();
        }
        
        this.updateOutput();
    }
    
    /**
     * Update output display
     */
    updateOutput() {
        const container = this.outputContainer;
        container.innerHTML = '';
        
        for (const line of this.testOutput) {
            const div = document.createElement('div');
            div.className = `output-line output-${line.type}`;
            
            const timeSpan = document.createElement('span');
            timeSpan.className = 'output-time';
            timeSpan.textContent = line.timestamp;
            
            const messageSpan = document.createElement('span');
            messageSpan.className = 'output-message';
            messageSpan.textContent = line.message;
            
            div.appendChild(timeSpan);
            div.appendChild(document.createTextNode(' '));
            div.appendChild(messageSpan);
            
            container.appendChild(div);
        }
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
        
        // Add CSS for output styling if not exists
        this.ensureOutputCSS();
    }
    
    /**
     * Update button states
     */
    updateButtons() {
        const spawnBtn = document.getElementById('btn-spawn');
        const pauseBtn = document.getElementById('btn-pause');
        
        spawnBtn.disabled = !this.currentBlueprint;
        pauseBtn.textContent = this.isRunning ? 'Pause' : 'Resume';
    }
    
    /**
     * Ensure output CSS styles exist
     */
    ensureOutputCSS() {
        if (document.getElementById('test-output-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'test-output-styles';
        style.textContent = `
            .output-line {
                font-family: monospace;
                font-size: 11px;
                margin-bottom: 2px;
                display: flex;
                align-items: flex-start;
            }
            
            .output-time {
                color: var(--text-secondary);
                margin-right: 8px;
                min-width: 70px;
            }
            
            .output-message {
                flex: 1;
                word-break: break-all;
            }
            
            .output-error {
                color: var(--error-red);
            }
            
            .output-warn {
                color: var(--warning-orange);
            }
            
            .output-success {
                color: var(--accent-green);
            }
            
            .output-log {
                color: var(--text-primary);
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * Format color for display
     */
    formatColor(color) {
        if (typeof color === 'number') {
            return `0x${color.toString(16).toUpperCase()}`;
        }
        return color;
    }
}

export default TestRunner;