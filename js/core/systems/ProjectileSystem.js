/**
 * ProjectileSystemV2 - Čistá Phaser 3 Arcade Physics implementace
 * 
 * PR7 kompatibilní - Zero-GC, vestavěný pooling, optimální výkon
 * Jednotný systém pro všechny projektily ve hře
 * Podporuje hráčské i nepřátelské projektily s různými efekty
 */

import { PlayerProjectile } from '../projectiles/PlayerProjectile.js';
import { EnemyProjectile } from '../projectiles/EnemyProjectile.js';
import { ShapeRenderer } from '../utils/ShapeRenderer.js';
// PR7: GameConfig removed - use ConfigResolver only
// import { GameConfig } from '../../config.js';

export class ProjectileSystem {
  constructor(scene) {
    this.scene = scene;
    
    // Vygenerovat texturu projektilu jednou při inicializaci (rychlejší než add.circle())
    this._generateBulletTexture();
    
    // PR7: Get pool sizes from ConfigResolver
    const ConfigResolver = this.scene.configResolver || window.ConfigResolver;
    const playerPoolSize = ConfigResolver ? ConfigResolver.get('projectiles.player.poolSize', { defaultValue: 256 }) : 256;
    const enemyPoolSize = ConfigResolver ? ConfigResolver.get('projectiles.enemy.poolSize', { defaultValue: 256 }) : 256;
    
    // Skupina hráčských projektilů s vestavěným poolingem
    this.playerBullets = scene.physics.add.group({
      classType: PlayerProjectile,
      maxSize: playerPoolSize,
      runChildUpdate: true // Automatické volání preUpdate() pro každý projektil
    });
    
    // Skupina nepřátelských projektilů s vestavěným poolingem
    this.enemyBullets = scene.physics.add.group({
      classType: EnemyProjectile,
      maxSize: enemyPoolSize,
      runChildUpdate: true // Automatické volání preUpdate() pro každý projektil
    });
    
    // PR7: Use ConfigResolver for all configuration values
    // ConfigResolver already retrieved above
    this.config = {
      speed: ConfigResolver ? ConfigResolver.get('player.projectileSpeed', { defaultValue: 300 }) : 300,
      range: ConfigResolver ? ConfigResolver.get('player.projectileRange', { defaultValue: 600 }) : 600,
      damage: ConfigResolver ? ConfigResolver.get('player.projectileDamage', { defaultValue: 10 }) : 10,
      muzzleOffset: ConfigResolver ? ConfigResolver.get('player.muzzleOffset', { defaultValue: 24 }) : 24,
      // Enemy projectile defaults
      enemySpeed: ConfigResolver ? ConfigResolver.get('enemy.projectileSpeed', { defaultValue: 150 }) : 150,
      enemyRange: ConfigResolver ? ConfigResolver.get('enemy.projectileRange', { defaultValue: 400 }) : 400,
      enemyDamage: ConfigResolver ? ConfigResolver.get('enemy.projectileDamage', { defaultValue: 5 }) : 5
    };
    
    // Registrace čištění při opuštění hranic světa (prevence memory leaks)
    this._setupWorldBoundsCleanup();
    
    // Čištění při ukončení scény - prevence úniku paměti
    scene.events.once('shutdown', () => {
      this._cleanupSystem();
    });
  }
  
  /**
   * Vygeneruje texturu projektilu jednou při inicializaci
   * Rychlejší než vytváření grafiky za běhu
   */
  _generateBulletTexture() {
    // Generate default bullet texture for fallback
    if (!this.scene.textures.exists('bullet8')) {
      const graphics = this._createGraphics();
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(4, 4, 4);
      graphics.generateTexture('bullet8', 8, 8);
      
      // PR7: Properly clean up graphics object
      if (this.scene.graphicsFactory) {
        this.scene.graphicsFactory.release(graphics);
      } else {
        graphics.destroy();
      }
    }
    
    // Generate textures from blueprints if available
    this._generateProjectileTexturesFromBlueprints();
  }
  
