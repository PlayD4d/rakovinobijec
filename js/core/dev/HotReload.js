/**
 * HotReload - hot reload blueprintů v development módu
 * 
 * Umožňuje vývojářům upravovat blueprinty za běhu bez restartu hry.
 * Sleduje změny v souborech a automaticky reload blueprinty.
 */

// Removed legacy registry imports - using BlueprintLoader directly
// import { EnemyRegistry } from '../registry/EnemyRegistry.js';
// import { DropRegistry } from '../registry/DropRegistry.js';

export class HotReload {
    constructor(scene) {
        this.scene = scene;
        this.enabled = false;
        this.watchedFiles = new Map(); // path -> { lastModified, type, name }
        this.checkInterval = null;
        this.checkIntervalMs = 2000; // kontrola každé 2 sekundy
        
        // Automaticky zapnout v dev módu
        try {
            if (window.localStorage.getItem('hotReload') === 'true') {
                this.enable();
            }
        } catch (_) {}
        
        console.log('[HotReload] Initialized');
    }
    
    /**
     * Zapnout hot reload
     */
    enable() {
        if (this.enabled) return;
        
        this.enabled = true;
        
        // Začít sledovat známé blueprint soubory
        this._registerBlueprintFiles();
        
        // Spustit periodickou kontrolu
        this.checkInterval = setInterval(() => {
            this._checkForChanges();
        }, this.checkIntervalMs);
        
        console.log('[HotReload] Enabled - watching for blueprint changes');
        
        // Synchronizovat s localStorage
        try {
            window.localStorage.setItem('hotReload', 'true');
        } catch (_) {}
    }
    
    /**
     * Vypnout hot reload
     */
    disable() {
        if (!this.enabled) return;
        
        this.enabled = false;
        
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        
        this.watchedFiles.clear();
        
        console.log('[HotReload] Disabled');
        
        // Synchronizovat s localStorage
        try {
            window.localStorage.setItem('hotReload', 'false');
        } catch (_) {}
    }
    
    /**
     * Toggle hot reload
     */
    toggle() {
        if (this.enabled) {
            this.disable();
        } else {
            this.enable();
        }
        return this.enabled;
    }
    
    /**
     * Registrovat blueprint soubory pro sledování
     */
    _registerBlueprintFiles() {
        // PR7: Watch JSON5 blueprint directories instead of legacy JS files
        const blueprintDirs = [
            { dir: 'data/blueprints/enemy/', type: 'enemy' },
            { dir: 'data/blueprints/boss/', type: 'boss' },
            { dir: 'data/blueprints/powerup/', type: 'powerup' },
            { dir: 'data/blueprints/spawn/', type: 'spawn' },
            { dir: 'data/blueprints/items/', type: 'item' },
            { dir: 'data/blueprints/projectile/', type: 'projectile' }
        ];

        // Note: File-level watching requires a file list; directory watching
        // is not supported by the HEAD-request mechanism. HotReload is primarily
        // useful during dev with the dev server which handles this natively.
        // Legacy file paths removed — they no longer exist in PR7 structure.
        
        console.log(`[HotReload] Watching ${this.watchedFiles.size} blueprint files`);
    }
    
    /**
     * Přidat soubor do sledování
     * @param {string} filePath - relativní cesta k souboru
     * @param {string} type - typ blueprintu (enemy, boss, drop, powerup)
     * @param {string} name - název blueprintu (optional, odvozeno ze souboru)
     */
    watchFile(filePath, type, name = null) {
        if (!name) {
            // Odvodit název ze souboru
            name = filePath.split('/').pop().replace('.js', '');
        }
        
        this.watchedFiles.set(filePath, {
            lastModified: null,
            type,
            name,
            lastCheck: 0
        });
    }
    
