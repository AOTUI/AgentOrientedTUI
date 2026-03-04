/**
 * fix-icon.mjs
 *
 * 解决 macOS 应用图标不能填满图标区域的问题。
 *
 * 原因：源图片可能含有透明/空白的边距，导致 macOS 展示时内容偏小。
 * 本脚本会：
 *  1. 读取源 PNG（1024x1024）
 *  2. 自动裁剪掉四周透明像素（autocrop）
 *  3. 将内容缩放填充至标准 1024x1024 画布（保留少量内边距以符合 Apple 设计规范）
 *  4. 生成 macOS iconutil 所需的全套尺寸
 *  5. 调用系统 iconutil 重新生成 .icns 文件
 *
 * 用法：
 *   node scripts/fix-icon.mjs [source.png]
 *   默认源文件：build/icons/png/1024x1024.png
 */

import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const Jimp = require('jimp');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── 配置 ──────────────────────────────────────────────────────────────────
const SOURCE_PNG = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, 'build/icons/png/1024x1024.png');

const ICNS_OUT  = path.join(ROOT, 'build/icons/mac/icon.icns');
const PNG_DIR   = path.join(ROOT, 'build/icons/png');
const ICONSET   = path.join(ROOT, 'build/icons/mac/AppIcon.iconset');

/**
 * 内边距比例（0 = 完全填满，0.05 = 四周留 5% 空白）
 * macOS 会自动为 App icon 添加圆角遮罩，内容可以填满整个画布。
 * 如果你希望在圆角内再留一点空白，可以把这个值调大（如 0.05）。
 */
const PADDING_RATIO = 0.0;

// macOS iconutil 所需的尺寸规格
const ICONSET_SIZES = [
  { file: 'icon_16x16.png',       size: 16   },
  { file: 'icon_16x16@2x.png',    size: 32   },
  { file: 'icon_32x32.png',       size: 32   },
  { file: 'icon_32x32@2x.png',    size: 64   },
  { file: 'icon_128x128.png',     size: 128  },
  { file: 'icon_128x128@2x.png',  size: 256  },
  { file: 'icon_256x256.png',     size: 256  },
  { file: 'icon_256x256@2x.png',  size: 512  },
  { file: 'icon_512x512.png',     size: 512  },
  { file: 'icon_512x512@2x.png',  size: 1024 },
];

// png 目录里额外保留的常规尺寸（供 Linux / Windows 使用）
const EXTRA_PNG_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

// ── 工具函数 ──────────────────────────────────────────────────────────────
function log(msg) { console.log(`[fix-icon] ${msg}`); }

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * 用 jimp 将图片缩放到目标尺寸并保存
 */
async function writeResized(img, targetSize, outPath) {
  const clone = img.clone();
  clone.resize(targetSize, targetSize, Jimp.RESIZE_LANCZOS);
  await clone.writeAsync(outPath);
}

// ── 主流程 ────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(SOURCE_PNG)) {
    console.error(`[fix-icon] 源文件不存在: ${SOURCE_PNG}`);
    process.exit(1);
  }

  log(`读取源文件: ${SOURCE_PNG}`);
  let img = await Jimp.read(SOURCE_PNG);
  const origW = img.getWidth();
  const origH = img.getHeight();
  log(`原始尺寸: ${origW}x${origH}`);

  // ① 裁掉透明边距
  img.autocrop({ tolerance: 0.002, cropOnlyFrames: false });
  const croppedW = img.getWidth();
  const croppedH = img.getHeight();
  log(`裁剪后尺寸: ${croppedW}x${croppedH}`);

  // ② 将内容等比缩放到 1024x1024 画布，居中放置，四周加上内边距
  const CANVAS = 1024;
  const pad = Math.round(CANVAS * PADDING_RATIO);
  const contentSize = CANVAS - pad * 2;

  // 等比缩放内容区
  const scale = Math.min(contentSize / croppedW, contentSize / croppedH);
  const scaledW = Math.round(croppedW * scale);
  const scaledH = Math.round(croppedH * scale);

  img.resize(scaledW, scaledH, Jimp.RESIZE_LANCZOS);

  // 创建透明画布并将内容居中贴上
  const canvas = new Jimp(CANVAS, CANVAS, 0x00000000); // 全透明
  const offsetX = Math.round((CANVAS - scaledW) / 2);
  const offsetY = Math.round((CANVAS - scaledH) / 2);
  canvas.composite(img, offsetX, offsetY);

  log(`处理后内容区: ${scaledW}x${scaledH}，偏移: (${offsetX}, ${offsetY})`);

  // ③ 生成 iconset 所需各尺寸
  ensureDir(ICONSET);
  log(`生成 iconset 文件到: ${ICONSET}`);
  for (const { file, size } of ICONSET_SIZES) {
    const outPath = path.join(ICONSET, file);
    await writeResized(canvas, size, outPath);
    log(`  ✓ ${file} (${size}x${size})`);
  }

  // ④ 用 iconutil 生成 .icns
  ensureDir(path.dirname(ICNS_OUT));
  log(`生成 .icns: ${ICNS_OUT}`);
  execSync(`iconutil -c icns "${ICONSET}" -o "${ICNS_OUT}"`);
  log(`  ✓ icon.icns 生成成功`);

  // ⑤ 更新 png 目录里的各尺寸 PNG（供 non-macOS 使用）
  ensureDir(PNG_DIR);
  log(`更新 png 目录: ${PNG_DIR}`);
  for (const size of EXTRA_PNG_SIZES) {
    const outPath = path.join(PNG_DIR, `${size}x${size}.png`);
    await writeResized(canvas, size, outPath);
    log(`  ✓ ${size}x${size}.png`);
  }

  log('完成！重新运行 npm run electron:build 即可打包最新图标。');
}

main().catch(err => {
  console.error('[fix-icon] 出错:', err.message);
  process.exit(1);
});
