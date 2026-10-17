import { existsSync, mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

// Include every production package's notices in the bundled distribution.
const require = createRequire(import.meta.url);
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const target = "dist/licenses";
mkdirSync(target, { recursive: true });
for (const [location, metadata] of Object.entries(lock.packages)) {
  if (!location || metadata.dev || !existsSync(location)) continue;
  const output = join(
    target,
    location.replaceAll("node_modules/", "").replaceAll("/", "__"),
  );
  mkdirSync(output, { recursive: true });
  for (const name of readdirSync(location)) {
    if (
      /^(license|licence|notice|copying|ofl|authors|copyright)(\.|-|$)/i.test(
        name,
      )
    ) {
      try {
        copyFileSync(join(location, name), join(output, name));
      } catch {
        /* Some packages use a directory of notices. */
      }
    }
  }
}
for (const name of ["LICENSE", "THIRD_PARTY_NOTICES.md"])
  copyFileSync(name, join(target, name));
// Electron's runtime has its own Chromium license collection; electron-builder keeps it.
const electron = dirname(require.resolve("electron/package.json"));
for (const name of ["LICENSE", "LICENSES.chromium.html"]) {
  const source = join(electron, "dist", name);
  if (existsSync(source))
    copyFileSync(source, join(target, `Electron-${name}`));
}
