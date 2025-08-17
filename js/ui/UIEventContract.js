/**
 * UI Event Contract
 * Defines all UI events and provides validation
 * Ensures clean separation between GameScene and GameUIScene
 */

export const UI_EVENTS = {
    // Level transitions
    LEVEL_TRANSITION_SHOW: 'ui:level-transition:show',
    LEVEL_TRANSITION_HIDE: 'ui:level-transition:hide',
    LEVEL_TRANSITION_COMPLETE: 'ui:level-transition:complete',
    
    // Victory screen
    VICTORY_SHOW: 'ui:victory:show',
    VICTORY_SUBMIT: 'ui:victory:submit',
    VICTORY_CLOSED: 'ui:victory:closed',
    
    // Game over screen
    GAMEOVER_SHOW: 'ui:gameover:show',
    GAMEOVER_SUBMIT: 'ui:gameover:submit',
    GAMEOVER_RETRY: 'ui:gameover:retry',
    GAMEOVER_CLOSED: 'ui:gameover:closed',
    
    // Pause menu
    PAUSE_SHOW: 'ui:pause:show',
    PAUSE_RESUME: 'ui:pause:resume',
    PAUSE_CLOSED: 'ui:pause:closed',
    PAUSE_QUIT: 'ui:pause:quit',
    
    // Power-up selection
    POWERUP_SHOW: 'ui:powerup:show',
    POWERUP_SELECTED: 'ui:powerup:selected',
    POWERUP_CLOSED: 'ui:powerup:closed',
    
    // Error display
    ERROR_SHOW: 'ui:error:show',
    ERROR_CLOSED: 'ui:error:closed',
    
    // HUD updates
    HUD_UPDATE_HEALTH: 'ui:hud:health',
    HUD_UPDATE_XP: 'ui:hud:xp',
    HUD_UPDATE_LEVEL: 'ui:hud:level',
    HUD_UPDATE_BOSS: 'ui:hud:boss',
    HUD_UPDATE_SCORE: 'ui:hud:score'
};

/**
 * Event validation schema
 */
const EVENT_SCHEMAS = {
    [UI_EVENTS.LEVEL_TRANSITION_SHOW]: {
        fromLevel: { type: 'number', required: true },
        toLevel: { type: 'number', required: true }
    },
    
    [UI_EVENTS.VICTORY_SHOW]: {
        score: { type: 'number', required: true },
        time: { type: 'number', required: true },
        kills: { type: 'number', required: false }
    },
    
    [UI_EVENTS.GAMEOVER_SHOW]: {
        score: { type: 'number', required: true },
        wave: { type: 'number', required: false },
        reason: { type: 'string', required: false }
    },
    
    [UI_EVENTS.POWERUP_SHOW]: {
        options: { type: 'array', required: true },
        level: { type: 'number', required: true }
    },
    
    [UI_EVENTS.ERROR_SHOW]: {
        title: { type: 'string', required: true },
        message: { type: 'string', required: true },
        severity: { type: 'string', required: false }
    }
};

/**
 * UIEventContract class - manages event validation and isolation
 */
export class UIEventContract {
    constructor(scene) {
        this.scene = scene;
        this.eventLog = [];
        this.maxLogSize = 100;
        this.inputIsolated = false;
    }
    