  /**
   * Generate projectile textures from blueprints using ShapeRenderer
   */
  _generateProjectileTexturesFromBlueprints() {
    if (!this.scene.blueprintLoader) return;
    
    // PR7: Dynamically get ALL projectile blueprints from loader
    const allBlueprints = this.scene.blueprintLoader.getAll ? 
      this.scene.blueprintLoader.getAll() : 
      this.scene.blueprintLoader.blueprints || {};
    
    // Filter for projectile blueprints
    const projectileBlueprints = [];
    for (const [id, blueprint] of Object.entries(allBlueprints)) {
      if (blueprint && blueprint.type === 'projectile') {
        projectileBlueprints.push({ id, blueprint });
      }
    }
    
    // Generate textures for all projectile blueprints
    projectileBlueprints.forEach(({ id, blueprint }) => {
      
      // Get graphics config from blueprint
      const graphics = blueprint.graphics || {};
      const shape = graphics.shape || 'circle';
      const tint = graphics.tint || 0xFFFFFF;
      const size = graphics.size || 8;
      
      // Generate texture name
      const textureName = `projectile_${id.replace('projectile.', '')}`;
      
      if (this.scene.textures.exists(textureName)) return;
      
      // Create graphics for this projectile
      const gfx = this._createGraphics();
      
      // Draw shape using ShapeRenderer
      ShapeRenderer.drawShape(gfx, shape, size/2, size/2, size/2 - 1, {
        fillColor: tint,
        fillAlpha: 1.0,
        strokeColor: shape === 'star' ? 0xFFFFFF : null,
        strokeWidth: shape === 'star' ? 1 : 0,
        strokeAlpha: 0.8
      });
      
      // Generate texture
      gfx.generateTexture(textureName, size, size);
      
      // PR7: Properly clean up graphics object
      if (this.scene.graphicsFactory) {
        this.scene.graphicsFactory.release(gfx);
      } else {
        gfx.destroy();
      }
      
      console.log(`[ProjectileSystem] Generated texture '${textureName}' with shape '${shape}'`);
    });
  }
  
  /**
   * Get projectile texture name from blueprint ID
   */
  _getProjectileTexture(projectileId) {
    if (!projectileId) return 'bullet8';
    
    // Try to get texture from generated projectile textures
    const textureName = `projectile_${projectileId.replace('projectile.', '')}`;
    
    if (this.scene.textures.exists(textureName)) {
      return textureName;
    }
    
    // Fallback to default
    return 'bullet8';
  }
  
  /**
   * Nastaví handler pro automatické čištění projektilů mimo hranice světa
   * Zabraňuje hromadění neviditelných projektilů
   */
  _setupWorldBoundsCleanup() {
    // Uložení reference pro správné vyčištění
    this._onWorldBounds = (body) => {
      const go = body.gameObject;
      if (go && typeof go.kill === 'function') {
        go.kill();
      }
    };
    
    this.scene.physics.world.on('worldbounds', this._onWorldBounds);
  }
  
  /**
   * Vyčistí systémové prostředky pro prevenci úniku paměti
   * Volá se při ukončení scény
   */
  _cleanupSystem() {
    // Odpojení listeneru hranic světa - kontrola existence physics world
    if (this._onWorldBounds && this.scene.physics && this.scene.physics.world) {
      this.scene.physics.world.off('worldbounds', this._onWorldBounds);
      this._onWorldBounds = null;
    }
    
    // Vyčištění všech projektilů bez zničení poolů
    this.clearAll();
  }
  
