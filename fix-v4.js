const fs = require('fs');
const path = require('path');

const rootDir = 'c:\\Users\\HACKER\\Documents\\DALIGHT';

function fixEncoding(str) {
  // If we see UTF-8 mojibake, decode it
  if (str.includes('é') || str.includes('ï') || str.includes('ê') || str.includes('—\xa0') || str.includes('è')) {
    // Convert string to bytes using latin1, then decode as utf8
    let fixed = Buffer.from(str, 'binary').toString('utf8');
    // Replace the replacement character with em dash if it was an em dash
    fixed = fixed.replace(/\uFFFD/g, '');
    return fixed;
  }
  return str;
}

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && !fullPath.includes('.git') && !fullPath.includes('node_modules') && !fullPath.includes('.windsurf')) {
      processDir(fullPath);
    } else if (stat.isFile()) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;

      if (fullPath.endsWith('.html') || fullPath.endsWith('.css') || fullPath.endsWith('.js')) {
        content = fixEncoding(content);
      }

      if (fullPath.endsWith('.html')) {
        // Bump versions
        content = content.replace(/style\.css\?v=[\d.]+/g, 'style.css?v=4.0.0');
        content = content.replace(/responsive\.css\?v=[\d.]+/g, 'responsive.css?v=4.0.0');
        content = content.replace(/main\.js\?v=[\d.]+/g, 'main.js?v=4.0.0');
        content = content.replace(/src="\.\.\/js\/main\.js"/g, 'src="../js/main.js?v=4.0.0"');
        content = content.replace(/src="\.\/js\/main\.js"/g, 'src="./js/main.js?v=4.0.0"');
        
        content = content.replace(/import\s+\{\s*getSupabase\s*\}\s+from\s+['"]\.\.\/js\/main\.js(\?v=[\d.]+)?['"]/g, "import { getSupabase } from '../js/main.js?v=4.0.0'");
        content = content.replace(/import\s+\{\s*initChatWidget\s*\}\s+from\s+['"]\.\.\/js\/chat-widget\.js(\?v=[\d.]+)?['"]/g, "import { initChatWidget } from '../js/chat-widget.js?v=4.0.0'");
        content = content.replace(/import\s+\{\s*getSupabase\s*\}\s+from\s+['"]\.\/js\/main\.js(\?v=[\d.]+)?['"]/g, "import { getSupabase } from './js/main.js?v=4.0.0'");
        content = content.replace(/import\s+\{\s*initChatWidget\s*\}\s+from\s+['"]\.\/js\/chat-widget\.js(\?v=[\d.]+)?['"]/g, "import { initChatWidget } from './js/chat-widget.js?v=4.0.0'");

        // Fix nav-toggle
        content = content.replace(/<button class="nav-toggle"([^>]*)>\s*<span><\/span>\s*<span><\/span>\s*<\/button>/g, '<button class="nav-toggle"$1>\n        <span></span>\n        <span></span><span></span>\n      </button>');

        // Inject default mobile auth link if missing
        const loginPath = fullPath.includes('\\pages\\') ? './login.html' : './pages/login.html';
        const defaultAuthLink = `<a href="${loginPath}" class="mobile-auth-link" style="color:var(--gold-500);"><i data-lucide="user" style="width:16px;height:16px;display:inline-block;margin-right:4px;vertical-align:-3px;"></i> Connexion</a>`;
        
        if (!content.includes('class="mobile-auth-link"')) {
          content = content.replace(/<a href="[^"]*dashboard\.html"[^>]*>Admin<\/a>/, `${defaultAuthLink}\n          $&`);
        }
      } else if (fullPath.endsWith('.js') && (dir.endsWith('\\js') || dir.endsWith('\\admin\\js'))) {
        content = content.replace(/from '\.\/main\.js(\?v=[\d.]+)?'/g, "from './main.js?v=4.0.0'");
        content = content.replace(/from '\.\.\/js\/main\.js(\?v=[\d.]+)?'/g, "from '../js/main.js?v=4.0.0'");
        content = content.replace(/from '\.\.\/\.\.\/js\/main\.js(\?v=[\d.]+)?'/g, "from '../../js/main.js?v=4.0.0'");
      }

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated: ' + fullPath);
      }
    }
  }
}

processDir(rootDir);
console.log('Done!');
