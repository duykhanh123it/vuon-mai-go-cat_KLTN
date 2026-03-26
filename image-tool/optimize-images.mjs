import fs from "fs";
import path from "path";
import sharp from "sharp";

// 👉 ĐỔI ĐÚNG PATH CỦA BẠN
const INPUT_DIR = "C:/Users/kduy8/Downloads/BS 2026-20260102T064936Z-3-001/BS 2026";
const OUTPUT_DIR = path.join(INPUT_DIR, "_optimized");

// Thông số tối ưu cho web
const THUMB_WIDTH = 720;     // list
const FULL_WIDTH = 1600;     // detail
const QUALITY = 78;

const EXT_ALLOW = [".jpg", ".jpeg", ".png", ".webp"];

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function main() {
  const thumbDir = path.join(OUTPUT_DIR, "thumb");
  const fullDir = path.join(OUTPUT_DIR, "full");

  ensureDir(thumbDir);
  ensureDir(fullDir);

  const files = fs.readdirSync(INPUT_DIR)
    .filter(f => EXT_ALLOW.includes(path.extname(f).toLowerCase()));

  console.log(`🖼 Found ${files.length} images\n`);

  for (const file of files) {
    const input = path.join(INPUT_DIR, file);
    const name = path.parse(file).name; // giữ nguyên bs149

    const thumbOut = path.join(thumbDir, `${name}.webp`);
    const fullOut = path.join(fullDir, `${name}.webp`);

    const img = sharp(input).rotate();

    await img
      .clone()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(thumbOut);

    await img
      .clone()
      .resize({ width: FULL_WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(fullOut);

    console.log(`✅ ${file} → thumb/full`);
  }

  console.log("\n🎉 XONG! Ảnh đã được tối ưu.");
  console.log(`📁 Output: ${OUTPUT_DIR}`);
}

main();
