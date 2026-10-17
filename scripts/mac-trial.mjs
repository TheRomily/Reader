import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import { arch, release, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function assertMac(platform = process.platform) {
  if (platform !== "darwin")
    throw new Error(
      "必须在你的 Mac 本机运行；当前不是 macOS，不能进行实机验收或 Mac 签名。",
    );
}
export function trialConfig(base, architecture) {
  if (!["arm64", "x64"].includes(architecture))
    throw new Error("仅支持 Apple Silicon 或 Intel Mac。");
  return {
    ...base,
    forceCodeSigning: true,
    directories: { ...base.directories, output: "release/mac-trial" },
    mac: {
      ...base.mac,
      identity: "-",
      hardenedRuntime: false,
      notarize: false,
      target: [{ target: "dir", arch: [architecture] }],
    },
  };
}
export function assertAdHocSignature(output) {
  if (!/^Signature=adhoc\s*$/m.test(output))
    throw new Error("未检测到有效的 ad-hoc 签名，停止生成验收通过报告。");
}
function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      shell: false,
      ...options,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    if (options.capture) {
      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });
      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });
    }
    child.once("error", (error) =>
      reject(new Error(`无法启动 ${command}：${error.message}`)),
    );
    child.once("close", (code) =>
      code === 0
        ? resolvePromise({ stdout, stderr })
        : reject(
            new Error(
              `${command} 执行失败（退出码 ${code}）。${options.capture ? "\n" + stderr : ""}`,
            ),
          ),
    );
  });
}
async function verifyApp(appPath, architecture) {
  await run("/usr/bin/codesign", [
    "--verify",
    "--deep",
    "--strict",
    "--verbose=2",
    appPath,
  ]);
  const signature = await run(
    "/usr/bin/codesign",
    ["-d", "--verbose=4", appPath],
    { capture: true },
  );
  assertAdHocSignature(signature.stdout + "\n" + signature.stderr);
  const info = await run(
    "/usr/libexec/PlistBuddy",
    ["-c", "Print :CFBundleExecutable", join(appPath, "Contents/Info.plist")],
    { capture: true },
  );
  const executable = join(appPath, "Contents/MacOS", info.stdout.trim());
  const binary = await run("/usr/bin/lipo", ["-archs", executable], {
    capture: true,
  });
  if (
    !binary.stdout
      .trim()
      .split(/\s+/)
      .includes(architecture === "x64" ? "x86_64" : "arm64")
  )
    throw new Error("应用架构与本机 Node.js 架构不一致。");
  return executable;
}
async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
export async function main(args = process.argv.slice(2)) {
  assertMac();
  if (args.some((arg) => arg !== "--check"))
    throw new Error("支持的选项仅为 --check；默认按本机架构验收。");
  const architecture = arch();
  trialConfig({}, architecture);
  await access("/usr/bin/codesign", constants.X_OK);
  await run("/usr/bin/hdiutil", ["help"], { capture: true });
  await run("/usr/bin/xcrun", ["--find", "clang"], { capture: true });
  console.log(
    `macOS ${release()} / ${architecture}：本机打包与 ad-hoc 签名工具可用。无需开发者证书。`,
  );
  if (args.includes("--check")) return;
  const output = join(root, "release/mac-trial");
  await mkdir(output, { recursive: true });
  const report = {
    status: "running",
    signing: "ad-hoc-local-trial",
    host: { platform: "darwin", architecture, release: release() },
    startedAt: new Date().toISOString(),
    checks: [],
    appPath: null,
    diskImage: null,
  };
  const reportPath = join(
    output,
    `acceptance-${architecture}-${Date.now()}.json`,
  );
  const record = async (name, action) => {
    console.log(`\n▶ ${name}`);
    await action();
    report.checks.push({ name, status: "passed" });
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  };
  let temp;
  let mounted = false;
  try {
    await record("现有解析测试", () =>
      run(process.execPath, [
        join(root, "node_modules/vitest/vitest.mjs"),
        "run",
      ]),
    );
    await record("生产构建", () =>
      run(process.execPath, [
        join(root, "node_modules/typescript/bin/tsc"),
        "-b",
      ])
        .then(() =>
          run(process.execPath, [
            join(root, "node_modules/vite/bin/vite.js"),
            "build",
          ]),
        )
        .then(() =>
          run(process.execPath, [join(root, "scripts/copy-notices.mjs")]),
        ),
    );
    await record("Mac 本机 ad-hoc 签名打包", async () => {
      const { build, Platform, Arch } = await import("electron-builder");
      const pkg = JSON.parse(
        await readFile(join(root, "package.json"), "utf8"),
      );
      const config = trialConfig(pkg.build, architecture);
      // This trial explicitly uses no developer identity or imported certificate.
      for (const name of ["CSC_LINK", "CSC_KEY_PASSWORD", "CSC_NAME"])
        delete process.env[name];
      process.env.CSC_IDENTITY_AUTO_DISCOVERY = "false";
      await build({
        targets: Platform.MAC.createTarget(
          ["dir"],
          architecture === "arm64" ? Arch.arm64 : Arch.x64,
        ),
        publish: "never",
        config: {
          ...config,
          afterPack(context) {
            report.appPath = join(
              context.appOutDir,
              `${context.packager.appInfo.productFilename}.app`,
            );
          },
        },
      });
      if (!report.appPath) throw new Error("未找到本次构建的应用路径。");
    });
    await record("本机 codesign 严格校验与架构核对", () =>
      verifyApp(report.appPath, architecture),
    );
    temp = await mkdtemp(join(tmpdir(), "yuejing-trial-"));
    const staging = join(temp, "image");
    const mountpoint = join(temp, "mounted");
    await mkdir(staging);
    await mkdir(mountpoint);
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    const dmg = join(
      output,
      `Yuejing-${pkg.version}-${architecture}-local-trial.dmg`,
    );
    await record("生成可拖入 Applications 的试用 DMG", async () => {
      await cp(report.appPath, join(staging, "阅境.app"), {
        recursive: true,
        dereference: false,
        verbatimSymlinks: true,
        preserveTimestamps: true,
      });
      await symlink("/Applications", join(staging, "Applications"));
      await run("/usr/bin/hdiutil", [
        "create",
        "-volname",
        "阅境本机试用",
        "-srcfolder",
        staging,
        "-format",
        "UDZO",
        "-ov",
        dmg,
      ]);
      report.diskImage = { path: dmg, sha256: await sha256(dmg) };
    });
    await record("挂载本次 DMG 并校验其中的应用", async () => {
      await run("/usr/bin/hdiutil", [
        "attach",
        dmg,
        "-readonly",
        "-nobrowse",
        "-mountpoint",
        mountpoint,
      ]);
      mounted = true;
      await verifyApp(join(mountpoint, "阅境.app"), architecture);
    });
    await record("从 DMG 中执行桌面功能验收（独立临时书库）", async () => {
      const executable = await verifyApp(
        join(mountpoint, "阅境.app"),
        architecture,
      );
      await run(process.execPath, [join(root, "tests/desktop-smoke.mjs")], {
        env: {
          ...process.env,
          READER_DESKTOP_EXECUTABLE: executable,
          READER_NO_SANDBOX: "0",
        },
      });
    });
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.error = error.message;
    throw error;
  } finally {
    if (mounted && temp) {
      try {
        await run("/usr/bin/hdiutil", ["detach", join(temp, "mounted")]);
      } catch {
        report.status = "failed";
        report.error = "测试 DMG 未能卸载，请用磁盘工具推出后再清理临时目录。";
      }
    }
    if (temp && !report.error?.includes("未能卸载"))
      await rm(temp, { recursive: true, force: true });
    report.finishedAt = new Date().toISOString();
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
    if (report.status !== "passed") process.exitCode = 1;
  }
  if (report.status === "passed")
    console.log(
      `\n本机自动验收通过。试用安装包：${report.diskImage.path}\n报告：${reportPath}\n此签名仅用于本机试用，未进行 Apple 公证。请继续完成 docs/MAC_TRIAL.md 中的人眼与声音验收。`,
    );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
