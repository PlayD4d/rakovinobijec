/**
 * DebugOverlay.js - Real-time debug monitoring overlay
 * 
 * Zobrazuje gameplay metriky v reálném čase pro vývojáře a testery.
 * Aktivní pouze s feature flag, ovládání F3.
 */

export class DebugOverlay {
    constructor(scene) {
        this.scene = scene;
        this.isVisible = false;
        this.isEnabled = false;
        
        // UI elements
        this.container = null;
        this.background = null;
        this.titleText = null;
        this.metricsText = null;
        
        // Update frequency
        this.updateInterval = 500; // 500ms updates
        this.lastUpdate = 0;
        
        // Metrics tracking
        this.metrics = {
            fps: 0,
            gameTime: 0,
            activeEnemies: 0,
            avgTTK: 0,
            spawnCounts: { miniboss: 0, boss: 0, unique: 0 },
            lootRates: { common: 0, rare: 0, epic: 0, legendary: 0 },
            playerStats: { level: 1, xp: 0, hp: 100 }
        };
        
        this.initialize();
    }

    initialize() {
        // Check if debug overlay is enabled
        const ConfigResolver = this.scene.configResolver || window.ConfigResolver;
        this.isEnabled = ConfigResolver?.get('features.debugOverlay', { defaultValue: false }) || false;
        
        if (!this.isEnabled) {
            console.log('🐛 DebugOverlay: Disabled via feature flag');
            return;
        }
        
        console.log('🐛 DebugOverlay: Initializing...');
        
        // Create UI elements
        this.createOverlay();
        
        // Setup keyboard controls
        this.setupControls();
        
        // Start update loop
        this.startUpdateLoop();
        
        // Hide initially
        this.hide();
    }

    createOverlay() {
        // Main container - positioned on left side, below HP/XP bars
        // HP bar is at ~50px, XP bar at ~80px, so start at 120px
        this.container = this.scene.add.container(20, 120);
        this.container.setDepth(9999); // Always on top
        this.container.setScrollFactor(0); // Don't scroll with camera
        
        // Background panel
        this.background = this.scene.add.graphics();
        this.background.fillStyle(0x000000, 0.8);
        this.background.fillRoundedRect(0, 0, 350, 400, 8);
        this.background.lineStyle(2, 0x00ff00, 0.8);
        this.background.strokeRoundedRect(0, 0, 350, 400, 8);
        this.container.add(this.background);
        
        // Title
        this.titleText = this.scene.add.text(10, 10, 'DEBUG OVERLAY (F3)', {
            fontSize: '16px',
            fontFamily: 'monospace',
            fill: '#00ff00',
            fontStyle: 'bold'
        });
        this.container.add(this.titleText);
        
        // Metrics text area
        this.metricsText = this.scene.add.text(10, 35, '', {
            fontSize: '12px',
            fontFamily: 'monospace',
            fill: '#ffffff',
            lineSpacing: 2
        });
        this.container.add(this.metricsText);
        
        // Version info
        const versionText = this.scene.add.text(10, 370, `v${this.scene.game.config.version || '0.2.0'} | ${this.getSessionInfo()}`, {
            fontSize: '10px',
            fontFamily: 'monospace',
            fill: '#888888'
        });
        this.container.add(versionText);
    }

    getSessionInfo() {
        const telemetry = this.scene.telemetryLogger;
        if (telemetry && telemetry.isEnabled) {
            return `Session: ${telemetry.sessionId.slice(-8)}`;
        }
        return 'No telemetry';
    }

    setupControls() {
        // F3 key toggle
        this.scene.input.keyboard.on('keydown-F3', () => {
            this.toggle();
        });
        
        // ESC to hide
        this.scene.input.keyboard.on('keydown-ESC', () => {
            if (this.isVisible) {
                this.hide();
            }
        });
    }

    startUpdateLoop() {
        // Update metrics periodically
        this.updateTimer = setInterval(() => {
            if (this.isEnabled && this.isVisible) {
                this.updateMetrics();
                this.updateDisplay();
            }
        }, this.updateInterval);
    }

    updateMetrics() {
        const now = Date.now();
        
        // FPS
        this.metrics.fps = Math.round(this.scene.game.loop.actualFps);
        
        // Game time
        const telemetry = this.scene.telemetryLogger;
        if (telemetry && telemetry.isEnabled) {
            this.metrics.gameTime = telemetry.getGameTime();
            
            // Get realtime stats from telemetry
            const realtimeStats = telemetry.getRealtimeStats();
            this.metrics.spawnCounts = realtimeStats.spawnsByType;
            this.metrics.lootRates = realtimeStats.lootByRarity;
            this.metrics.avgTTK = realtimeStats.avgTTKLastMinute;
        } else {
            this.metrics.gameTime = Math.round((now - (this.scene.startTime || now)) / 1000);
        }
        
        // Active enemies count
        this.metrics.activeEnemies = this.getActiveEnemiesCount();
        
        // Player stats
        this.updatePlayerStats();
        
        this.lastUpdate = now;
    }

