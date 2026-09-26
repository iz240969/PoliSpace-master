const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const assets = [
  ['resources/css', 'public/resources/css'],
  ['resources/js', 'public/resources/js'],
  ['resources/images', 'public/resources/images'],
  ['resources/favicon.svg', 'public/resources/favicon.svg'],
];

for (const [source, destination] of assets) {
  const sourcePath = path.join(root, source);
  const destinationPath = path.join(root, destination);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Required asset source is missing: ${source}`);
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.cpSync(sourcePath, destinationPath, { recursive: true, force: true });
}

process.stdout.write('PoliSpace browser assets copied to public/resources.\n');
