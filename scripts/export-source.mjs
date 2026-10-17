import { createHash } from "node:crypto";
import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const zip = new JSZip();
const allowed = [
  "src",
  "desktop",
  "scripts",
  "tests",
  "docs",
  ".github",
  "public/covers",
  "public/favicon.svg",
  ".gitignore",
  ".nvmrc",
  "index.html",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vite.config.ts",
  "vitest.config.ts",
  "playwright.config.ts",
  "README.md",
  "THIRD_PARTY_NOTICES.md",
  "LICENSE",
];
let count = 0;
async function add(relative) {
  const name = relative.split("/").at(-1);
  if (
    /^(?:\.env(?:\..*)?|node_modules)$|\.(?:p12|pfx|pem|key|local)$/i.test(name)
  )
    return;
  const path = join(root, relative);
  const info = await lstat(path);
  if (info.isSymbolicLink())
    throw new Error(`源码中包含符号链接，请先核对：${relative}`);
  if (info.isDirectory()) {
    for (const entry of (await readdir(path)).sort())
      await add(`${relative}/${entry}`);
  } else if (info.isFile()) {
    zip.file(`Reader/${relative}`, await readFile(path), { date: info.mtime });
    count++;
  }
}
for (const relative of allowed) await add(relative);
const buffer = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 6 },
});
const output = join(root, "release");
await mkdir(output, { recursive: true });
const name = "Reader-mac-local-trial-source.zip";
await writeFile(join(output, name), buffer);
const hash = createHash("sha256").update(buffer).digest("hex");
await writeFile(join(output, name + ".sha256"), `${hash}  ${name}\n`);
console.log(`${count} 个源码文件：${join(output, name)}\nSHA-256: ${hash}`);