  /**
   * Vystřelí hráčský projektil - Zero-GC API pouze se skaláry
   * @param {number} x - X pozice hráče
   * @param {number} y - Y pozice hráče
   * @param {number} dirX - Směr X (automaticky normalizováno)
   * @param {number} dirY - Směr Y (automaticky normalizováno)  
   * @param {number} speedMultiplier - Násobič rychlosti (výchozí 1.0)
   * @param {number} rangeMultiplier - Násobič dosahu (výchozí 1.0)
   * @param {number} damageMultiplier - Násobič poškození (výchozí 1.0)
   * @param {number} tint - Barevný odstín (výchozí bílá)
   * @returns {boolean} - True pokud byl projektil vystřelen, false pokud je pool plný
   */
  firePlayer(x, y, dirX, dirY, speedMultiplier = 1.0, rangeMultiplier = 1.0, damageMultiplier = 1.0, tint = 0xffffff, projectileId = 'projectile.cytotoxin') {
    const bullet = this.playerBullets.get();
    if (!bullet) {
      // Pool vyčerpán - elegantní degradace, bez spamu
      if (Math.random() < 0.01) { // Logovat pouze 1% selhání
        console.warn('[ProjectileSystemV2] Pool hráčských projektilů je vyčerpán');
      }
      return false;
    }
    
    // Get texture for this projectile
    const textureName = this._getProjectileTexture(projectileId);
    bullet.setTexture(textureName);
    
    // Play player shoot sound from blueprint - PR7 compliant
    if (this.scene.audioSystem) {
      const player = this.scene.player;
      const shootSFX = player?.blueprint?.sfx?.shoot;
      if (shootSFX) {
        this.scene.audioSystem.play(shootSFX);
      } else {
        console.warn('[ProjectileSystem] Missing shoot sound in player blueprint');
      }
    }
    
    // Set projectile depth
    const projectileDepth = this.scene.DEPTH_LAYERS?.PROJECTILES || 3000;
    bullet.setDepth(projectileDepth); // Player projectiles at base projectile depth
    
    // Výpočet finálních statistik s násobiči z power-upů
    const speed = this.config.speed * speedMultiplier;
    const range = this.config.range * rangeMultiplier;
    const damage = this.config.damage * damageMultiplier;
    
    // Vystřelení pomocí zero-GC API
    bullet.fire(x, y, dirX, dirY, speed, range, damage, tint);
    
    // Add piercing properties from player if active
    const player = this.scene.player;
    if (player && player.piercingLevel > 0) {
        bullet.piercing = true;
        bullet.maxPiercing = player.piercingMaxPierces || 1;
        bullet.hitCount = 0;
        bullet.damageReduction = player.piercingDamageReduction || 0.1;
        
        // Debug: Log piercing setup occasionally
        if (Math.random() < 0.01) {
            console.log(`[ProjectileSystem] ✅ PIERCING - Max pierces: ${bullet.maxPiercing}, damage reduction: ${(bullet.damageReduction * 100).toFixed(1)}%`);
        }
    } else {
        // Ensure no piercing properties if not active
        bullet.piercing = false;
        bullet.maxPiercing = 0;
        bullet.hitCount = 0;
    }
    
    // Přehrání zvuku střelby (volitelné, s ošetřením chyb)
    try {
      this.scene.audioManager?.playSound?.('shoot');
    } catch (_) {}
    
    return true;
  }
  
