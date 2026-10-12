import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { encodeQr } from '../qr';
const hasDecoder = spawnSync('zbarimg', ['--version'], { encoding: 'utf8' }).status === 0;
it.skipIf(!hasDecoder)('independent zbar decoder reads short/legacy/UTF8/multi-block symbols at three sizes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'draw-qr-decode-'));
  const inputs = ['https://game.1989v.com/?r=ABC234', 'https://game.1989v.com/party/ABC234', '친구 초대 테스트', 'x'.repeat(120)];
  for (let i = 0; i < inputs.length; i++) for (const size of [132, 200, 231]) {
    const grid = encodeQr(inputs[i]), quiet = 4, span = grid.length + quiet * 2;
    const pixels = Buffer.alloc(size * size, 255);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const row = Math.floor(y * span / size) - quiet, col = Math.floor(x * span / size) - quiet;
      if (row >= 0 && col >= 0 && row < grid.length && col < grid.length && grid[row][col]) pixels[y * size + x] = 0;
    }
    const path = join(directory, `${i}-${size}.pgm`);
    writeFileSync(path, Buffer.concat([Buffer.from(`P5\n${size} ${size}\n255\n`), pixels]));
    const decoded = spawnSync('zbarimg', ['--quiet', '--raw', path], { encoding: 'utf8' });
    expect(decoded.status, `${inputs[i]}/${size}: ${decoded.stderr}`).toBe(0);
    expect(decoded.stdout.trim()).toBe(inputs[i]);
  }
});
