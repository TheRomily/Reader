import { _electron as electron, expect } from "@playwright/test";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  realpath,
  rm,
  access,
} from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join, resolve, relative, isAbsolute, basename } from "node:path";
import { assertSpread } from "./assert-spread.mjs";

const run = promisify(execFile);
const output = resolve(
  process.env.READER_ACCEPTANCE_OUTPUT || "release/acceptance-evidence-r2",
);
const selection = JSON.parse(
  await readFile(join(output, "selected-samples.json"), "utf8"),
);
const executable = process.env.READER_DESKTOP_EXECUTABLE;
if (!executable)
  throw new Error(
    "READER_DESKTOP_EXECUTABLE must identify the signed packaged app",
  );
const temporary = await mkdtemp(join(tmpdir(), "reader-real-samples-"));
const userData = join(temporary, "user");
const result = {
  status: "running",
  startedAt: new Date().toISOString(),
  executable,
  sampleRoot: selection.root,
  cases: [],
  geometry: [],
  errors: [],
  externalRequests: [],
};
let app, page;
const save = () =>
  writeFile(
    join(output, "real-samples.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
const button = (name) => page.getByRole("button", { name, exact: true });
async function start() {
  app = await electron.launch({
    executablePath: executable,
    args: [`--user-data-dir=${userData}`],
    timeout: 30000,
  });
  const actual = await app.evaluate(({ app }) => app.getPath("userData"));
  const scope = relative(await realpath(temporary), await realpath(actual));
  if (isAbsolute(scope) || scope === ".." || scope.startsWith("../"))
    throw new Error("Temporary library isolation failed");
  result.userData = actual;
  page = await app.firstWindow();
  page.setDefaultTimeout(60000);
  page.on("pageerror", (error) => result.errors.push(error.message));
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()))
      result.externalRequests.push(request.url());
  });
  await page.locator(".book-card").first().waitFor();
}
async function books() {
  return page.evaluate(async () => {
    const db = await new Promise((resolve) => {
      const request = indexedDB.open("yuejing-library");
      request.onsuccess = () => resolve(request.result);
    });
    const list = await new Promise((resolve) => {
      const request = db.transaction("books").objectStore("books").getAll();
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return list.map(
      ({ id, title, total, page, fileName, bookmarks, notes }) => ({
        id,
        title,
        total,
        page,
        fileName,
        bookmarks,
        notes,
      }),
    );
  });
}
async function setZoom(target) {
  const current = Number(
    (await page.locator(".zoom-control > span").textContent()).replace("%", ""),
  );
  for (
    let value = current;
    value !== target;
    value += value < target ? 10 : -10
  )
    await button(value < target ? "放大页面" : "缩小页面").click();
}
async function rendered() {
  await expect
    .poll(
      () => page.locator(".reader-page > img, .reader-page iframe").count(),
      { timeout: 60000 },
    )
    .toBeGreaterThan(0);
  await expect(page.locator(".page-error")).toHaveCount(0);
  if (await page.locator(".reader-page > img").count()) {
    await expect
      .poll(
        () =>
          page
            .locator(".reader-page > img")
            .first()
            .evaluate((img) => img.complete && img.naturalWidth > 0),
        { timeout: 60000 },
      )
      .toBe(true);
    return {
      kind: "image",
      images: await page.locator(".reader-page > img").evaluateAll((images) =>
        images.map((img) => ({
          width: img.naturalWidth,
          height: img.naturalHeight,
        })),
      ),
    };
  }
  const body = page.frameLocator(".reader-page iframe").first().locator("body");
  await expect(body).toBeVisible({ timeout: 60000 });
  await expect
    .poll(
      () =>
        body.evaluate(
          (body) =>
            body.textContent.trim().length > 0 ||
            Array.from(body.querySelectorAll("img")).some(
              (img) => img.complete && img.naturalWidth > 0,
            ),
        ),
      { timeout: 60000 },
    )
    .toBe(true);
  return body.evaluate((body) => ({
    kind: "html",
    textLength: body.textContent.trim().length,
    imageCount: body.querySelectorAll("img").length,
    loadedImages: Array.from(body.querySelectorAll("img")).filter(
      (img) => img.complete && img.naturalWidth > 0,
    ).length,
  }));
}
async function readSample(sample, index) {
  const item = {
    source: sample.relativePath,
    path: sample.path,
    bytes: sample.bytes,
    sha256: sample.sha256,
    origin: sample.origin,
    startedAt: new Date().toISOString(),
    status: "running",
  };
  result.cases.push(item);
  await save();
  console.log("IMPORT", sample.relativePath);
  const before = new Set((await books()).map((book) => book.id));
  await page.locator("input[type=file]").first().setInputFiles(sample.path);
  await expect(page.locator(".import-results")).toContainText("已加入书架", {
    timeout: 180000,
  });
  const book = (await books()).find((book) => !before.has(book.id));
  if (!book) throw new Error("No new book was saved after import");
  item.book = book;
  await button("关闭弹窗").click();
  await button(`阅读 ${book.title}`).first().click();
  item.firstPage = await rendered();
  await button("阅读设置").click();
  await button("打开阅读导航").click();
  if (book.total >= 2) {
    await button("双页").click();
    await expect(page.locator(".reader-page")).toHaveCount(2);
    await expect
      .poll(() => page.locator(".page-loading").count(), { timeout: 60000 })
      .toBe(0);
    for (const [width, height] of [
      [1360, 920],
      [1000, 760],
      [780, 600],
    ]) {
      await app.evaluate(
        ({ BrowserWindow }, { width, height }) =>
          BrowserWindow.getAllWindows()[0].setSize(width, height),
        { width, height },
      );
      await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width);
      for (const fit of ["完整页面", "适应宽度"]) {
        await button(fit).click();
        for (const zoom of [100, 150]) {
          await setZoom(zoom);
          result.geometry.push({
            source: sample.relativePath,
            width,
            height,
            fit,
            zoom,
            direction: "ltr",
            boxes: await assertSpread(page),
          });
          await button("从右到左").click();
          result.geometry.push({
            source: sample.relativePath,
            width,
            height,
            fit,
            zoom,
            direction: "rtl",
            boxes: await assertSpread(page, true),
          });
          await button("从左到右").click();
        }
      }
    }
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1360, 920),
    );
    await setZoom(100);
    await button("完整页面").click();
    await assertSpread(page);
    item.screenshot = `real-${index}-double.png`;
    await page.screenshot({ path: join(output, item.screenshot) });
    if (book.total >= 3) {
      await button("下一页").click();
      await expect(
        page.getByRole("spinbutton", { name: "跳转页码" }),
      ).toHaveValue("3");
    }
  } else item.spread = "not-applicable-single-logical-section";
  await button("单页").click();
  if (book.total >= 2) {
    await page.getByRole("spinbutton", { name: "跳转页码" }).fill("2");
    await expect(
      page.getByRole("spinbutton", { name: "跳转页码" }),
    ).toHaveValue("2");
  }
  item.secondPage = await rendered();
  await button("添加书签").click();
  await button("写笔记").click();
  await page
    .getByPlaceholder("这一页，让你想到了什么？")
    .fill(`真实漫画样本验收 ${index}：重启后保留。`);
  await button("保存笔记").click();
  await button("返回书架").click();
  item.expectedPage = book.total >= 2 ? 2 : 1;
  item.status = "passed";
  item.finishedAt = new Date().toISOString();
  await save();
  console.log(
    "PASS real sample",
    sample.relativePath,
    "logical pages",
    book.total,
  );
}
try {
  await mkdir(output, { recursive: true });
  await start();
  let index = 0;
  for (const sample of selection.samples.filter(
    (s) => s.expected === "readable",
  ))
    await readSample(sample, ++index);
  const archive = selection.samples.find(
    (s) => s.expected === "reject-no-images",
  );
  if (archive) {
    console.log("CHECK PDF-only 7z boundary");
    await page.locator("input[type=file]").first().setInputFiles(archive.path);
    await expect(page.locator(".import-results")).toContainText(
      "压缩包内没有支持的图片",
      { timeout: 180000 },
    );
    result.archiveBoundary = {
      source: archive.relativePath,
      status: "passed-expected-rejection",
      member: "110-111.pdf",
      reason: "PDF-only archive; comic archives accept image entries",
    };
    await page.screenshot({ path: join(output, "real-7z-pdf-boundary.png") });
    await button("关闭弹窗").click();
    const extracted = join(temporary, "extracted");
    await mkdir(extracted);
    await run("/usr/bin/tar", ["-xf", archive.path, "-C", extracted]);
    const pdf = join(extracted, "110-111.pdf");
    const hash = createHash("sha256");
    for await (const part of createReadStream(pdf)) hash.update(part);
    const { size } = await (await import("node:fs/promises")).stat(pdf);
    await readSample(
      {
        relativePath: "110-111.7z!/110-111.pdf",
        path: pdf,
        bytes: size,
        sha256: hash.digest("hex"),
        origin:
          "7z member extracted to temporary directory; original archive unchanged",
      },
      ++index,
    );
  }
  console.log("RESTART for real sample persistence");
  await app.close();
  app = undefined;
  await start();
  for (const item of result.cases) {
    const restored = (await books()).find((book) => book.id === item.book.id);
    expect(restored.page + 1).toBe(item.expectedPage);
    expect(restored.bookmarks).toContain(item.expectedPage - 1);
    expect(
      restored.notes.some((note) => note.text.includes("真实漫画样本验收")),
    ).toBe(true);
    await button(`阅读 ${restored.title}`).first().click();
    await expect(
      page.getByRole("spinbutton", { name: "跳转页码" }),
    ).toHaveValue(String(item.expectedPage));
    await rendered();
    await button("返回书架").click();
    item.restartPersistence = "passed";
  }
  expect(result.errors).toEqual([]);
  expect(result.externalRequests).toEqual([]);
  result.status = "passed";
  // Keep one real PDF at the repaired spread for native UI review when requested.
  if (process.env.READER_VISUAL_HOLD === "1") {
    const first = result.cases[0];
    await button(`阅读 ${first.book.title}`).first().click();
    await page.getByRole("spinbutton", { name: "跳转页码" }).fill("1");
    await button("阅读设置").click();
    await button("打开阅读导航").click();
    await button("双页").click();
    await assertSpread(page);
    await writeFile(
      join(output, "ready-for-visual.json"),
      JSON.stringify({ pid: app.process().pid, executable }),
    );
    console.log("READY_FOR_VISUAL");
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
      try {
        await access(join(output, "visual-complete"));
        break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
} catch (error) {
  result.status = "failed";
  result.error = error.stack;
  if (page)
    await page
      .screenshot({ path: join(output, "real-samples-failure.png") })
      .catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  if (app) await app.close();
  await rm(temporary, { recursive: true, force: true });
  result.finishedAt = new Date().toISOString();
  result.temporaryLibraryRemoved = true;
  await save();
}
