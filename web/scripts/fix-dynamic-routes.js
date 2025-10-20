const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all route files
const routeFiles = execSync('find app/api -name "route.ts" -type f', { cwd: __dirname + '/..', encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

console.log(`Found ${routeFiles.length} API route files`);

let fixed = 0;
let skipped = 0;

routeFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Check if already has dynamic export
  if (content.includes("export const dynamic")) {
    console.log(`⏭️  Skipped (already has dynamic): ${file}`);
    skipped++;
    return;
  }

  // Add dynamic export at the top (after imports)
  const lines = content.split('\n');
  let insertIndex = 0;

  // Find the last import statement
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith('import{')) {
      insertIndex = i + 1;
    } else if (lines[i].trim() === '' && insertIndex > 0) {
      // Found empty line after imports
      break;
    }
  }

  // Insert the dynamic export
  lines.splice(insertIndex, 0, '', "export const dynamic = 'force-dynamic'", '');

  const newContent = lines.join('\n');
  fs.writeFileSync(filePath, newContent, 'utf8');

  console.log(`✅ Fixed: ${file}`);
  fixed++;
});

console.log(`\n✅ Fixed: ${fixed} files`);
console.log(`⏭️  Skipped: ${skipped} files`);
console.log(`\nTotal: ${routeFiles.length} files processed`);
