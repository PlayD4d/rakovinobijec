/**
 * PR4: SettingsManager Integration Smoke Test
 * 
 * Testuje okamžitou aplikaci settings změn na připojené systémy
 * Validuje profile switching a auto-apply funkcionalitu
 */

import { SettingsManager } from '../core/settings/SettingsManager.js';

/**
 * Smoke test - rychlý test základní funkcionality
 */
export function runSmokeTest() {
  console.log('🧪 Running PR4 SettingsManager Smoke Test...');
  
  const results = {
    profileSwitch: false,
    autoApply: false,
    eventSystem: false,
    systemConnection: false,
    errors: []
  };

  try {
    // Create test SettingsManager instance
    const testManager = new SettingsManager();

    // Test 1: Profile switching
    console.log('📋 Testing profile switching...');
    const initialProfile = testManager.getAudioSettings().profile;
    testManager.applyProfile('combat');
    const combatProfile = testManager.getAudioSettings();
    
    if (combatProfile.profile === 'combat' && combatProfile.master === 0.8) {
      results.profileSwitch = true;
      console.log('✅ Profile switching works');
    } else {
      results.errors.push('Profile switching failed');
    }

    // Test 2: Event system
    console.log('📋 Testing event system...');
    let eventFired = false;
    testManager.addEventListener('audio.volume.master', (newValue) => {
      eventFired = true;
      console.log(`Event fired: master volume = ${newValue}`);
    });
    
    testManager.setAudioVolume('master', 0.5);
    if (eventFired) {
      results.eventSystem = true;
      console.log('✅ Event system works');
    } else {
      results.errors.push('Event system failed');
    }

    // Test 3: Mock system connection
    console.log('📋 Testing system connection...');
    let sfxVolumeSet = false;
    let vfxModeSet = false;
    
    const mockSFXSystem = {
      setVolume: (category, volume) => { sfxVolumeSet = true; },
      setVolumeProfile: (profile) => {},
      setPerformanceMode: (mode) => {}
    };
    
    const mockVFXSystem = {
      setPerformanceMode: (mode) => { vfxModeSet = true; },
      setMaxEmitters: (max) => {},
      setCameraShakeIntensity: (intensity) => {},
      setFlashEnabled: (enabled) => {},
      setReducedMotion: (reduced) => {}
    };

    testManager.connectSystems({ sfx: mockSFXSystem, vfx: mockVFXSystem });

    // Test auto-apply - ensure change from default values
    const initialPerf = testManager.getPerformanceSettings();
    console.log('Initial performance settings:', initialPerf);
    
    testManager.setAudioVolume('sfx', 0.7);
    // Change from default 'medium' to 'high' 
    testManager.setPerformanceMode('vfx', initialPerf.vfx === 'high' ? 'low' : 'high');
    
    console.log('Debug: sfxVolumeSet =', sfxVolumeSet, 'vfxModeSet =', vfxModeSet);

    if (sfxVolumeSet && vfxModeSet) {
      results.systemConnection = true;
      results.autoApply = true;
      console.log('✅ System connection and auto-apply works');
    } else {
      results.errors.push(`System connection failed: sfx=${sfxVolumeSet}, vfx=${vfxModeSet}`);
    }

    // Test accessibility settings
    testManager.setCameraShakeIntensity(0.5);
    testManager.setFlashStrobeEnabled(false);
    testManager.setReducedMotion(true);
    
    const a11ySettings = testManager.getAccessibilitySettings();
    if (a11ySettings.cameraShake === 0.5 && !a11ySettings.flashStrobe && a11ySettings.reduceMotion) {
      console.log('✅ Accessibility settings work');
    } else {
      results.errors.push('Accessibility settings failed');
    }

  } catch (error) {
    results.errors.push(`Test execution error: ${error.message}`);
    console.error('❌ Smoke test error:', error);
  }

  // Report results
  const passed = results.profileSwitch && results.autoApply && results.eventSystem && results.systemConnection;
  
  if (passed && results.errors.length === 0) {
    console.log('🎉 PR4 SettingsManager Smoke Test: ALL PASSED');
    return true;
  } else {
    console.log('❌ PR4 SettingsManager Smoke Test: FAILED');
    console.log('Results:', results);
    return false;
  }
}

/**
 * Browser-based performance test
 */
export function runPerformanceTest() {
  if (typeof window === 'undefined') {
    console.log('⚠️ Performance test requires browser environment');
    return;
  }

  console.log('⚡ Running SettingsManager Performance Test...');
  
  const manager = new SettingsManager();
  const iterations = 1000;
  
  // Test setting change performance
  const start = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    manager.setAudioVolume('master', Math.random());
    manager.setPerformanceMode('vfx', i % 2 === 0 ? 'high' : 'low');
    manager.setCameraShakeIntensity(Math.random());
  }
  
  const end = performance.now();
  const avgTime = (end - start) / iterations;
  
  console.log(`📊 Performance Test Results:`);
  console.log(`   ${iterations} setting changes in ${(end - start).toFixed(2)}ms`);
  console.log(`   Average per setting: ${avgTime.toFixed(4)}ms`);
  
  if (avgTime < 1.0) {
    console.log('✅ Performance test passed (< 1ms per setting)');
    return true;
  } else {
    console.log('⚠️ Performance test warning: settings changes are slow');
    return false;
  }
}

// Browser console integration
if (typeof window !== 'undefined') {
  window.__pr4SmokeTest = {
    run: runSmokeTest,
    performance: runPerformanceTest,
    profiles: () => {
      console.log('Testing profile switching...');
      const manager = new SettingsManager();
      
      ['silent', 'quiet', 'combat', 'cinematic'].forEach(profile => {
        manager.applyProfile(profile);
        const settings = manager.getAudioSettings();
        console.log(`Profile ${profile}:`, settings);
      });
    }
  };
}

export default { runSmokeTest, runPerformanceTest };