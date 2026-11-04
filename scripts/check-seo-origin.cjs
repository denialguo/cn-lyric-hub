const fs = require('node:fs');
const path = require('node:path');

function checkSeoOrigin(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) checkSeoOrigin(file);
    else if (/\.(html|xml|txt|js|json)$/.test(entry.name) &&
      fs.readFileSync(file, 'utf8').includes('cnlyrichub.vercel.app')) {
      throw new Error(`Old production host in ${file}`);
    }
  }
}

module.exports = { checkSeoOrigin };

if (require.main === module) {
  checkSeoOrigin('dist');
  console.log('SEO origin check passed: no old production host in dist.');
}
