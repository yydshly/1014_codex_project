// Rasterize the editable diagram; the three evidence images remain unretouched.
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const sharp = require(process.argv[2] || 'sharp');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'web/assets/atlas-overview.svg');
const target = path.join(root, 'web/assets/atlas-overview.png');
sharp(source, { density: 96, limitInputPixels: 100000000 })
  .png({ compressionLevel: 9 })
  .toFile(target)
  .then(info => {
    const manifestPath = path.join(root, 'web/assets/atlas-overview-provenance.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.png_size = [info.width, info.height];
    manifest.png_sha256 = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
    manifest.renderer = { name: 'Sharp / librsvg', sharp: sharp.versions.sharp, rsvg: sharp.versions.rsvg, density: 96 };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(JSON.stringify({ target, ...info }));
  })
  .catch(error => { console.error(error); process.exitCode = 1; });
