// BossSystem – FSM skeleton (Fáze 4, zatím bez zásahu do útoků)
// Účel: sledovat fáze bosse dle blueprintu a připravit napojení na akce

import { performShootFan, performShootCircle, performTrackingShot, performPlaceZone } from '../utils/bossActions.js';
// PR7: GameConfig removed - use ConfigResolver only
// import { GameConfig } from '../../config.js';

export class BossSystem {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    /** @type {Map<any, any>} */
    this.tracked = new Map(); // boss -> { bp, currentIndex }
  }

  // Připojí bosse k systému a nastaví počáteční fázi
  attach(boss, blueprint) {
    if (!boss || !blueprint || !Array.isArray(blueprint.phases)) return;
    this.tracked.set(boss, { bp: blueprint, currentIndex: 0, lastActionAt: 0 });
    // PR7: Use ConfigResolver for experimental boss actions flag
    try {
      const CR = this.scene.configResolver || window.ConfigResolver;
      boss.useCoreActions = CR ? CR.get('boss.experimentalActions', { defaultValue: false }) : false;
      if (boss.useCoreActions) {
        console.log('[Core] Boss core actions ENABLED');
      } else {
        console.log('[Core] Boss core actions DISABLED');
      }
    } catch (_) { boss.useCoreActions = false; }
    // Počáteční fáze – nic nespouštíme (útoky stále řeší Boss.js)
    try { console.log('[Core] BossSystem attached:', blueprint.name || boss.bossName); } catch (_) {}
  }

  // Odpojí bosse (po smrti/cleanup)
  detach(boss) {
    this.tracked.delete(boss);
  }

  update(time, delta) {
    if (this.tracked.size === 0) return;
    this.tracked.forEach((state, boss) => {
      if (!boss || !boss.active) {
        this.tracked.delete(boss);
        return;
      }
      const { bp } = state;
      const hpRatio = Math.max(0, Math.min(1, boss.hp / (boss.maxHp || 1)));
      // Najít odpovídající fázi podle prahu (threshold klesá s HP)
      let idx = 0;
      for (let i = 0; i < bp.phases.length; i++) {
        if (hpRatio <= bp.phases[i].threshold) idx = i;
      }
      if (idx !== state.currentIndex) {
        // Přepnutí fáze – zatím pouze log; akce spustíme v dalším kroku
        const prev = state.currentIndex;
        state.currentIndex = idx;
        try {
          const p = bp.phases[idx];
          console.log(`[Core] Boss phase changed: ${prev} → ${idx} (${p.fsmState})`);
          // Analytics: nastavit fázi pro případnou smrt hráče v této fázi
          this.scene.analyticsManager?.setBossPhase?.(idx);
        } catch (_) {}
      }

      // Pokud jsou povolené core akce, spouštěj jednoduchý vzorec podle aktivní fáze
      if (boss.useCoreActions) {
        const now = time;
        const phase = bp.phases[state.currentIndex] || { actions: [] };
        // Cooldowny z blueprintu nebo defaulty – použij nejmenší cooldown z akcí ve fázi
        const cdMap = bp.cooldowns || {};
        const defaultCd = 1500;
        const cd = Math.min(...(phase.actions.length ? phase.actions : ['_']).map(a => cdMap[a] || defaultCd));
        if (now - state.lastActionAt > cd) {
          // Pro jednoduchost: v každém tiknutí proveď všechny akce fáze
          phase.actions.forEach(action => {
            switch (action) {
              case 'shoot_fan':
                performShootFan(this.scene, boss, boss.damage);
                this.scene.analyticsManager?.trackBossAction?.('shoot_fan', state.currentIndex);
                break;
              case 'shoot_circle':
                performShootCircle(this.scene, boss, boss.damage);
                this.scene.analyticsManager?.trackBossAction?.('shoot_circle', state.currentIndex);
                break;
              case 'tracking_burst':
                performTrackingShot(this.scene, boss, boss.damage);
                this.scene.analyticsManager?.trackBossAction?.('tracking_burst', state.currentIndex);
                // Speciální akce – navýšit čítač
                this.scene.analyticsManager?.incrementBossSpecialAttacksUsed?.();
                break;
              case 'place_zone':
                performPlaceZone(this.scene, boss, boss.damage);
                this.scene.analyticsManager?.trackBossAction?.('place_zone', state.currentIndex);
                // Speciální akce – navýšit čítač
                this.scene.analyticsManager?.incrementBossSpecialAttacksUsed?.();
                break;
              default:
                break;
            }
          });
          state.lastActionAt = now;
        }
      }
    });
  }
}


