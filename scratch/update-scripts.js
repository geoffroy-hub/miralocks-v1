const fs = require('fs');
const path = require('path');

const dir = './';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('chatbot-public.js') && !content.includes('ai-core.js')) {
    console.log(`Updating ${file}...`);
    content = content.replace(
      /<script src="js\/chatbot-public\.js.*?><\/script>/,
      `<script src="js/ai-core.js?v=d0d719cf"></script>\n  <script src="js/chatbot-public.js?v=af098af9"></script>`
    );
    fs.writeFileSync(filePath, content);
  }
});
