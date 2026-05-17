const fs = require('fs');
const path = require('path');

const rootDir = 'c:\\Users\\HACKER\\Documents\\DALIGHT';

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && !fullPath.includes('.git') && !fullPath.includes('node_modules') && !fullPath.includes('.windsurf')) {
      processDir(fullPath);
    } else if (stat.isFile() && fullPath.endsWith('.html')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Bump versions
      content = content.replace(/style\.css\?v=[\d.]+/g, 'style.css?v=3.0.0');
      content = content.replace(/responsive\.css\?v=[\d.]+/g, 'responsive.css?v=3.0.0');
      content = content.replace(/main\.js\?v=[\d.]+/g, 'main.js?v=3.0.0');
      content = content.replace(/src="\.\.\/js\/main\.js"/g, 'src="../js/main.js?v=3.0.0"');
      content = content.replace(/src="\.\/js\/main\.js"/g, 'src="./js/main.js?v=3.0.0"');
      
      // Fix nav-toggle (some have different spaces, so we use a robust regex)
      content = content.replace(/<button class="nav-toggle"([^>]*)>\s*<span><\/span>\s*<span><\/span>\s*<\/button>/g, '<button class="nav-toggle"$1>\n        <span></span>\n        <span></span><span></span>\n      </button>');
      
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
}

processDir(rootDir);
console.log('Fixed HTML files.');
