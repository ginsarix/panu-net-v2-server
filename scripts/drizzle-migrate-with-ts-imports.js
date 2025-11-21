#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCHEMA_DIR = join(__dirname, '../src/db/schema');

// Find all TypeScript files in the schema directory
function getAllSchemaFiles() {
  const files = readdirSync(SCHEMA_DIR);
  return files.filter((file) => file.endsWith('.ts')).map((file) => join(SCHEMA_DIR, file));
}

// Read and backup all schema files
console.log('📖 Reading schema files...');
const schemaFiles = getAllSchemaFiles();
const backups = new Map();

for (const filePath of schemaFiles) {
  const content = readFileSync(filePath, 'utf-8');
  // Only backup files that have .js imports
  if (/from ['"]\.\/.*\.js['"]/.test(content)) {
    backups.set(filePath, content);
  }
}

if (backups.size === 0) {
  console.log('ℹ️  No files with .js imports found. Nothing to update.');
  process.exit(0);
}

// Replace .js imports with .ts imports in all files
console.log(`🔄 Temporarily changing .js imports to .ts imports in ${backups.size} file(s)...`);
for (const [filePath, originalContent] of backups.entries()) {
  const modifiedContent = originalContent.replace(
    /from ['"]\.\/([^'"]+)\.js['"]/g,
    "from './$1.ts'",
  );
  writeFileSync(filePath, modifiedContent, 'utf-8');
  const fileName = filePath.split('/').pop();
  console.log(`  ✓ Updated ${fileName}`);
}

console.log('✅ All imports updated to .ts');

try {
  // Run drizzle generate
  console.log('\n🔧 Running drizzle-kit generate...');
  execSync('npm run drizzle:generate', {
    cwd: join(__dirname, '..'),
    stdio: 'inherit',
  });

  // Run drizzle migrate
  console.log('\n🚀 Running drizzle-kit migrate...');
  execSync('npm run drizzle:migrate', {
    cwd: join(__dirname, '..'),
    stdio: 'inherit',
  });

  console.log('\n✅ Drizzle generation and migration completed successfully!');
} catch (error) {
  console.error('\n❌ Error during drizzle operations:', error.message);
  throw error;
} finally {
  // Always restore the original content
  console.log('\n🔄 Restoring original .js imports...');
  for (const [filePath, originalContent] of backups.entries()) {
    writeFileSync(filePath, originalContent, 'utf-8');
    const fileName = filePath.split('/').pop();
    console.log(`  ✓ Restored ${fileName}`);
  }
  console.log('✅ All original imports restored');
}
