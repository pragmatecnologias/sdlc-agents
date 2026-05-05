/**
 * Build script for WAR composite fixture.
 * Creates a minimal but valid WAR (ZIP) file using only Node built-ins.
 * Uses the stored ZIP format (no external dependencies needed).
 */

const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const warPath = path.join(outputDir, 'app.war');

// Files to include in the WAR
const files = {
  'WEB-INF/web.xml': '<?xml version="1.0" encoding="UTF-8"?><web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee"/>',
  'WEB-INF/classes/.gitkeep': '',
  'WEB-INF/lib/.gitkeep': '',
  'index.html': '<!DOCTYPE html><html><body>Enterprise WAR App</body></html>',
  'main.js': 'console.log("WAR app loaded");',
  'styles.css': 'body { font-family: sans-serif; }',
};

// Use system zip command (available on macOS/Linux)
const { execSync } = require('child_process');
try {
  // Clean any existing WAR
  if (fs.existsSync(warPath)) fs.unlinkSync(warPath);

  // Create temp directory structure
  const tmpDir = path.join(outputDir, '_war_tmp');
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(tmpDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  // Create ZIP using system command
  execSync(`cd "${tmpDir}" && zip -r "${warPath}" .`, { stdio: 'pipe' });

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true });

  console.log(`WAR created: ${warPath}`);
} catch (err) {
  console.error('Failed to create WAR:', err.message);
  process.exit(1);
}
