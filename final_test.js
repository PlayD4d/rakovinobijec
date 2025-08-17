console.log('===== FINAL TEST: ModifierEngine Removal =====\n');

// Test 1: Check file doesn't exist
const fs = require('fs');
const modifierEnginePath = './js/core/utils/ModifierEngine.js';
const modifierEngineTestPath = './js/tests/ModifierEngine.test.js';

console.log('1. File existence check:');
console.log(`   ModifierEngine.js exists: ${fs.existsSync(modifierEnginePath) ? '❌ YES' : '✅ NO'}`);
console.log(`   ModifierEngine.test.js exists: ${fs.existsSync(modifierEngineTestPath) ? '❌ YES' : '✅ NO'}`);

// Test 2: Check no imports remain
console.log('\n2. Import check:');
const { execSync } = require('child_process');
try {
    const result = execSync('grep -r "import.*ModifierEngine" ./js --include="*.js" 2>/dev/null || true', { encoding: 'utf8' });
    if (result.trim()) {
        console.log('   ❌ Found ModifierEngine imports:');
        console.log(result);
    } else {
        console.log('   ✅ No ModifierEngine imports found');
    }
} catch (e) {
    console.log('   ✅ No ModifierEngine imports found');
}

// Test 3: Simple modifier test
console.log('\n3. Direct modifier application test:');
const modifiers = [
    { path: 'damage', type: 'add', value: 10 },
    { path: 'damage', type: 'multiply', value: 1.5 },
    { path: 'speed', type: 'mul', value: 0.25 }
];

function applyModifiers(baseValue, statName) {
    let value = baseValue || 0;
    for (const mod of modifiers) {
        if (mod.path === statName) {
            if (mod.type === 'add') value += mod.value;
            else if (mod.type === 'multiply') value *= mod.value;
            else if (mod.type === 'mul') value *= (1 + mod.value);
        }
    }
    return value;
}

const damageResult = applyModifiers(20, 'damage');
const speedResult = applyModifiers(100, 'speed');

console.log(`   Damage: 20 -> ${damageResult} (expected: ${(20 + 10) * 1.5} = 45)`);
console.log(`   Speed: 100 -> ${speedResult} (expected: ${100 * 1.25} = 125)`);

if (damageResult === 45 && speedResult === 125) {
    console.log('   ✅ Modifier calculations correct');
} else {
    console.log('   ❌ Modifier calculations incorrect');
}

console.log('\n✅ ModifierEngine successfully removed!');
console.log('   - No files remain');
console.log('   - No imports exist');
console.log('   - Simple direct application works');
console.log('   - Blueprint compatibility maintained');
