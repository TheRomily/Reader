// Exercises the real packaged renderer and IPC. The fixture converter tests
// argument routing only; actual format conversion remains Calibre's job.
import { _electron as electron, expect } from "@playwright/test";
import {
  mkdtemp,
  writeFile,
  readFile,
  mkdir,
  chmod,
  realpath,
  rm,
} from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { createPdf, createEpub, createMobi } from "./fixtures.mjs";
import { assertSpread } from "./assert-spread.mjs";

const temp = await mkdtemp(join(tmpdir(), "yuejing-desktop-"));
const config = join(temp, "config");
const cache = join(temp, "cache");
await mkdir(config);
await mkdir(cache);
let app;
try {
  app = await electron.launch({
    ...(process.env.READER_DESKTOP_EXECUTABLE
      ? { executablePath: process.env.READER_DESKTOP_EXECUTABLE }
      : {}),
    args: [
      ...(process.env.READER_NO_SANDBOX === "1" ? ["--no-sandbox"] : []),
      "--disable-dev-shm-usage",
      `--user-data-dir=${join(temp, "user")}`,
      ...(process.env.READER_DESKTOP_EXECUTABLE ? [] : ["."]),
    ],
    cwd: process.cwd(),
    timeout: 30000,
    env: { ...process.env, XDG_CONFIG_HOME: config, XDG_CACHE_HOME: cache },
  });
  const userData = await app.evaluate(({ app }) => app.getPath("userData"));
  const scope = relative(await realpath(temp), await realpath(userData));
  if (
    isAbsolute(scope) ||
    scope === ".." ||
    scope.startsWith("../") ||
    scope.startsWith("..\\")
  )
    throw new Error(
      "桌面验收未能使用独立临时数据目录；为保护原书库，已停止测试。",
    );
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(
    page.getByRole("button", { name: "阅读 山海之间", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => typeof window.require)).toBe("undefined");
  expect(await page.evaluate(() => location.protocol)).toBe("reader:");
  for (const [name, buffer, title, kind] of [
    ["desktop.pdf", await createPdf(), "desktop", "image"],
    ["desktop.epub", await createEpub(), "测试 EPUB 漫游", "html"],
    ["desktop.mobi", createMobi(), "MOBI Test Book", "html"],
  ]) {
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({ name, mimeType: "application/octet-stream", buffer });
    await expect(page.locator(".import-results")).toContainText("已加入书架", {
      timeout: 20000,
    });
    await page.getByRole("button", { name: "关闭弹窗", exact: true }).click();
    await page
      .getByRole("button", { name: `阅读 ${title}`, exact: true })
      .click();
    if (kind === "image")
      await expect(page.locator(".reader-page > img")).toBeVisible();
    else
      await expect(
        page.frameLocator(".reader-page iframe").locator("body"),
      ).toContainText(
        name.endsWith("epub") ? "真实正文" : "MOBI FIRST CHAPTER",
      );
    if (kind === "image") {
      await page
        .getByRole("button", { name: "打开阅读导航", exact: true })
        .click();
      await page.getByRole("button", { name: "阅读设置", exact: true }).click();
      await page.getByRole("button", { name: "双页", exact: true }).click();
      await assertSpread(page);
      await page.getByRole("button", { name: "从右到左", exact: true }).click();
      await assertSpread(page, true);
      await page.getByRole("button", { name: "从左到右", exact: true }).click();
      await page.getByRole("button", { name: "单页", exact: true }).click();
      await page
        .getByRole("button", { name: "关闭阅读设置", exact: true })
        .click();
      await page.getByRole("button", { name: "收起导航", exact: true }).click();
      console.log(
        "PASS packaged PDF spread geometry, LTR and RTL with both panels",
      );
    }
    await page.getByRole("button", { name: "下一页", exact: true }).click();
    await expect(
      page.getByRole("spinbutton", { name: "跳转页码" }),
    ).toHaveValue("2");
    if (kind === "html")
      await expect(
        page.frameLocator(".reader-page iframe").locator("body"),
      ).toContainText(
        name.endsWith("epub") ? "第二章已成功读取" : "MOBI SECOND CHAPTER",
      );
    await page.getByRole("button", { name: "添加书签", exact: true }).click();
    await page.getByRole("button", { name: "返回书架", exact: true }).click();
    await page.reload();
    await page
      .getByRole("button", { name: `阅读 ${title}`, exact: true })
      .click();
    await expect(
      page.getByRole("spinbutton", { name: "跳转页码" }),
    ).toHaveValue("2");
    await page
      .getByRole("button", { name: "打开阅读导航", exact: true })
      .click();
    await page.getByRole("button", { name: "书签", exact: true }).click();
    await expect(page.locator(".bookmark-row")).toContainText("第 2");
    await page.getByRole("button", { name: "返回书架", exact: true }).click();
    console.log(`PASS desktop local ${name}`);
  }
  const converter = join(temp, "ebook-convert");
  const source = join(temp, "source book ; safe.txt");
  const output = join(temp, "result book.epub");
  await writeFile(source, "A local conversion IPC fixture");
  await writeFile(
    converter,
    `#!${process.execPath}\nconst fs=require('node:fs');fs.writeFileSync(process.argv[3],JSON.stringify({input:process.argv[2],text:fs.readFileSync(process.argv[2],'utf8')}));\n`,
  );
  await chmod(converter, 0o700);
  await app.evaluate(
    ({ dialog }, { converter, source, output }) => {
      let stage = 0;
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [stage++ ? source : converter],
      });
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: output,
      });
    },
    { converter, source, output },
  );
  expect(
    await page.evaluate(() => window.readerDesktop.chooseCalibre()),
  ).toEqual({ available: true });
  const picked = await page.evaluate(() =>
    window.readerDesktop.pickConversionSource(),
  );
  expect(picked.name).toBe("source book ; safe.txt");
  const result = await page.evaluate(
    (token) => window.readerDesktop.convert({ token, format: "epub" }),
    picked.token,
  );
  expect(result).toEqual({ ok: true });
  expect(JSON.parse(await readFile(output, "utf8"))).toEqual({
    input: source,
    text: "A local conversion IPC fixture",
  });
  expect(
    await page.evaluate(() =>
      window.readerDesktop.convert({ token: "untrusted", format: "exe" }),
    ),
  ).toMatchObject({ ok: false });
  expect(errors).toEqual([]);
  console.log(
    "PASS desktop IPC routing, safe file arguments, validation and renderer isolation",
  );
} finally {
  if (app) await app.close();
  await rm(temp, { recursive: true, force: true });
}
