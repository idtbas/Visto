// Turns the single-file build into a page fragment for publishing as a hosted artifact:
// title and styles first, then the page content, then the script.
const fs = require('fs');
const html = fs.readFileSync('dist/index.html', 'utf8');
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const body = /<body[^>]*>([\s\S]*?)<\/body>/.exec(html)[1].replace(/<script[\s\S]*?<\/script>/g, '');
const out = `<title>Visto</title>\n<style>\n${styles}\n</style>\n${body.trim()}\n${scripts.map((s) => `<script type="module">${s}</script>`).join('\n')}\n`;
const target = process.argv[2];
fs.writeFileSync(target, out);
console.log('written', target, (out.length / 1024).toFixed(0), 'kB');
