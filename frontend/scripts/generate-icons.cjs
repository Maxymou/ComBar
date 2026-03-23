// Generate simple branded PNG icons for PWA
// These are placeholder PNGs with the brand colors
// Replace with actual logo PNGs for production

const fs = require('fs');
const path = require('path');

function createPNG(size) {
  // Create a minimal valid PNG with brand colors (black bg, yellow text area)
  // PNG structure: signature + IHDR + IDAT + IEND

  const width = size;
  const height = size;

  // Create raw pixel data (RGBA)
  const pixels = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const cx = x - width / 2;
      const cy = y - height / 2;
      const dist = Math.sqrt(cx * cx + cy * cy);
      const maxDist = width * 0.45;

      if (dist < maxDist) {
        // Inner circle with brand gradient
        const ratio = dist / maxDist;
        if (ratio < 0.7) {
          // Yellow center area
          pixels[idx] = 255;     // R
          pixels[idx + 1] = 224; // G
          pixels[idx + 2] = 0;   // B
          pixels[idx + 3] = 255; // A
        } else {
          // Red border
          pixels[idx] = 255;
          pixels[idx + 1] = 32;
          pixels[idx + 2] = 32;
          pixels[idx + 3] = 255;
        }
      } else {
        // Black background
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 255;
      }
    }
  }

  // Add text-like pattern "BB" in center
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const letterSize = Math.floor(width * 0.15);

  for (let dy = -letterSize; dy <= letterSize; dy++) {
    for (let dx = -letterSize * 2; dx <= letterSize * 2; dx++) {
      const px = centerX + dx;
      const py = centerY + dy;
      if (px >= 0 && px < width && py >= 0 && py < height) {
        // Simple "B" shape approximation
        const inLeftB = (dx >= -letterSize * 2 && dx <= -letterSize * 0.5) &&
                        (Math.abs(dy) <= letterSize || Math.abs(dx + letterSize * 1.25) < letterSize * 0.4);
        const inRightB = (dx >= letterSize * 0.5 && dx <= letterSize * 2) &&
                         (Math.abs(dy) <= letterSize || Math.abs(dx - letterSize * 1.25) < letterSize * 0.4);

        if (inLeftB || inRightB) {
          const idx = (py * width + px) * 4;
          pixels[idx] = 0;
          pixels[idx + 1] = 0;
          pixels[idx + 2] = 0;
          pixels[idx + 3] = 255;
        }
      }
    }
  }

  // Use zlib to create proper PNG
  const zlib = require('zlib');

  // Filter: add filter byte (0 = None) before each row
  const filtered = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    filtered[y * (width * 4 + 1)] = 0; // filter type: None
    pixels.copy(filtered, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(filtered);

  // Build PNG file
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const crc = require('zlib').crc32(typeAndData);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc >>> 0);
    return Buffer.concat([len, typeAndData, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type: RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const png = Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);

  return png;
}

const publicDir = path.join(__dirname, '..', 'public');

// Generate icons
const sizes = [192, 512];
for (const size of sizes) {
  const png = createPNG(size);
  fs.writeFileSync(path.join(publicDir, `logo-${size}.png`), png);
  console.log(`Generated logo-${size}.png (${png.length} bytes)`);
}

// Generate favicon (16x16)
const favicon = createPNG(16);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), favicon);
console.log(`Generated favicon.ico (${favicon.length} bytes)`);

console.log('Done!');
