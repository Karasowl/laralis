const fs = require('fs');
const path = require('path');

// Load translation files
const enMessages = JSON.parse(fs.readFileSync(path.join(__dirname, '../messages/en.json'), 'utf8'));
const esMessages = JSON.parse(fs.readFileSync(path.join(__dirname, '../messages/es.json'), 'utf8'));
const enOverrides = JSON.parse(fs.readFileSync(path.join(__dirname, '../messages/en-overrides.json'), 'utf8'));
const esOverrides = JSON.parse(fs.readFileSync(path.join(__dirname, '../messages/es-overrides.json'), 'utf8'));

// Function to find keys with dots in their names (invalid)
function findInvalidKeys(obj, prefix = '') {
  const invalidKeys = [];
  
  for (const key in obj) {
    if (key.includes('.')) {
      invalidKeys.push(prefix + key);
    }
    
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      invalidKeys.push(...findInvalidKeys(obj[key], prefix + key + '.'));
    }
  }
  
  return invalidKeys;
}

console.log('🔍 Checking translation files for invalid keys...\n');

// Check each file
const files = {
  'en.json': enMessages,
  'es.json': esMessages,
  'en-overrides.json': enOverrides,
  'es-overrides.json': esOverrides
};

let hasErrors = false;

for (const [filename, content] of Object.entries(files)) {
  const invalidKeys = findInvalidKeys(content);
  
  if (invalidKeys.length > 0) {
    console.log(`❌ ${filename} has invalid keys:`);
    invalidKeys.forEach(key => console.log(`   - ${key}`));
    console.log('');
    hasErrors = true;
  } else {
    console.log(`✅ ${filename} is valid`);
  }
}

// Check that required keys exist
console.log('\n🔍 Checking for required onboarding.actions keys...\n');

const requiredPaths = [
  'onboarding.actions.cancel',
  'onboarding.actions.cancelled',
  'onboarding.actions.creating',
  'onboarding.actions.next',
  'onboarding.actions.prev',
  'onboarding.actions.start',
  'expenses.actions.view'
];

function checkPath(obj, path) {
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return false;
    }
    current = current[part];
  }
  
  return true;
}

for (const path of requiredPaths) {
  const enExists = checkPath(enMessages, path);
  const esExists = checkPath(esMessages, path);
  
  if (!enExists || !esExists) {
    console.log(`❌ Missing key: ${path}`);
    if (!enExists) console.log(`   - Missing in en.json`);
    if (!esExists) console.log(`   - Missing in es.json`);
    hasErrors = true;
  } else {
    console.log(`✅ ${path} exists in both languages`);
  }
}

if (hasErrors) {
  console.log('\n❌ Translation validation failed! Please fix the issues above.');
  process.exit(1);
} else {
  console.log('\n✅ All translation files are valid!');
  process.exit(0);
}