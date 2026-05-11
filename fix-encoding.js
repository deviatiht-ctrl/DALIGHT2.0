const fs = require('fs');
const path = require('path');

const rootDir = 'c:\\Users\\HACKER\\Documents\\DALIGHT';

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && !fullPath.includes('.git') && !fullPath.includes('node_modules')) {
      processDir(fullPath);
    } else if (stat.isFile()) {
      if (fullPath.endsWith('.html')) {
        let content = fs.readFileSync(fullPath, 'utf8');
        content = content.replace(/style\.css\?v=[\d.]+/g, 'style.css?v=3.0.0');
        content = content.replace(/responsive\.css\?v=[\d.]+/g, 'responsive.css?v=3.0.0');
        content = content.replace(/main\.js\?v=[\d.]+/g, 'main.js?v=3.0.0');
        content = content.replace(/src="\.\.\/js\/main\.js"/g, 'src="../js/main.js?v=3.0.0"');
        content = content.replace(/src="\.\/js\/main\.js"/g, 'src="./js/main.js?v=3.0.0"');
        fs.writeFileSync(fullPath, content, 'utf8');
      } else if (fullPath.endsWith('.js') && (dir.endsWith('\\js') || dir.endsWith('\\admin\\js'))) {
        let content = fs.readFileSync(fullPath, 'utf8');
        content = content.replace(/from '\.\/main\.js'/g, "from './main.js?v=3.0.0'");
        content = content.replace(/from '\.\.\/js\/main\.js'/g, "from '../js/main.js?v=3.0.0'");
        content = content.replace(/from '\.\.\/\.\.\/js\/main\.js'/g, "from '../../js/main.js?v=3.0.0'");
        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  }
}

processDir(rootDir);
console.log('Done replacing strings with UTF-8 intact!');
