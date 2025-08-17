// Šablony efektů pro unikátní dropy
// Každý handler dostane kontext { scene, drop, params, analytics }

export const DropEffects = {
  // Původní chování metotrexátu – zabít všechny nepřátele (volitelně i bosse)
  mass_kill: ({ scene, params }) => {
    const affectBosses = params?.affectBosses ?? true;
    const flashMs = Number(params?.cameraFlashMs || 0);
    try { if (flashMs > 0) scene.cameras.main.flash(flashMs, 255, 255, 255); } catch (_) {}
    const enemies = scene.enemyManager.enemies.getChildren();
    enemies.forEach(e => {
      if (!e?.active) return;
      if (!affectBosses && e.bossName) return;
      // Omezit na viditelnou oblast (loot i kill)
      try {
        const cam = scene.cameras?.main;
        const within = cam ? (e.x >= 0 && e.x <= cam.width && e.y >= 0 && e.y <= cam.height) : true;
        if (!within) return;
      } catch (_) {}
      scene.handleEnemyDeath(e);
    });
  },

  // Nová varianta: udělit globální poškození všem nepřátelům
  global_damage: ({ scene, params }) => {
    const dmg = Math.max(0, Number(params?.amount) || 0);
    const affectBosses = params?.affectBosses ?? false;
    const flashMs = Number(params?.cameraFlashMs || 0);
    try { if (flashMs > 0) scene.cameras.main.flash(flashMs, 255, 255, 255); } catch (_) {}
    const enemies = scene.enemyManager.enemies.getChildren();
    enemies.forEach(e => {
      if (!e?.active) return;
      if (!affectBosses && e.bossName) return;
      // Omezit na viditelnou oblast (damage → případný kill/loot)
      try {
        const cam = scene.cameras?.main;
        const within = cam ? (e.x >= 0 && e.x <= cam.width && e.y >= 0 && e.y <= cam.height) : true;
        if (!within) return;
      } catch (_) {}
      scene.recordDamageDealt(dmg, e);
      e.takeDamage?.(dmg);
      if (e.hp <= 0) scene.handleEnemyDeath(e);
    });
  },
};


