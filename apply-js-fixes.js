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
    } else if (stat.isFile() && fullPath.endsWith('.js') && (dir.endsWith('\\js') || dir.endsWith('\\admin\\js'))) {
      let content = fs.readFileSync(fullPath, 'utf8');

      content = content.replace(/from '\.\/main\.js(\?v=[\d.]+)?'/g, "from './main.js?v=5.0.0'");
      content = content.replace(/from '\.\.\/js\/main\.js(\?v=[\d.]+)?'/g, "from '../js/main.js?v=5.0.0'");
      content = content.replace(/from '\.\.\/\.\.\/js\/main\.js(\?v=[\d.]+)?'/g, "from '../../js/main.js?v=5.0.0'");
      
      content = content.replace(/from '\.\/chat-widget\.js(\?v=[\d.]+)?'/g, "from './chat-widget.js?v=5.0.0'");
      content = content.replace(/from '\.\.\/js\/chat-widget\.js(\?v=[\d.]+)?'/g, "from '../js/chat-widget.js?v=5.0.0'");

      fs.writeFileSync(fullPath, content, 'utf8');
      console.log('Updated: ' + fullPath);
    }
  }
}

processDir(rootDir);
console.log('Done fixing JS files with v5.0.0');
