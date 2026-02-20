import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

type Frame = { x: number; y: number; w: number; h: number };

class PixelCanvas {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;

  constructor(width: number, height: number, fill = 0x00000000) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
    this.fill(fill);
  }

  fill(hex: number): void {
    const [r, g, b, a] = rgba(hex);
    for (let index = 0; index < this.data.length; index += 4) {
      this.data[index] = r;
      this.data[index + 1] = g;
      this.data[index + 2] = b;
      this.data[index + 3] = a;
    }
  }

  set(x: number, y: number, hex: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return;
    }
    const [r, g, b, a] = rgba(hex);
    const offset = (y * this.width + x) * 4;
    this.data[offset] = r;
    this.data[offset + 1] = g;
    this.data[offset + 2] = b;
    this.data[offset + 3] = a;
  }

  rect(x: number, y: number, width: number, height: number, hex: number): void {
    for (let py = y; py < y + height; py += 1) {
      for (let px = x; px < x + width; px += 1) {
        this.set(px, py, hex);
      }
    }
  }

  frame(x: number, y: number, width: number, height: number, hex: number): void {
    this.rect(x, y, width, 1, hex);
    this.rect(x, y + height - 1, width, 1, hex);
    this.rect(x, y, 1, height, hex);
    this.rect(x + width - 1, y, 1, height, hex);
  }

  line(x0: number, y0: number, x1: number, y1: number, hex: number): void {
    let x = x0;
    let y = y0;
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;

    while (true) {
      this.set(x, y, hex);
      if (x === x1 && y === y1) {
        break;
      }
      const e2 = error * 2;
      if (e2 >= dy) {
        error += dy;
        x += sx;
      }
      if (e2 <= dx) {
        error += dx;
        y += sy;
      }
    }
  }

  blit(source: PixelCanvas, dx: number, dy: number): void {
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const sourceOffset = (y * source.width + x) * 4;
        const alpha = source.data[sourceOffset + 3]!;
        if (alpha === 0) {
          continue;
        }
        const targetX = dx + x;
        const targetY = dy + y;
        if (targetX < 0 || targetY < 0 || targetX >= this.width || targetY >= this.height) {
          continue;
        }
        const targetOffset = (targetY * this.width + targetX) * 4;
        this.data[targetOffset] = source.data[sourceOffset]!;
        this.data[targetOffset + 1] = source.data[sourceOffset + 1]!;
        this.data[targetOffset + 2] = source.data[sourceOffset + 2]!;
        this.data[targetOffset + 3] = alpha;
      }
    }
  }
}

