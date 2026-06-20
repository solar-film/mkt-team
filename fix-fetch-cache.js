const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');
let changedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Find fetch('/api/...') or fetch(`/api/...`) without a second argument
  // And change it to fetch('/api/...', { cache: 'no-store' })
  content = content.replace(/fetch\((['"`]\/api\/[^'"`]+['"`])\)/g, "fetch($1, { cache: 'no-store' })");
  
  // also handle the cases like: fetch('/api/tasks' + (filterMemberId ? `...` : ''))
  content = content.replace(/fetch\((['"`]\/api\/[^,]+)\)/g, "fetch($1, { cache: 'no-store' })");

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
    changedCount++;
  }
});

console.log(`Updated ${changedCount} files.`);