  /**
   * Vystřelí nepřátelský projektil - Zero-GC API pouze se skaláry  
   * @param {number} x - X pozice nepřítele
   * @param {number} y - Y pozice nepřítele
   * @param {number} dirX - Směr X (automaticky normalizováno)
   * @param {number} dirY - Směr Y (automaticky normalizováno)
   * @param {number} speed - Rychlost v px/s (výchozí z konfigurace)
   * @param {number} range - Dosah v px (výchozí z konfigurace) 
   * @param {number} damage - Hodnota poškození
   * @param {boolean|string} tracking - Naváděný projektil (false/true/'DEFAULT'/'TRACKING'/'AGGRESSIVE'/'LAZY')
   * @param {string} sourceType - Identifikátor zdroje (např. 'boss:metastaza')
   * @param {number} tint - Barevný odstín (výchozí červená)
   * @returns {boolean} - True pokud byl projektil vystřelen, false pokud je pool plný
   */
  fireEnemy(x, y, dirX, dirY, speed = null, range = null, damage = null, tracking = false, sourceType = null, tint = 0xff0000, projectileId = 'projectile.cytotoxin_enhanced') {
    // PR7: Use values from config if not provided
    speed = speed || this.config.enemySpeed;
    range = range || this.config.enemyRange;
    damage = damage || this.config.enemyDamage;
    const bullet = this.enemyBullets.get();
    if (!bullet) {
      // Pool vyčerpán - elegantní degradace, bez spamu
      if (Math.random() < 0.01) { // Logovat pouze 1% selhání  
        console.warn('[ProjectileSystemV2] Pool nepřátelských projektilů je vyčerpán');
      }
      return false;
    }
    
    // Get texture for enemy projectile  
    const textureName = this._getProjectileTexture(projectileId);
    bullet.setTexture(textureName);
    
    // Set projectile depth
    const projectileDepth = this.scene.DEPTH_LAYERS?.PROJECTILES || 3000;
    bullet.setDepth(projectileDepth + 1); // Enemy projectiles slightly above
    
    // Vystřelení pomocí zero-GC API
    bullet.fire(x, y, dirX, dirY, speed, range, damage, tracking, sourceType, tint);
    
    return true;
  }
  
  /**
   * Kompatibilní metoda pro starší kód - převádí staré API na nové
   * Zvládá starý styl (x, y, velocity, damage) i nový styl (options objekt)
   */
  createPlayerProjectile(xOrOptions, y, velocity, damage, color = 0xffffff) {
    // Nový PR7 styl: jediný options objekt
    if (typeof xOrOptions === 'object' && xOrOptions.x !== undefined) {
      const opts = xOrOptions;
      const dirX = Math.cos(opts.angleRad || 0);
      const dirY = Math.sin(opts.angleRad || 0);
      // Get projectile ID from options or use default
      const projectileId = opts.projectileBlueprintId || 'projectile.player_basic';
      return this.firePlayer(opts.x, opts.y, dirX, dirY, 1.0, 1.0, (opts.damage || 10) / this.config.damage, 0xffffff, projectileId);
    }
    
    // Starší styl: oddělené parametry
    return this.firePlayer(xOrOptions, y, velocity.x, velocity.y, 1.0, 1.0, damage / this.config.damage, color, 'projectile.player_basic');
  }
  
  /**
   * Kompatibilní metoda pro nepřátelské projektily
   * Zachována pro zpětnou kompatibilitu
   */
  createEnemyProjectile(xOrOptions, y, velocity, damage, color = 0xff0000, tracking = false, sourceType = null) {
    // Nový PR7 styl: jediný options objekt
    if (typeof xOrOptions === 'object' && xOrOptions.x !== undefined) {
      const opts = xOrOptions;
      const vel = opts.velocity || { x: 0, y: 0 };
      // PR7: Get projectileId from options if available
      const projectileId = opts.projectileId || opts.projectileBlueprintId || 'projectile.cytotoxin_enhanced';
      return this.fireEnemy(
        opts.x, opts.y, vel.x, vel.y, 
        opts.speed || null,  // Let fireEnemy use defaults from config
        opts.range || null, 
        opts.damage || null, 
        opts.homing || false, 
        opts.owner?.type || null, 
        opts.color || 0xff0000,
        projectileId
      );
    }
    
    // Starší styl: oddělené parametry - use null to let fireEnemy apply defaults
    return this.fireEnemy(xOrOptions, y, velocity.x, velocity.y, null, null, damage, tracking, sourceType, color);
  }
  
