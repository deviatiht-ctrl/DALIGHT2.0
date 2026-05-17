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

      // Bump versions to v=5.0.0
      content = content.replace(/style\.css\?v=[\d.]+/g, 'style.css?v=5.0.0');
      content = content.replace(/responsive\.css\?v=[\d.]+/g, 'responsive.css?v=5.0.0');
      content = content.replace(/main\.js(\?v=[\d.]+)?/g, 'main.js?v=5.0.0');
      content = content.replace(/chat-widget\.js(\?v=[\d.]+)?/g, 'chat-widget.js?v=5.0.0');
      content = content.replace(/shop\.js(\?v=[\d.]+)?/g, 'shop.js?v=5.0.0');

      // Fix nav-toggle (3 lines instead of 2 for the hamburger)
      content = content.replace(/<button class="nav-toggle"([^>]*)>\s*<span><\/span>\s*<span><\/span>\s*<\/button>/g, '<button class="nav-toggle"$1>\n        <span></span>\n        <span></span><span></span>\n      </button>');

      // Add mobile auth link if missing
      const loginPath = fullPath.includes('\\pages\\') ? './login.html' : './pages/login.html';
      const authLink = `<a href="${loginPath}" class="mobile-auth-link" style="color:var(--gold-500);"><i data-lucide="user" style="width:16px;height:16px;display:inline-block;margin-right:4px;vertical-align:-3px;"></i> Connexion</a>`;
      
      if (!content.includes('class="mobile-auth-link"')) {
        content = content.replace(/<a href="[^"]*dashboard\.html"[^>]*>Admin<\/a>/, `${authLink}\n        $&`);
      }

      fs.writeFileSync(fullPath, content, 'utf8');
      console.log('Updated: ' + fullPath);
    }
  }
}

processDir(rootDir);
console.log('Done fixing HTML files with v5.0.0');
