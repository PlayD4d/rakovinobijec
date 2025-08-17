// Akční moduly pro bossy – používají stávající ProjectileManager, aby chování zůstalo konzistentní

export function performShootFan(scene, boss, damage) {
  try {
    const player = scene.player;
    const baseAngle = Phaser.Math.Angle.Between(boss.x, boss.y, player.x, player.y);
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue; // malá mezera uprostřed
      const spread = baseAngle + (i * 0.18);
      const velocity = { x: Math.cos(spread) * 250, y: Math.sin(spread) * 250 };
      scene.coreProjectileSystem.createEnemyProjectile(boss.x, boss.y, velocity, damage, 0xff0000, false, `boss:${boss.bossName || 'boss'}`);
    }
  } catch (_) {}
}

export function performShootCircle(scene, boss, damage) {
  try {
    const projectiles = 12;
    for (let i = 0; i < projectiles; i++) {
      const angle = (Math.PI * 2 / projectiles) * i;
      const velocity = { x: Math.cos(angle) * 200, y: Math.sin(angle) * 200 };
      scene.coreProjectileSystem.createEnemyProjectile(boss.x, boss.y, velocity, damage, 0xff0000, false, `boss:${boss.bossName || 'boss'}`);
    }
  } catch (_) {}
}

export function performTrackingShot(scene, boss, damage) {
  try {
    const player = scene.player;
    for (let i = 0; i < 3; i++) {
      scene.time.delayedCall(i * 300, () => {
        if (!boss.active) return;
        const angle = Phaser.Math.Angle.Between(boss.x, boss.y, player.x, player.y);
        const inaccuracy = (Math.random() - 0.5) * 0.35;
        const speed = 220;
        const velocity = { x: Math.cos(angle + inaccuracy) * speed, y: Math.sin(angle + inaccuracy) * speed };
        scene.coreProjectileSystem.createEnemyProjectile(boss.x, boss.y, velocity, damage, 0xff00ff, true, `boss:${boss.bossName || 'boss'}`);
      });
    }
  } catch (_) {}
}

// Vytvoří radioaktivní pole na náhodném místě a periodicky zraňuje hráče
export function performPlaceZone(scene, boss, damage) {
  try {
    const cam = scene.cameras.main;
    const x = Phaser.Math.Between(50, cam.width - 50);
    const y = Phaser.Math.Between(80, cam.height - 50);
    const radius = 60;
    const g = scene.add.graphics();
    g.fillStyle(0xffff00, 0.25);
    g.fillCircle(x, y, radius);
    g.lineStyle(3, 0xffff00, 0.6);
    g.strokeCircle(x, y, radius);
    // pulsing
    scene.tweens.add({ targets: g, alpha: 0.4, duration: 600, yoyo: true, repeat: 3 });
    // periodické poškození
    const ticks = 6;
    let count = 0;
    const timer = scene.time.addEvent({ delay: 500, loop: true, callback: () => {
      if (!boss.active) { timer.remove(false); g.destroy(); return; }
      const px = scene.player.x, py = scene.player.y;
      const d = Phaser.Math.Distance.Between(x, y, px, py);
      if (d <= radius && scene.player.canTakeDamage()) {
        scene.player.takeDamage(damage * 0.2);
      }
      count++;
      if (count >= ticks) { timer.remove(false); g.destroy(); }
    }});
  } catch (_) {}
}