    /**
     * Emit UI event with validation
     */
    emit(eventName, data = {}) {
        // Validate event name
        if (!Object.values(UI_EVENTS).includes(eventName)) {
            console.warn(`[UIContract] Unknown event: ${eventName}`);
        }
        
        // Validate event data
        if (EVENT_SCHEMAS[eventName]) {
            const validation = this.validateEventData(eventName, data);
            if (!validation.valid) {
                console.error(`[UIContract] Invalid event data for ${eventName}:`, validation.errors);
                return false;
            }
        }
        
        // Log event
        this.logEvent(eventName, data);
        
        // Emit to appropriate target
        if (eventName.startsWith('ui:')) {
            // UI events go to UI scene
            const uiScene = this.scene.scene.get('GameUIScene');
            if (uiScene?.events) {
                uiScene.events.emit(eventName, data);
                return true;
            }
        } else {
            // Game events go to game scene
            const gameScene = this.scene.scene.get('GameScene');
            if (gameScene?.events) {
                gameScene.events.emit(eventName, data);
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Validate event data against schema
     */
    validateEventData(eventName, data) {
        const schema = EVENT_SCHEMAS[eventName];
        if (!schema) return { valid: true };
        
        const errors = [];
        
        for (const [field, rules] of Object.entries(schema)) {
            if (rules.required && !(field in data)) {
                errors.push(`Missing required field: ${field}`);
            }
            
            if (field in data && rules.type) {
                const actualType = Array.isArray(data[field]) ? 'array' : typeof data[field];
                if (actualType !== rules.type) {
                    errors.push(`Invalid type for ${field}: expected ${rules.type}, got ${actualType}`);
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * Setup input isolation for UI overlays
     */
    setupInputIsolation(overlayContainer) {
        if (!overlayContainer) return;
        
        // Make overlay interactive to capture input
        overlayContainer.setInteractive();
        
        // Set UI scene to capture all input
        this.scene.input.setTopOnly(true);
        
        // Block input propagation
        overlayContainer.on('pointerdown', (pointer, localX, localY, event) => {
            event?.stopPropagation?.();
        });
        
        overlayContainer.on('pointerup', (pointer, localX, localY, event) => {
            event?.stopPropagation?.();
        });
        
        this.inputIsolated = true;
    }
    
    /**
     * Release input isolation
     */
    releaseInputIsolation() {
        this.scene.input.setTopOnly(false);
        this.inputIsolated = false;
    }
    
    /**
     * Test input isolation
     */
    testInputIsolation() {
        if (!this.inputIsolated) {
            console.warn('[UIContract] Input not isolated - overlays may leak input!');
            return false;
        }
        
        // Check if game scene is paused
        const gameScene = this.scene.scene.get('GameScene');
        if (gameScene && !gameScene.scene.isPaused()) {
            console.warn('[UIContract] Game scene not paused during UI overlay!');
            return false;
        }
        
        console.log('[UIContract] ✅ Input isolation test passed');
        return true;
    }
    
    /**
     * Log event for debugging
     */
    logEvent(eventName, data) {
        const entry = {
            event: eventName,
            data,
            timestamp: Date.now(),
            scene: this.scene.sys.settings.key
        };
        
        this.eventLog.push(entry);
        
        // Trim log if too large
        if (this.eventLog.length > this.maxLogSize) {
            this.eventLog.shift();
        }
    }
    
    /**
     * Get recent events
     */
    getEventHistory(count = 10) {
        return this.eventLog.slice(-count);
    }
    
    /**
     * Contract test - simulate all events
     */
    runContractTest() {
        console.log('[UIContract] 🧪 Running contract test...');
        const results = [];
        
        // Test each event
        for (const [key, eventName] of Object.entries(UI_EVENTS)) {
            const testData = this.getTestData(eventName);
            const success = this.emit(eventName, testData);
            
            results.push({
                event: eventName,
                success,
                data: testData
            });
        }
        
        // Check results
        const passed = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        console.log(`[UIContract] Test complete: ${passed} passed, ${failed} failed`);
        
        if (failed > 0) {
            console.error('[UIContract] Failed events:', 
                results.filter(r => !r.success).map(r => r.event)
            );
        }
        
        return {
            passed,
            failed,
            results
        };
    }
    
    /**
     * Get test data for event
     */
    getTestData(eventName) {
        const testData = {
            [UI_EVENTS.LEVEL_TRANSITION_SHOW]: { fromLevel: 1, toLevel: 2 },
            [UI_EVENTS.VICTORY_SHOW]: { score: 1000, time: 120 },
            [UI_EVENTS.GAMEOVER_SHOW]: { score: 500, wave: 5 },
            [UI_EVENTS.POWERUP_SHOW]: { options: [], level: 1 },
            [UI_EVENTS.ERROR_SHOW]: { title: 'Test Error', message: 'Test message' },
            [UI_EVENTS.HUD_UPDATE_HEALTH]: { current: 100, max: 100 },
            [UI_EVENTS.HUD_UPDATE_XP]: { current: 50, max: 100 },
            [UI_EVENTS.HUD_UPDATE_LEVEL]: { level: 1 }
        };
        
        return testData[eventName] || {};
    }
}

// Export default instance creator
export function createUIEventContract(scene) {
    return new UIEventContract(scene);
}

export default UIEventContract;