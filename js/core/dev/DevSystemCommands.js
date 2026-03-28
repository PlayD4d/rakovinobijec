/**
 * DevSystemCommands - Game flow and system management DEV commands
 */

export function registerSystemCommands(DEV, getScene) {

    DEV.pause = () => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }
            scene.game.events.emit('game-pause-request');
            console.log('Game paused');
        } catch (e) { console.error('[DEV] pause failed:', e); }
    };

    DEV.resume = () => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }
            const uiScene = scene.scene.get('GameUIScene');
            if (uiScene?.pauseUI) {
                uiScene.pauseUI.hide();
                console.log('Game resumed');
            } else {
                console.warn('[DEV] PauseUI not found');
            }
        } catch (e) { console.error('[DEV] resume failed:', e); }
    };

    DEV.victory = () => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }
            if (!scene.transitionManager) { console.warn('[DEV] TransitionManager not available'); return; }
            scene.transitionManager.showVictory();
            console.log('Victory triggered');
        } catch (e) { console.error('[DEV] victory failed:', e); }
    };

    DEV.gameOver = () => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }
            if (!scene.transitionManager) { console.warn('[DEV] TransitionManager not available'); return; }
            scene.transitionManager.gameOver();
            console.log('Game over triggered');
        } catch (e) { console.error('[DEV] gameOver failed:', e); }
    };

    DEV.gotoMainMenu = () => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }
            scene.scene.stop('GameScene');
            scene.scene.stop('GameUIScene');
            scene.scene.start('MainMenu');
            console.log('Returned to main menu');
        } catch (e) { console.error('[DEV] gotoMainMenu failed:', e); }
    };

    DEV.startGame = () => {
        try {
            const scene = getScene();
            // For startGame we can work from any scene context
            const game = window.game || scene?.game;
            if (!game) { console.warn('[DEV] Game instance not available'); return; }
            const mainMenu = game.scene.getScene('MainMenu');
            if (mainMenu) {
                mainMenu.scene.stop();
                mainMenu.scene.start('GameScene');
                mainMenu.scene.launch('GameUIScene');
                console.log('Game started');
            } else {
                console.warn('[DEV] MainMenu scene not found');
            }
        } catch (e) { console.error('[DEV] startGame failed:', e); }
    };

    DEV.forceLevelTransition = () => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }
            if (!scene.transitionManager) { console.warn('[DEV] TransitionManager not available'); return; }
            scene.transitionManager.transitionToNextLevel();
            console.log('Level transition triggered');
        } catch (e) { console.error('[DEV] forceLevelTransition failed:', e); }
    };

    DEV.clearProjectiles = () => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }
            if (!scene.projectileSystem) { console.warn('[DEV] ProjectileSystem not available'); return; }
            scene.projectileSystem.clearAll();
            console.log('Cleared all projectiles');
        } catch (e) { console.error('[DEV] clearProjectiles failed:', e); }
    };

    DEV.selectPowerUp = (index = 0) => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }
            const uiScene = scene.scene.get('GameUIScene');
            if (uiScene?.powerUpUI) {
                const options = uiScene.powerUpUI.currentOptions;
                if (options && options[index]) {
                    uiScene.handlePowerUpSelection(options[index]);
                    console.log(`Selected power-up: ${options[index].id}`);
                } else {
                    console.warn(`[DEV] No power-up option at index ${index}`);
                }
            } else {
                console.warn('[DEV] PowerUpUI not visible');
            }
        } catch (e) { console.error('[DEV] selectPowerUp failed:', e); }
    };
}