  /**
   * Update metoda - zachována pro kompatibilitu, skutečné updaty přes runChildUpdate
   * Fyzikální skupina s runChildUpdate: true zpracovává updaty automaticky
   */
  update(time, delta) {
    // Fyzikální skupina s runChildUpdate: true zpracovává updaty automaticky
    // Tato metoda zachována pro zpětnou kompatibilitu a budoucí rozšíření
  }
  
  /**
   * PR7: Pause all projectiles - stop their movement
   */
  pauseAll() {
    this.getPlayerBullets().forEach(bullet => {
      if (bullet?.body) {
        // Store current velocity for resume
        bullet._pausedVelocity = { x: bullet.body.velocity.x, y: bullet.body.velocity.y };
        bullet.body.setVelocity(0, 0);
      }
    });
    
    this.getEnemyBullets().forEach(bullet => {
      if (bullet?.body) {
        // Store current velocity for resume
        bullet._pausedVelocity = { x: bullet.body.velocity.x, y: bullet.body.velocity.y };
        bullet.body.setVelocity(0, 0);
      }
    });
  }
  
  /**
   * PR7: Resume all projectiles - restore their movement
   */
  resumeAll() {
    this.getPlayerBullets().forEach(bullet => {
      if (bullet?.body && bullet._pausedVelocity) {
        bullet.body.setVelocity(bullet._pausedVelocity.x, bullet._pausedVelocity.y);
        delete bullet._pausedVelocity;
      }
    });
    
    this.getEnemyBullets().forEach(bullet => {
      if (bullet?.body && bullet._pausedVelocity) {
        bullet.body.setVelocity(bullet._pausedVelocity.x, bullet._pausedVelocity.y);
        delete bullet._pausedVelocity;
      }
    });
  }
  
  /**
   * Vyčistí všechny projektily bez zničení poolů - udržuje pooly připravené
   * Důležité pro výkon - nedochází k dealokaci a realokaci paměti
   */
  clearAll() {
    // Použití getChildren() API pro konzistentní přístup
    this.getPlayerBullets().forEach(bullet => {
      if (bullet?.kill) bullet.kill();
    });
    
    this.getEnemyBullets().forEach(bullet => {
      if (bullet?.kill) bullet.kill();
    });
    
    // Pozn: NEPOUŽÍVÁME clear() který ničí instance
    // Pooly zůstávají připravené k okamžitému použití
  }
  
  /**
   * Alias pro clearAll pro konzistenci s GameScene
   */
  clearAllProjectiles() {
    this.clearAll();
  }
  
  /**
   * Získá hráčské projektily - konzistentní API
   * @returns {Array} Pole aktivních hráčských projektilů
   */
  getPlayerBullets() {
    // Bezpečná kontrola pro ukončení scény - vyhnout se pádu při undefined children
    if (!this.playerBullets || !this.playerBullets.children) return [];
    try {
      return this.playerBullets.getChildren() || [];
    } catch (e) {
      // Scéna se ukončuje, vrátit prázdné pole
      return [];
    }
  }
  
  /**
   * Získá nepřátelské projektily - konzistentní API
   * @returns {Array} Pole aktivních nepřátelských projektilů
   */
  getEnemyBullets() {
    // Bezpečná kontrola pro ukončení scény - vyhnout se pádu při undefined children
    if (!this.enemyBullets || !this.enemyBullets.children) return [];
    try {
      return this.enemyBullets.getChildren() || [];
    } catch (e) {
      // Scéna se ukončuje, vrátit prázdné pole
      return [];
    }
  }
  
