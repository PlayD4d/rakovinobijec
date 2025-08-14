/**
 * CameraSystem - PR7 kompatibilní wrapper pro Phaser camera API
 * Centralizuje všechny camera operace a odstraňuje přímé Phaser API volání
 */

export class CameraSystem {
    constructor(scene) {
        this.scene = scene;
        this.mainCamera = null;
        this.initialized = false;
    }
    
    /**
     * Inicializace systému
     */
    initialize() {
        if (this.initialized) return;
        
        this.mainCamera = this.scene.cameras.main;
        
        // Základní nastavení z ConfigResolver
        const CR = window.ConfigResolver;
        this.config = {
            zoomMin: CR?.get('camera.zoomMin', { defaultValue: 0.5 }) || 0.5,
            zoomMax: CR?.get('camera.zoomMax', { defaultValue: 2.0 }) || 2.0,
            zoomDefault: CR?.get('camera.zoomDefault', { defaultValue: 1.0 }) || 1.0,
            followLerp: CR?.get('camera.followLerp', { defaultValue: 0.1 }) || 0.1,
            deadzone: CR?.get('camera.deadzone', { defaultValue: { width: 100, height: 100 } }) || { width: 100, height: 100 }
        };
        
        this.initialized = true;
        console.log('[CameraSystem] Inicializován');
    }
    
    /**
     * Získá šířku hlavní kamery
     */
    getWidth() {
        return this.mainCamera ? this.mainCamera.width : 0;
    }
    
    /**
     * Získá výšku hlavní kamery
     */
    getHeight() {
        return this.mainCamera ? this.mainCamera.height : 0;
    }
    
    /**
     * Získá pozici kamery
     */
    getPosition() {
        return this.mainCamera ? {
            x: this.mainCamera.scrollX,
            y: this.mainCamera.scrollY
        } : { x: 0, y: 0 };
    }
    
    /**
     * Nastaví pozici kamery
     */
    setPosition(x, y) {
        if (this.mainCamera) {
            this.mainCamera.setScroll(x, y);
        }
    }
    
    /**
     * Získá střed kamery
     */
    getCenter() {
        return this.mainCamera ? {
            x: this.mainCamera.centerX,
            y: this.mainCamera.centerY
        } : { x: 0, y: 0 };
    }
    
    /**
     * Nastaví zoom kamery
     */
    setZoom(zoom) {
        if (this.mainCamera) {
            const clampedZoom = Math.max(this.config.zoomMin, Math.min(this.config.zoomMax, zoom));
            this.mainCamera.setZoom(clampedZoom);
        }
    }
    
    /**
     * Získá aktuální zoom
     */
    getZoom() {
        return this.mainCamera ? this.mainCamera.zoom : 1;
    }
    
    /**
     * Nastaví sledování objektu
     */
    startFollow(target, roundPixels = false, lerpX = null, lerpY = null) {
        if (this.mainCamera && target) {
            this.mainCamera.startFollow(
                target, 
                roundPixels, 
                lerpX || this.config.followLerp, 
                lerpY || this.config.followLerp
            );
        }
    }
    
    /**
     * Zastaví sledování
     */
    stopFollow() {
        if (this.mainCamera) {
            this.mainCamera.stopFollow();
        }
    }
    
    /**
     * Nastaví deadzone
     */
    setDeadzone(width, height) {
        if (this.mainCamera) {
            this.mainCamera.setDeadzone(width, height);
        }
    }
    
    /**
     * Shake efekt
     */
    shake(duration = 100, intensity = 0.01) {
        if (this.mainCamera) {
            this.mainCamera.shake(duration, intensity);
        }
    }
    
    /**
     * Flash efekt
     */
    flash(duration = 100, red = 255, green = 255, blue = 255) {
        if (this.mainCamera) {
            this.mainCamera.flash(duration, red, green, blue);
        }
    }
    
    /**
     * Fade efekt
     */
    fade(duration = 1000, red = 0, green = 0, blue = 0) {
        if (this.mainCamera) {
            this.mainCamera.fade(duration, red, green, blue);
        }
    }
    
    /**
     * Získá bounds kamery
     */
    getBounds() {
        if (!this.mainCamera) return { x: 0, y: 0, width: 0, height: 0 };
        
        return {
            x: this.mainCamera.x,
            y: this.mainCamera.y,
            width: this.mainCamera.width,
            height: this.mainCamera.height
        };
    }
    
    /**
     * Nastaví bounds kamery
     */
    setBounds(x, y, width, height) {
        if (this.mainCamera) {
            this.mainCamera.setBounds(x, y, width, height);
        }
    }
    
    /**
     * Cleanup při shutdown
     */
    shutdown() {
        if (this.mainCamera) {
            this.stopFollow();
        }
        console.log('[CameraSystem] Shutdown');
    }
    
    /**
     * Destrukce systému
     */
    destroy() {
        this.shutdown();
        this.mainCamera = null;
        this.initialized = false;
    }
}

// Singleton pro globální přístup
let cameraSystemInstance = null;

export function getCameraSystem(scene) {
    if (!cameraSystemInstance) {
        cameraSystemInstance = new CameraSystem(scene);
        cameraSystemInstance.initialize();
    }
    return cameraSystemInstance;
}

export default CameraSystem;