    getActiveEnemiesCount() {
        if (this.scene.enemyManager && this.scene.enemyManager.enemies) {
            return this.scene.enemyManager.enemies.length;
        }
        
        // Fallback: count active game objects with enemy tag
        let count = 0;
        this.scene.children.list.forEach(child => {
            if (child.getData && child.getData('entityType') === 'enemy' && child.active) {
                count++;
            }
        });
        
        return count;
    }

    updatePlayerStats() {
        const player = this.scene.player;
        if (player) {
            this.metrics.playerStats = {
                level: player.level || 1,
                xp: player.xp || 0,
                hp: Math.round(player.hp || player.health || 100),
                maxHP: Math.round(player.maxHP || player.maxHealth || 100)
            };
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    calculateLootDropRates() {
        const total = Object.values(this.metrics.lootRates).reduce((a, b) => a + b, 0);
        if (total === 0) return { common: 0, rare: 0, epic: 0, legendary: 0 };
        
        return {
            common: Math.round((this.metrics.lootRates.common || 0) / total * 100),
            rare: Math.round(((this.metrics.lootRates.rare || 0) + (this.metrics.lootRates.uncommon || 0)) / total * 100),
            epic: Math.round((this.metrics.lootRates.epic || 0) / total * 100),
            legendary: Math.round((this.metrics.lootRates.legendary || 0) / total * 100)
        };
    }

    updateDisplay() {
        if (!this.metricsText) return;
        
        const lootRates = this.calculateLootDropRates();
        const totalSpawns = Object.values(this.metrics.spawnCounts).reduce((a, b) => a + b, 0);
        
        const displayText = [
            `FPS: ${this.metrics.fps}`,
            `Time: ${this.formatTime(this.metrics.gameTime)}`,
            `Active Enemies: ${this.metrics.activeEnemies}`,
            '',
            '=== PLAYER ===',
            `Level: ${this.metrics.playerStats.level}`,
            `XP: ${this.formatNumber(this.metrics.playerStats.xp)}`,
            `HP: ${this.metrics.playerStats.hp}/${this.metrics.playerStats.maxHP}`,
            '',
            '=== COMBAT ===',
            `Avg TTK (1min): ${this.metrics.avgTTK}s`,
            `Total Spawns: ${this.formatNumber(totalSpawns)}`,
            '',
            '=== SPAWNS ===',
            `Miniboss: ${this.formatNumber(this.metrics.spawnCounts.miniboss || 0)}`,
            `Boss: ${this.formatNumber(this.metrics.spawnCounts.boss || 0)}`,
            `Unique: ${this.formatNumber(this.metrics.spawnCounts.unique || 0)}`,
            '',
            '=== LOOT RATES ===',
            `Common: ${lootRates.common}%`,
            `Rare: ${lootRates.rare}%`,
            `Epic: ${lootRates.epic}%`,
            `Legendary: ${lootRates.legendary}%`,
            '',
            '=== SYSTEM ===',
            `NG+ Level: ${this.scene.ngPlusLevel || 0}`,
            `Stage: ${this.scene.currentStage || 1}`,
            `Telemetry: ${this.scene.telemetryLogger?.isEnabled ? 'ON' : 'OFF'}`
        ].join('\n');
        
        this.metricsText.setText(displayText);
    }

    // Public methods
    show() {
        if (!this.isEnabled || !this.container) return;
        
        this.container.setVisible(true);
        this.isVisible = true;
        this.updateMetrics();
        this.updateDisplay();
        
        console.log('🐛 DebugOverlay: Shown');
    }

    hide() {
        if (!this.container) return;
        
        this.container.setVisible(false);
        this.isVisible = false;
        
        console.log('🐛 DebugOverlay: Hidden');
    }

    toggle() {
        if (!this.isEnabled) {
            console.log('🐛 DebugOverlay: Cannot toggle - disabled via feature flag');
            return;
        }
        
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    // Manual metric updates for integration
    updateSpawnCount(type) {
        if (this.metrics.spawnCounts[type] !== undefined) {
            this.metrics.spawnCounts[type]++;
        }
    }

    updateLootCount(rarity) {
        if (this.metrics.lootRates[rarity] !== undefined) {
            this.metrics.lootRates[rarity]++;
        }
    }

    // Debug methods
    getMetrics() {
        return { ...this.metrics };
    }

    setPosition(x, y) {
        if (this.container) {
            this.container.setPosition(x, y);
        }
    }

    setSize(width, height) {
        if (this.background) {
            this.background.clear();
            this.background.fillStyle(0x000000, 0.8);
            this.background.fillRoundedRect(0, 0, width, height, 8);
            this.background.lineStyle(2, 0x00ff00, 0.8);
            this.background.strokeRoundedRect(0, 0, width, height, 8);
        }
    }

    // Cleanup
    destroy() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        
        if (this.container) {
            this.container.destroy();
        }
        
        console.log('🐛 DebugOverlay: Destroyed');
    }

    // Static utility methods
    static formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    static getMemoryUsage() {
        if (performance.memory) {
            return {
                used: DebugOverlay.formatBytes(performance.memory.usedJSHeapSize),
                total: DebugOverlay.formatBytes(performance.memory.totalJSHeapSize),
                limit: DebugOverlay.formatBytes(performance.memory.jsHeapSizeLimit)
            };
        }
        return null;
    }
}