  /**
   * Vytvoří efekt exploze pro výbušné projektily
   * @param {number} x - X střed exploze
   * @param {number} y - Y střed exploze
   * @param {number} damage - Poškození exploze
   * @param {number} radius - Poloměr exploze v pixelech
   * @param {number} level - Úroveň power-upu pro škálování
   */
  createExplosion(x, y, damage, radius, level) {
    if (!this.scene.enemyManager?.enemies) return 0;
    
    // Najít nepřátele v poloměru exploze - AABB pre-filter pro výkon
    const enemies = this.scene.enemyManager?.enemies?.getChildren() || [];
    const hitEnemies = [];
    const radiusSquared = radius * radius; // Vyhnout se sqrt při výpočtu vzdálenosti
    
    // Generovat unikátní ID exploze pro prevenci duplicitních zásahů
    const explosionId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    enemies.forEach(enemy => {
      if (!enemy.active) return;
      
      // Prevence duplicitních zásahů exploze na stejného nepřítele
      if (enemy._lastExplosionId === explosionId) return;
      
      // Rychlá AABB kontrola nejdřív (rychlejší než vzdálenost)
      const dx = Math.abs(enemy.x - x);
      const dy = Math.abs(enemy.y - y);
      if (dx > radius || dy > radius) return;
      
      // Přesná kontrola kruhu pomocí kvadratické vzdálenosti
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared <= radiusSquared) {
        enemy._lastExplosionId = explosionId; // Označit jako zasažený touto explozí
        hitEnemies.push(enemy);
      }
    });
    
    // Aplikovat poškození exploze
    hitEnemies.forEach(enemy => {
      if (enemy.takeDamage && typeof enemy.takeDamage === 'function') {
        enemy.takeDamage(damage);
        
        // Analytics sledování pro zásahy explozí
        try {
          this.scene.recordDamageDealt?.(damage, enemy);
        } catch (_) {}
        
        // Zpracovat smrt nepřítele
        if (enemy.hp <= 0) {
          this.scene.handleEnemyDeath?.(enemy);
        }
      }
    });
    
    // PR7: VFX/SFX integrace pro exploze
    if (this.scene.vfxSystem) {
      this.scene.vfxSystem.play('vfx.explosion.small', x, y);
    }
    if (this.scene.audioSystem) {
      // Get explosion sound from projectile blueprint if available
      const projectileBlueprint = this.blueprintLoader?.getBlueprint(projectileId);
      const explosionSFX = projectileBlueprint?.sfx?.explosion;
      if (explosionSFX) {
        this.scene.audioSystem.play(explosionSFX);
      } else {
        console.warn('[ProjectileSystem] Missing explosion sound in projectile blueprint:', projectileId);
      }
    }
    
    // Záložní řešení pro starší systémy
    if (this.scene.vfxSystem) {
      this.scene.vfxSystem.playExplosion(x, y, 'explosive');
    }
    try {
      this.scene.audioManager?.playSound?.('explosion');
    } catch (_) {}
    
    return hitEnemies.length; // Vrátit počet zasažených nepřátel
  }
  
  /**
   * Získá statistiky pro ladění a analytiku
   * @returns {object} Objekt se statistikami poolů
   */
  getStats() {
    return {
      player: {
        active: this.playerBullets.countActive(),
        total: this.playerBullets.children.size,
        pooled: this.playerBullets.children.size - this.playerBullets.countActive()
      },
      enemy: {
        active: this.enemyBullets.countActive(),
        total: this.enemyBullets.children.size,
        pooled: this.enemyBullets.children.size - this.enemyBullets.countActive()
      }
    };
  }
  
  // ==========================================
  // PR7 Factory Methods - Replace Direct Calls
  // ==========================================
  
  /**
   * Factory method for creating graphics objects
   * @returns {Phaser.GameObjects.Graphics}
   * @private
   */
  _createGraphics() {
    // PR7: Use GraphicsFactory for all graphics creation
    if (!this.scene || !this.scene.graphicsFactory) {
      // Fallback only if GraphicsFactory is not available (should not happen in production)
      console.warn('[ProjectileSystem] GraphicsFactory not available, using fallback');
      if (!this.scene.add) {
        throw new Error('[ProjectileSystem] Scene not available for graphics creation');
      }
      return this.scene.add.graphics();
    }
    return this.scene.graphicsFactory.create();
  }
}