    /**
     * Kontrola změn v souborech
     * Poznámka: V browseru nemůžeme skutečně sledovat file system, 
     * takže simulujeme pomocí importů a localStorage cache
     */
    async _checkForChanges() {
        if (!this.enabled) return;
        
        const now = Date.now();
        
        // Zkontroluj každý sledovaný soubor
        for (const [filePath, fileInfo] of this.watchedFiles.entries()) {
            // Throttle kontroly - max 1x za 5 sekund na soubor
            if (now - fileInfo.lastCheck < 5000) {
                continue;
            }
            
            fileInfo.lastCheck = now;
            
            try {
                // Pokus o reload blueprintu
                await this._reloadBlueprint(filePath, fileInfo);
            } catch (error) {
                console.warn(`[HotReload] Failed to check ${filePath}:`, error.message);
            }
        }
    }
    
    /**
     * Reload konkrétního blueprintu
     * @param {string} filePath - cesta k souboru
     * @param {Object} fileInfo - info o souboru
     */
    async _reloadBlueprint(filePath, fileInfo) {
        try {
            // Vytvoř cache-busting URL
            const cacheBustingUrl = `/${filePath}?reload=${Date.now()}`;
            
            // Dynamicky importnout blueprint
            const module = await import(cacheBustingUrl);
            const blueprint = module.default || module;
            
            if (!blueprint) {
                console.warn(`[HotReload] No default export in ${filePath}`);
                return;
            }
            
            // Re-registrovat blueprint podle typu přes BlueprintLoader
            if (this.scene.blueprintLoader) {
                // Použít centralizovaný BlueprintLoader
                this.scene.blueprintLoader.updateBlueprint(blueprint.id || blueprint.name, blueprint);
                console.log(`[HotReload] ✅ Updated ${fileInfo.type} blueprint via BlueprintLoader: ${blueprint.id || blueprint.name}`);
            } else {
                console.warn(`[HotReload] BlueprintLoader not available - cannot reload ${fileInfo.type}`);
                return;
            }
            
            console.log(`[HotReload] ✅ Reloaded ${fileInfo.type} blueprint: ${blueprint.name}`);
            
            // Notifikace v debug overlay
            if (this.scene.debugOverlay) {
                this._showReloadNotification(blueprint.name, fileInfo.type);
            }
            
        } catch (error) {
            console.error(`[HotReload] Failed to reload ${filePath}:`, error.message);
        }
    }
    
    /**
     * Zobrazit notifikaci o reloadu
     * @param {string} blueprintName - název blueprintu
     * @param {string} type - typ blueprintu
     */
    _showReloadNotification(blueprintName, type) {
        // Dočasné zobrazení notifikace v konzoli (později možno rozšířit na vizuální notifikaci)
        const message = `🔄 Hot reloaded: ${type}/${blueprintName}`;
        console.log(`[HotReload] ${message}`);
        
        // Případně přidat do debug overlay jako flash message
        if (this.scene.debugOverlay && this.scene.debugOverlay.flashMessage) {
            this.scene.debugOverlay.flashMessage(message, 3000);
        }
    }
    
    /**
     * Ruční reload konkrétního blueprintu
     * @param {string} blueprintName - název blueprintu
     * @param {string} type - typ blueprintu
     */
    async manualReload(blueprintName, type) {
        // Najdi soubor podle názvu a typu
        for (const [filePath, fileInfo] of this.watchedFiles.entries()) {
            if (fileInfo.name === blueprintName && fileInfo.type === type) {
                await this._reloadBlueprint(filePath, fileInfo);
                return;
            }
        }
        
        console.warn(`[HotReload] Blueprint not found: ${type}/${blueprintName}`);
    }
    
    /**
     * Získat status hot reloadu
     */
    getStatus() {
        return {
            enabled: this.enabled,
            watchedFiles: this.watchedFiles.size,
            checkInterval: this.checkIntervalMs,
            files: Array.from(this.watchedFiles.entries()).map(([path, info]) => ({
                path,
                type: info.type,
                name: info.name,
                lastCheck: info.lastCheck
            }))
        };
    }
    
    /**
     * Cleanup při destroy
     */
    destroy() {
        this.disable();
        console.log('[HotReload] Destroyed');
    }
}