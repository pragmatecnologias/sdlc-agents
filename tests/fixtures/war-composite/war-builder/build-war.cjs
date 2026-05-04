const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const zip = new AdmZip();

// Add required WAR entries
zip.addFile('WEB-INF/web.xml', Buffer.from('<?xml version="1.0" encoding="UTF-8"?><web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee"/>'));
zip.addFile('WEB-INF/classes/.gitkeep', Buffer.from(''));
zip.addFile('WEB-INF/lib/.gitkeep', Buffer.from(''));

// Add frontend/static content
zip.addFile('index.html', Buffer.from('<!DOCTYPE html><html><body>Enterprise WAR App</body></html>'));
zip.addFile('main.js', Buffer.from('console.log("WAR app loaded");'));
zip.addFile('styles.css', Buffer.from('body { font-family: sans-serif; }'));

const warPath = path.join(outputDir, 'app.war');
zip.writeZip(warPath);
console.log(`WAR created: ${warPath}`);