const rgba = (hex: number): [number, number, number, number] => {
  const value = hex >>> 0;
  if (value <= 0xffffff) {
    return [(value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff, 0xff];
  }
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
};

const mix = (a: number, b: number, t: number): number => Math.round(a + (b - a) * t);

const mixColor = (a: number, b: number, t: number): number => {
  const [ar, ag, ab] = rgba(a);
  const [br, bg, bb] = rgba(b);
  return (((mix(ar, br, t) << 24) | (mix(ag, bg, t) << 16) | (mix(ab, bb, t) << 8) | 0xff) >>> 0);
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (buffer: Buffer): number => {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = crcTable[(crc ^ buffer[index]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type: string, data: Buffer): Buffer => {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
};

const encodePng = (canvas: PixelCanvas): Buffer => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(canvas.width, 0);
  ihdr.writeUInt32BE(canvas.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = canvas.width * 4;
  const raw = Buffer.alloc((stride + 1) * canvas.height);
  const pixels = Buffer.from(canvas.data);
  for (let y = 0; y < canvas.height; y += 1) {
    const rowOffset = y * (stride + 1);
    raw[rowOffset] = 0;
    pixels.copy(raw, rowOffset + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
};

const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const drawPlayerFrame = (
  suit: number,
  trim: number,
  eye: number,
  state: "idle" | "run_a" | "run_b" | "jump" | "fall",
  ghost = false
): PixelCanvas => {
  const body = ghost ? (suit & 0xffffff00) | 0x9f : suit;
  const border = ghost ? 0x20314f9f : 0x1a2439ff;
  const c = new PixelCanvas(16, 24, 0x00000000);

  c.rect(5, 3, 6, 4, trim);
  c.frame(5, 3, 6, 4, border);
  c.rect(4, 7, 8, 10, body);
  c.frame(4, 7, 8, 10, border);
  c.rect(6, 9, 4, 3, mixColor(body, 0xffffffff, 0.22));

  if (state === "idle") {
    c.rect(4, 17, 3, 5, body);
    c.rect(9, 17, 3, 5, body);
    c.rect(3, 9, 1, 4, trim);
    c.rect(12, 9, 1, 4, trim);
  } else if (state === "run_a") {
    c.rect(3, 17, 3, 5, body);
    c.rect(9, 18, 3, 4, body);
    c.rect(2, 10, 1, 4, trim);
    c.rect(13, 8, 1, 4, trim);
  } else if (state === "run_b") {
    c.rect(4, 18, 3, 4, body);
    c.rect(10, 17, 3, 5, body);
    c.rect(2, 8, 1, 4, trim);
    c.rect(13, 10, 1, 4, trim);
  } else if (state === "jump") {
    c.rect(5, 17, 3, 4, body);
    c.rect(8, 17, 3, 4, body);
    c.rect(3, 10, 1, 3, trim);
    c.rect(12, 10, 1, 3, trim);
  } else {
    c.rect(4, 17, 3, 5, body);
    c.rect(9, 17, 3, 5, body);
    c.rect(3, 11, 1, 4, trim);
    c.rect(12, 11, 1, 4, trim);
  }

  c.frame(4, 17, 3, 5, border);
  c.frame(9, 17, 3, 5, border);
  c.set(9, 5, eye);
  c.set(10, 5, eye);
  c.set(10, 6, 0x10203aff);
  return c;
};

const createPlayersAtlas = (outDir: string): { file: string; metadataFile: string } => {
  const states = ["idle", "run_a", "run_b", "jump", "fall"] as const;
  const rows = [
    { id: "p1", suit: 0x6ef0ffff, trim: 0xfff2ccff, eye: 0x12336cff, ghost: false },
    { id: "p2", suit: 0xffbb88ff, trim: 0xfff4d6ff, eye: 0x2f1a10ff, ghost: false },
    { id: "p3", suit: 0x96ffa4ff, trim: 0xf7ffddff, eye: 0x1e3b18ff, ghost: false },
    { id: "p4", suit: 0xd9b8ffff, trim: 0xfff2ffff, eye: 0x2b2042ff, ghost: false },
    { id: "ghost", suit: 0xa7d9ffff, trim: 0xd8ecffff, eye: 0x10203aff, ghost: true }
  ] as const;

  const frameWidth = 16;
  const frameHeight = 24;
  const atlas = new PixelCanvas(frameWidth * states.length, frameHeight * rows.length, 0x00000000);
  const frames: Record<string, Frame> = {};

  for (let row = 0; row < rows.length; row += 1) {
    const actor = rows[row];
    if (actor === undefined) {
      continue;
    }
    for (let col = 0; col < states.length; col += 1) {
      const state = states[col];
      if (state === undefined) {
        continue;
      }
      const frame = drawPlayerFrame(actor.suit, actor.trim, actor.eye, state, actor.ghost);
      const x = col * frameWidth;
      const y = row * frameHeight;
      atlas.blit(frame, x, y);
      frames[`${actor.id}_${state}`] = { x, y, w: frameWidth, h: frameHeight };
    }
  }

  const file = "players-atlas.png";
  const metadataFile = "players-atlas.json";
  writeFileSync(join(outDir, file), encodePng(atlas));
  writeFileSync(join(outDir, metadataFile), JSON.stringify({ frameWidth, frameHeight, frames }, null, 2));
  return { file, metadataFile };
};

const drawTile = (kind: string): PixelCanvas => {
  const t = new PixelCanvas(16, 16, 0x00000000);
  if (kind === "solid_neon") {
    t.rect(0, 0, 16, 16, 0x4b3a74ff);
    t.rect(0, 0, 16, 2, 0x79d58dff);
  } else if (kind === "solid_sewer") {
    t.rect(0, 0, 16, 16, 0x335f5fff);
    t.rect(0, 0, 16, 2, 0x8ac18aff);
  } else if (kind === "solid_foundry") {
    t.rect(0, 0, 16, 16, 0x7a3948ff);
    t.rect(0, 0, 16, 2, 0xff9b6bff);
  } else if (kind === "crate") {
    t.rect(0, 0, 16, 16, 0x6d5438ff);
    t.frame(0, 0, 16, 16, 0x2b1d13ff);
    t.line(1, 1, 14, 14, 0x8a704dff);
    t.line(14, 1, 1, 14, 0x8a704dff);
  } else if (kind === "pipe") {
    t.rect(0, 0, 16, 16, 0x11253dff);
    t.rect(2, 1, 12, 14, 0x5686baff);
    t.frame(2, 1, 12, 14, 0x1e3b5eff);
  } else if (kind === "hazard_lava") {
    t.rect(0, 0, 16, 16, 0x502026ff);
    t.rect(0, 9, 16, 7, 0xef5a3dff);
    t.rect(0, 8, 16, 1, 0xffbc5bff);
  } else if (kind === "hazard_slime") {
    t.rect(0, 0, 16, 16, 0x213721ff);
    t.rect(0, 9, 16, 7, 0x57d06aff);
    t.rect(0, 8, 16, 1, 0xc4ffc8ff);
  } else if (kind === "conveyor_left") {
    t.rect(0, 0, 16, 16, 0x2d3a4eff);
    t.rect(0, 0, 16, 2, 0x8ea9d3ff);
    for (let x = 2; x < 14; x += 4) {
      t.line(x + 2, 10, x, 8, 0xdde8ffff);
      t.line(x + 2, 11, x, 9, 0x9bb6d9ff);
    }
  } else if (kind === "conveyor_right") {
    t.rect(0, 0, 16, 16, 0x2d3a4eff);
    t.rect(0, 0, 16, 2, 0x8ea9d3ff);
    for (let x = 2; x < 14; x += 4) {
      t.line(x, 10, x + 2, 8, 0xdde8ffff);
      t.line(x, 11, x + 2, 9, 0x9bb6d9ff);
    }
  } else if (kind === "platform_thin") {
    t.rect(0, 0, 16, 16, 0x00000000);
    t.rect(0, 6, 16, 4, 0x4f6a8eff);
    t.rect(0, 6, 16, 1, 0xd3e5ffff);
  } else if (kind === "window") {
    t.rect(0, 0, 16, 16, 0x1b2f52ff);
    t.frame(0, 0, 16, 16, 0x0a1424ff);
    t.rect(3, 3, 10, 10, 0x87d5ffff);
    t.line(8, 3, 8, 12, 0x3e6f9dff);
    t.line(3, 8, 12, 8, 0x3e6f9dff);
  } else if (kind === "arrow_up") {
    t.rect(0, 0, 16, 16, 0x233750ff);
    t.line(8, 3, 8, 12, 0xddeaffff);
    t.line(8, 3, 5, 6, 0xddeaffff);
    t.line(8, 3, 11, 6, 0xddeaffff);
  } else {
    t.rect(0, 0, 16, 16, 0x29324dff);
    for (let y = 2; y < 14; y += 4) {
      for (let x = 2; x < 14; x += 4) {
        t.rect(x, y, 1, 1, 0x6f83a9ff);
      }
    }
  }
  t.frame(0, 0, 16, 16, 0x10182aff);
  return t;
};

const createTilesAtlas = (outDir: string): { file: string; metadataFile: string } => {
  const names = [
    "solid_neon",
    "solid_sewer",
    "solid_foundry",
    "crate",
    "pipe",
    "hazard_lava",
    "hazard_slime",
    "conveyor_left",
    "conveyor_right",
    "platform_thin",
    "window",
    "arrow_up",
    "accent_0",
    "accent_1",
    "accent_2",
    "accent_3"
  ] as const;

  const columns = 8;
  const tileSize = 16;
  const rows = Math.ceil(names.length / columns);
  const atlas = new PixelCanvas(columns * tileSize, rows * tileSize, 0x00000000);
  const frames: Record<string, Frame> = {};

  for (let index = 0; index < names.length; index += 1) {
    const name = names[index];
    if (name === undefined) {
      continue;
    }
    const x = (index % columns) * tileSize;
    const y = Math.floor(index / columns) * tileSize;
    atlas.blit(drawTile(name), x, y);
    frames[name] = { x, y, w: tileSize, h: tileSize };
  }

  const file = "tiles-atlas.png";
  const metadataFile = "tiles-atlas.json";
  writeFileSync(join(outDir, file), encodePng(atlas));
  writeFileSync(join(outDir, metadataFile), JSON.stringify({ tileSize, frames }, null, 2));
  return { file, metadataFile };
};

const drawIcon = (name: string): PixelCanvas => {
  const c = new PixelCanvas(16, 16, 0x00000000);
  c.rect(2, 2, 12, 12, 0x13223bff);
  c.frame(2, 2, 12, 12, 0x3f608cff);

  switch (name) {
    case "HyperDash":
      c.line(4, 10, 11, 5, 0xff6e6eff);
      c.line(4, 11, 11, 6, 0xffb4b4ff);
      break;
    case "BlinkStep":
      c.rect(4, 4, 8, 8, 0x83d9ffff);
      c.frame(4, 4, 8, 8, 0xe8fcffff);
      break;
    case "IceMine":
      c.rect(7, 4, 2, 8, 0xc3f4ffff);
      c.rect(4, 7, 8, 2, 0xc3f4ffff);
      c.line(5, 5, 10, 10, 0xe8fdffff);
      c.line(10, 5, 5, 10, 0xe8fdffff);
      break;
    case "TagShield":
      c.rect(5, 4, 6, 8, 0xa4ff9dff);
      c.line(5, 4, 8, 2, 0xeaffe8ff);
      c.line(10, 4, 8, 2, 0xeaffe8ff);
      break;
    case "PhaseCloak":
      c.rect(4, 4, 8, 8, 0xcfb2ffff);
      c.rect(6, 6, 4, 4, 0x2d1b4bff);
      break;
    case "ScoreSurge":
      c.rect(4, 4, 8, 8, 0xffe190ff);
      c.line(5, 8, 11, 8, 0x613c09ff);
      c.line(8, 5, 8, 11, 0x613c09ff);
      break;
    case "LowGrav":
      c.rect(4, 4, 8, 8, 0xb4d9ffff);
      c.line(4, 10, 11, 5, 0xf4fbffff);
      break;
    case "SwapZap":
      c.line(4, 6, 11, 6, 0xffaff0ff);
      c.line(4, 9, 11, 9, 0xffaff0ff);
      c.line(10, 5, 12, 6, 0xffaff0ff);
      c.line(10, 8, 12, 9, 0xffaff0ff);
      c.line(6, 5, 4, 6, 0xffaff0ff);
      c.line(6, 8, 4, 9, 0xffaff0ff);
      break;
    case "TimeCrush":
      c.rect(5, 4, 6, 8, 0xffa47dff);
      c.line(8, 5, 8, 8, 0x582312ff);
      c.line(8, 8, 10, 10, 0x582312ff);
      break;
    case "DecoyClone":
      c.rect(4, 5, 5, 6, 0x9de4c7ff);
      c.rect(8, 4, 4, 7, 0x78ccb0ff);
      break;
    case "RocketHop":
      c.rect(6, 3, 4, 9, 0xffba93ff);
      c.rect(7, 12, 2, 2, 0xffeb8fff);
      break;
    case "EMPBurst":
      c.rect(4, 4, 8, 8, 0xbee8ffff);
      c.line(5, 5, 10, 10, 0x2a5f8eff);
      c.line(10, 5, 5, 10, 0x2a5f8eff);
      break;
    default:
      break;
  }

  return c;
};

const createPowerupAtlas = (outDir: string): { file: string; metadataFile: string } => {
  const names = [
    "HyperDash",
    "BlinkStep",
    "IceMine",
    "TagShield",
    "PhaseCloak",
    "ScoreSurge",
    "LowGrav",
    "SwapZap",
    "TimeCrush",
    "DecoyClone",
    "RocketHop",
    "EMPBurst"
  ] as const;

  const columns = 6;
  const iconSize = 16;
  const rows = Math.ceil(names.length / columns);
  const atlas = new PixelCanvas(columns * iconSize, rows * iconSize, 0x00000000);
  const frames: Record<string, Frame> = {};

  for (let index = 0; index < names.length; index += 1) {
    const name = names[index];
    if (name === undefined) {
      continue;
    }
    const x = (index % columns) * iconSize;
    const y = Math.floor(index / columns) * iconSize;
    atlas.blit(drawIcon(name), x, y);
    frames[name] = { x, y, w: iconSize, h: iconSize };
  }

  const file = "powerups-atlas.png";
  const metadataFile = "powerups-atlas.json";
  writeFileSync(join(outDir, file), encodePng(atlas));
  writeFileSync(join(outDir, metadataFile), JSON.stringify({ iconSize, frames }, null, 2));
  return { file, metadataFile };
};

const createFxAtlas = (outDir: string): { file: string; metadataFile: string } => {
  const frameSize = 16;
  const frameNames = [
    "dust_0",
    "dust_1",
    "dust_2",
    "dust_3",
    "tag_0",
    "tag_1",
    "tag_2",
    "tag_3",
    "tag_4",
    "tag_5",
    "jump_0",
    "jump_1",
    "jump_2",
    "jump_3",
    "trail_0",
    "trail_1"
  ] as const;
  const columns = 8;
  const rows = Math.ceil(frameNames.length / columns);
  const atlas = new PixelCanvas(columns * frameSize, rows * frameSize, 0x00000000);
  const frames: Record<string, Frame> = {};

  for (let index = 0; index < frameNames.length; index += 1) {
    const name = frameNames[index];
    if (name === undefined) {
      continue;
    }
    const frame = new PixelCanvas(frameSize, frameSize, 0x00000000);
    const stage = index % 6;
    if (name.startsWith("dust")) {
      frame.rect(5 - stage / 2, 10 - stage / 3, 3 + stage, 2, 0x9fc7e8ff);
      frame.rect(7, 8 - stage / 2, 2, 1, 0xdff0ffff);
    } else if (name.startsWith("tag")) {
      for (let arm = 0; arm < 8; arm += 1) {
        const radius = 2 + stage;
        const angle = (Math.PI * 2 * arm) / 8;
        const x = Math.round(8 + Math.cos(angle) * radius);
        const y = Math.round(8 + Math.sin(angle) * radius);
        frame.set(x, y, 0xfff7d6ff);
      }
      frame.rect(7, 7, 2, 2, 0xff8da0ff);
    } else if (name.startsWith("jump")) {
      frame.frame(4 - stage, 10 - stage, 8 + stage * 2, 2 + stage, 0xbde0ffff);
    } else {
      frame.rect(4 + stage, 7, 5, 2, 0xff8e8eff);
      frame.rect(3 + stage, 8, 7, 1, 0xffccd2ff);
    }
    const x = (index % columns) * frameSize;
    const y = Math.floor(index / columns) * frameSize;
    atlas.blit(frame, x, y);
    frames[name] = { x, y, w: frameSize, h: frameSize };
  }

  const file = "fx-atlas.png";
  const metadataFile = "fx-atlas.json";
  writeFileSync(join(outDir, file), encodePng(atlas));
  writeFileSync(join(outDir, metadataFile), JSON.stringify({ frameSize, frames }, null, 2));
  return { file, metadataFile };
};

const createUiAtlas = (outDir: string): { file: string; metadataFile: string } => {
  const atlas = new PixelCanvas(256, 96, 0x00000000);
  const frames: Record<string, Frame> = {};

  const panel = { x: 0, y: 0, w: 96, h: 40 };
  atlas.rect(panel.x, panel.y, panel.w, panel.h, 0x0e1a32ff);
  atlas.frame(panel.x, panel.y, panel.w, panel.h, 0x5f87b8ff);
  atlas.rect(panel.x + 2, panel.y + 2, panel.w - 4, 3, 0xa6c9f1ff);
  frames.panel_large = panel;

  const buttonPrimary = { x: 100, y: 0, w: 56, h: 18 };
  atlas.rect(buttonPrimary.x, buttonPrimary.y, buttonPrimary.w, buttonPrimary.h, 0x2f6ab5ff);
  atlas.frame(buttonPrimary.x, buttonPrimary.y, buttonPrimary.w, buttonPrimary.h, 0xbfddffff);
  atlas.rect(buttonPrimary.x + 2, buttonPrimary.y + 2, buttonPrimary.w - 4, 3, 0xd8ecffff);
  frames.button_primary = buttonPrimary;

  const buttonAlert = { x: 160, y: 0, w: 56, h: 18 };
  atlas.rect(buttonAlert.x, buttonAlert.y, buttonAlert.w, buttonAlert.h, 0xa63c50ff);
  atlas.frame(buttonAlert.x, buttonAlert.y, buttonAlert.w, buttonAlert.h, 0xffc5d0ff);
  atlas.rect(buttonAlert.x + 2, buttonAlert.y + 2, buttonAlert.w - 4, 3, 0xffdde4ff);
  frames.button_alert = buttonAlert;

  const badgeIt = { x: 220, y: 0, w: 28, h: 14 };
  atlas.rect(badgeIt.x, badgeIt.y, badgeIt.w, badgeIt.h, 0xff6b84ff);
  atlas.frame(badgeIt.x, badgeIt.y, badgeIt.w, badgeIt.h, 0xffe1e8ff);
  frames.badge_it = badgeIt;

  const timerBack = { x: 0, y: 44, w: 192, h: 10 };
  atlas.rect(timerBack.x, timerBack.y, timerBack.w, timerBack.h, 0x172b4aff);
  atlas.frame(timerBack.x, timerBack.y, timerBack.w, timerBack.h, 0x8ab1dfff);
  frames.timer_back = timerBack;

  const timerFill = { x: 0, y: 58, w: 192, h: 6 };
  for (let x = 0; x < timerFill.w; x += 1) {
    const color = mixColor(0x73f6ffff, 0xff7d8dff, x / (timerFill.w - 1));
    atlas.rect(timerFill.x + x, timerFill.y, 1, timerFill.h, color);
  }
  atlas.frame(timerFill.x, timerFill.y, timerFill.w, timerFill.h, 0x0f2038ff);
  frames.timer_fill = timerFill;

  const iconPad = { x: 196, y: 44, w: 40, h: 24 };
  atlas.rect(iconPad.x, iconPad.y, iconPad.w, iconPad.h, 0x243954ff);
  atlas.frame(iconPad.x, iconPad.y, iconPad.w, iconPad.h, 0x9fbddeff);
  atlas.rect(iconPad.x + 6, iconPad.y + 8, 6, 2, 0xecf6ffff);
  atlas.rect(iconPad.x + 8, iconPad.y + 6, 2, 6, 0xecf6ffff);
  atlas.rect(iconPad.x + 24, iconPad.y + 7, 4, 4, 0xecf6ffff);
  frames.icon_gamepad = iconPad;

  const file = "ui-atlas.png";
  const metadataFile = "ui-atlas.json";
  writeFileSync(join(outDir, file), encodePng(atlas));
  writeFileSync(join(outDir, metadataFile), JSON.stringify({ frames }, null, 2));
  return { file, metadataFile };
};

const createBackground = (
  width: number,
  height: number,
  topColor: number,
  bottomColor: number,
  seed: number,
  accentColor: number
): PixelCanvas => {
  const c = new PixelCanvas(width, height, 0x00000000);
  const random = mulberry32(seed);

  for (let y = 0; y < height; y += 1) {
    const t = y / Math.max(1, height - 1);
    const rowColor = mixColor(topColor, bottomColor, t);
    c.rect(0, y, width, 1, rowColor);
  }

  for (let i = 0; i < 150; i += 1) {
    const x = Math.floor(random() * width);
    const y = Math.floor(random() * (height * 0.45));
    c.rect(x, y, 1 + Math.floor(random() * 2), 1, 0xffffff99);
  }

  for (let cloud = 0; cloud < 12; cloud += 1) {
    const cx = Math.floor(random() * width);
    const cy = Math.floor(random() * (height * 0.35)) + 22;
    const w = 26 + Math.floor(random() * 54);
    const h = 10 + Math.floor(random() * 10);
    const cloudColor = mixColor(0xffffffaa, accentColor, 0.22);
    c.rect(cx, cy, w, h, cloudColor);
    c.rect(cx + 6, cy - 4, w - 10, 5, mixColor(cloudColor, 0xffffffaa, 0.32));
  }

  const ridgeBase = Math.floor(height * 0.6);
  for (let x = 0; x < width; x += 8) {
    const bump = Math.floor(Math.sin((x + seed) * 0.03) * 12 + Math.cos((x + seed) * 0.013) * 8);
    const top = ridgeBase + bump;
    c.rect(x, top, 8, height - top, mixColor(bottomColor, 0x101926ff, 0.6));
  }

  c.rect(0, height - 20, width, 20, mixColor(bottomColor, 0x0b1222ff, 0.72));
  c.rect(0, height - 22, width, 2, accentColor);
  return c;
};

const createMapBackgrounds = (outDir: string): string[] => {
  const specs = [
    {
      name: "bg-neon-rooftops.png",
      top: 0x13254fff,
      bottom: 0x63377fff,
      accent: 0x88d3ffff,
      seed: 101
    },
    {
      name: "bg-sewer-scramble.png",
      top: 0x163835ff,
      bottom: 0x3a6f5dff,
      accent: 0xb4ebbeff,
      seed: 202
    },
    {
      name: "bg-arcade-foundry.png",
      top: 0x43233dff,
      bottom: 0x9a4638ff,
      accent: 0xffc376ff,
      seed: 303
    }
  ] as const;

  const files: string[] = [];
  for (const spec of specs) {
    const background = createBackground(640, 360, spec.top, spec.bottom, spec.seed, spec.accent);
    writeFileSync(join(outDir, spec.name), encodePng(background));
    files.push(spec.name);
  }
  return files;
};

const run = (): void => {
  const generatedRoot = join(process.cwd(), "public", "generated");
  const outDir = join(generatedRoot, "pixel");
  mkdirSync(outDir, { recursive: true });

  const players = createPlayersAtlas(outDir);
  const tiles = createTilesAtlas(outDir);
  const powerups = createPowerupAtlas(outDir);
  const fx = createFxAtlas(outDir);
  const ui = createUiAtlas(outDir);
  const backgrounds = createMapBackgrounds(outDir);

  const manifest = {
    generatedAt: new Date().toISOString(),
    atlases: [
      { name: "players", file: `pixel/${players.file}`, metadata: `pixel/${players.metadataFile}` },
      { name: "tiles", file: `pixel/${tiles.file}`, metadata: `pixel/${tiles.metadataFile}` },
      { name: "powerups", file: `pixel/${powerups.file}`, metadata: `pixel/${powerups.metadataFile}` },
      { name: "fx", file: `pixel/${fx.file}`, metadata: `pixel/${fx.metadataFile}` },
      { name: "ui", file: `pixel/${ui.file}`, metadata: `pixel/${ui.metadataFile}` }
    ],
    maps: [
      { id: "neon-rooftops", background: `pixel/${backgrounds[0]}` },
      { id: "sewer-scramble", background: `pixel/${backgrounds[1]}` },
      { id: "arcade-foundry", background: `pixel/${backgrounds[2]}` }
    ],
    style: {
      pixelScaleHint: 2,
      tileSize: 16,
      playerFrame: { width: 16, height: 24 }
    }
  };

  writeFileSync(join(generatedRoot, "assets-manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(
    join(outDir, "README.txt"),
    [
      "Generated pixel assets for Tag Infinity.",
      "",
      "Contents:",
      "- players-atlas.png/json",
      "- tiles-atlas.png/json",
      "- powerups-atlas.png/json",
      "- fx-atlas.png/json",
      "- ui-atlas.png/json",
      "- bg-neon-rooftops.png",
      "- bg-sewer-scramble.png",
      "- bg-arcade-foundry.png"
    ].join("\n")
  );
};

run();
