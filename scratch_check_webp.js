const fs = require('fs');

function getWebPDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  // Check RIFF and WEBP
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }
  const chunkHeader = buf.toString('ascii', 12, 16);
  if (chunkHeader === 'VP8X') {
    const width = 1 + buf.readUIntLE(24, 3);
    const height = 1 + buf.readUIntLE(27, 3);
    return { width, height, ratio: width / height, chunk: 'VP8X' };
  } else if (chunkHeader === 'VP8 ') {
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return { width, height, ratio: width / height, chunk: 'VP8 ' };
  } else if (chunkHeader === 'VP8L') {
    const b1 = buf[21];
    const b2 = buf[22];
    const b3 = buf[23];
    const b4 = buf[24];
    const width = 1 + (b1 | ((b2 & 0x3f) << 8));
    const height = 1 + (((b2 & 0xc0) >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10));
    return { width, height, ratio: width / height, chunk: 'VP8L' };
  }
  return null;
}

for (let i = 1; i <= 4; i++) {
  console.log(`Desktop ${i}:`, getWebPDimensions(`public/assets/carousel/desktop/${i}.webp`));
  console.log(`Mobile ${i}:`, getWebPDimensions(`public/assets/carousel/mobile/${i}.webp`));
}
