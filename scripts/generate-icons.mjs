import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

function crc32(buffer) {
  let crc = ~0;
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function createPng(size, paint) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const [red, green, blue, alpha] = paint(x, y, size);
      const offset = row + 1 + x * 4;
      raw[offset] = red;
      raw[offset + 1] = green;
      raw[offset + 2] = blue;
      raw[offset + 3] = alpha;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function paint(x, y, size) {
  const navy = [15, 23, 42, 255];
  const white = [255, 255, 255, 255];
  const orange = [234, 88, 12, 255];
  const nx = x / size;
  const ny = y / size;
  if (ny < 0.32 || ny > 0.68) return navy;
  const bars = [
    [0.3, 0.36, white],
    [0.38, 0.41, white],
    [0.43, 0.52, orange],
    [0.54, 0.57, white],
    [0.6, 0.68, white],
  ];
  for (const [start, end, color] of bars) {
    if (nx >= start && nx <= end) return color;
  }
  return navy;
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', createPng(192, paint));
writeFileSync('public/icons/icon-512.png', createPng(512, paint));
