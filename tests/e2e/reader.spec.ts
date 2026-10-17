import { test, expect } from "@playwright/test";
import { assertSpread } from "../assert-spread.mjs";
import {
  createCbz,
  createEpub,
  createMobi,
  createPdf,
  fb2Fixture,
} from "../fixtures.mjs";

async function importBook(page, name, buffer) {
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({ name, mimeType: "application/octet-stream", buffer });
  await expect(page.locator(".import-results")).toContainText("已加入书架", {
    timeout: 25000,
  });
  await page.getByRole("button", { name: "关闭弹窗", exact: true }).click();
}
test("library, search, favorite, group, notes and reading progress survive reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".book-card")).toHaveCount(6);
  await page.getByRole("textbox", { name: "搜索书籍" }).fill("月球");
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "收藏 月球来信", exact: true })
    .click({ force: true });
  await page.getByRole("button", { name: "我的收藏" }).click();
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "阅读 月球来信", exact: true })
    .click();
  await expect(page.locator(".reader-page > img")).toBeVisible();
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "跳转页码" })).toHaveValue(
    "2",
  );
  await page.getByRole("button", { name: "添加书签", exact: true }).click();
  await page.getByRole("button", { name: "写笔记", exact: true }).click();
  await page
    .getByPlaceholder("这一页，让你想到了什么？")
    .fill("这一页的月光很好看。");
  await page.getByRole("button", { name: "保存笔记", exact: true }).click();
  await page.getByRole("button", { name: "返回书架", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "阅读笔记", exact: true }).click();
  await expect(page.locator(".library-note")).toContainText(
    "这一页的月光很好看。",
  );
  await page.getByRole("button", { name: /月球来信.*第 2/ }).click();
  await expect(page.getByRole("spinbutton", { name: "跳转页码" })).toHaveValue(
    "2",
  );
  await page.getByRole("button", { name: "打开阅读导航", exact: true }).click();
  await page.getByRole("button", { name: "书签", exact: true }).click();
  await expect(page.locator(".bookmark-row")).toContainText("第 2 页");
  await page.getByRole("button", { name: "返回书架", exact: true }).click();
  await page.getByRole("button", { name: "新建分组", exact: true }).click();
  await page.getByPlaceholder("例如：周末的漫画时光").fill("夜晚读物");
  await page.getByRole("button", { name: "创建分组", exact: true }).click();
  await expect(page.getByRole("heading", { name: "夜晚读物." })).toBeVisible();
  expect(errors).toEqual([]);
});
test("real PDF and CBZ render pages and use numeric comic ordering", async ({
  page,
}) => {
  await page.goto("/");
  await importBook(page, "真实PDF.pdf", await createPdf());
  await page.getByRole("button", { name: "阅读 真实PDF", exact: true }).click();
  await expect(page.locator(".reader-page > img")).toBeVisible();
  expect(
    await page
      .locator(".reader-page > img")
      .evaluate((el: HTMLImageElement) => el.naturalWidth),
  ).toBeGreaterThan(100);
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "跳转页码" })).toHaveValue(
    "2",
  );
  await page.getByRole("button", { name: "返回书架", exact: true }).click();
  await importBook(page, "测试漫画.cbz", await createCbz());
  await page
    .getByRole("button", { name: "阅读 测试漫画", exact: true })
    .click();
  await expect(page.locator(".reader-page > img")).toBeVisible();
  await page.getByRole("button", { name: "打开阅读导航", exact: true }).click();
  await expect(page.locator(".chapter-list>button").first()).toContainText(
    "page1.png",
  );
  await expect(page.locator(".chapter-list>button").nth(1)).toContainText(
    "page2.png",
  );
  await page.getByRole("button", { name: "阅读设置", exact: true }).click();
  await page.getByRole("button", { name: "双页", exact: true }).click();
  await expect(page.locator(".reader-page > img")).toHaveCount(2);
  await assertSpread(page);
  await page.getByRole("button", { name: "夜间主题", exact: true }).click();
  await expect(page.locator(".reader-shell")).toHaveClass(/theme-dark/);
});
test("double pages stay side by side with panels, resizing, zoom and RTL", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1360, height: 920 });
  await page.goto("/");
  await importBook(page, "双页回归.cbz", await createCbz());
  await page
    .getByRole("button", { name: "阅读 双页回归", exact: true })
    .click();
  await page.getByRole("button", { name: "打开阅读导航", exact: true }).click();
  await page.getByRole("button", { name: "阅读设置", exact: true }).click();
  await page.getByRole("button", { name: "双页", exact: true }).click();
  for (const size of [
    { width: 1360, height: 920 },
    { width: 1000, height: 760 },
    { width: 780, height: 600 },
  ]) {
    await page.setViewportSize(size);
    for (const fit of ["完整页面", "适应宽度"]) {
      await page.getByRole("button", { name: fit, exact: true }).click();
      await assertSpread(page);
      await page.getByRole("button", { name: "放大页面", exact: true }).click();
      await assertSpread(page);
      await page.getByRole("button", { name: "缩小页面", exact: true }).click();
      await page.getByRole("button", { name: "从右到左", exact: true }).click();
      await assertSpread(page, true);
      await page.getByRole("button", { name: "从左到右", exact: true }).click();
    }
  }
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "跳转页码" })).toHaveValue(
    "3",
  );
  await expect(page.locator(".reader-page")).toHaveCount(1);
});
test("real EPUB is sandboxed, shows embedded images and follows chapter links", async ({
  page,
}) => {
  const trackers: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("tracker.invalid")) trackers.push(request.url());
  });
  await page.goto("/");
  await importBook(page, "sample.epub", await createEpub({ malicious: true }));
  await page
    .getByRole("button", { name: "阅读 测试 EPUB 漫游", exact: true })
    .click();
  const frame = page.frameLocator(".reader-page iframe");
  await expect(
    frame.getByRole("heading", { name: "第一章 山间来信" }),
  ).toBeVisible();
  await expect(frame.locator("img").first()).toBeVisible();
  expect(
    await frame
      .locator("img")
      .first()
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBe(100);
  expect(
    await page.evaluate(() => (window as any).__bookScriptRan),
  ).toBeUndefined();
  expect(
    await page.evaluate(() => (window as any).__bookEventRan),
  ).toBeUndefined();
  expect(trackers).toEqual([]);
  await frame.getByRole("link", { name: "前往下一章" }).click();
  await expect(
    page
      .frameLocator(".reader-page iframe")
      .getByRole("heading", { name: "第二章 海边重逢" }),
  ).toBeVisible();
});
test("MOBI, FB2 and GB18030 TXT really open; encrypted files report errors", async ({
  page,
}) => {
  await page.goto("/");
  await importBook(page, "book.mobi", createMobi());
  await page
    .getByRole("button", { name: "阅读 MOBI Test Book", exact: true })
    .click();
  await expect(
    page
      .frameLocator(".reader-page iframe")
      .getByRole("heading", { name: "MOBI FIRST CHAPTER" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(
    page
      .frameLocator(".reader-page iframe")
      .getByRole("heading", { name: "MOBI SECOND CHAPTER" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "返回书架", exact: true }).click();
  await importBook(page, "book.fb2", Buffer.from(fb2Fixture));
  await page
    .getByRole("button", { name: "阅读 测试 FB2", exact: true })
    .click();
  await expect(
    page.frameLocator(".reader-page iframe").locator("body"),
  ).toContainText("真实的 FB2");
  await page.getByRole("button", { name: "返回书架", exact: true }).click();
  await importBook(page, "GB文本.txt", Buffer.from([0xd6, 0xd0, 0xce, 0xc4]));
  await page.getByRole("button", { name: "阅读 GB文本", exact: true }).click();
  await expect(
    page.frameLocator(".reader-page iframe").locator("body"),
  ).toContainText("中文");
  await page.getByRole("button", { name: "返回书架", exact: true }).click();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "protected.epub",
      mimeType: "application/epub+zip",
      buffer: await createEpub({ encrypted: true }),
    });
  await expect(page.locator(".import-results")).toContainText("DRM");
});
test("mobile layout fits the screen and menu is usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".book-card")).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.getByRole("button", { name: "打开菜单", exact: true }).click();
  await page.getByRole("button", { name: "阅读设置", exact: true }).click();
  await expect(page.getByRole("heading", { name: "阅读设置." })).toBeVisible();
  await expect(page.locator(".sidebar")).not.toHaveClass(/sidebar-open/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});

test("continuous reading, RTL keys and local text conversion work", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "阅读 山海之间", exact: true })
    .click();
  await page.getByRole("button", { name: "阅读设置", exact: true }).click();
  await page.getByRole("button", { name: "从右到左", exact: true }).click();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("spinbutton", { name: "跳转页码" })).toHaveValue(
    "2",
  );
  await page.getByRole("button", { name: "连续", exact: true }).click();
  await expect(page.locator(".reader-page")).toHaveCount(8);
  await page.getByRole("spinbutton", { name: "跳转页码" }).fill("5");
  await expect(page.getByRole("spinbutton", { name: "跳转页码" })).toHaveValue(
    "5",
  );
  await page.getByRole("button", { name: "返回书架", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "阅读 山海之间", exact: true })
    .click();
  await expect(page.getByRole("spinbutton", { name: "跳转页码" })).toHaveValue(
    "5",
  );
  await page.getByRole("button", { name: "返回书架", exact: true }).click();
  await importBook(
    page,
    "待转换.txt",
    Buffer.from(
      "第一章 你好\n这一段正文需要转换成 EPUB。\n第二章 世界\n阅读继续。",
    ),
  );
  await page.getByRole("button", { name: /格式转换/ }).click();
  await page
    .getByLabel("选择书架中的文字书籍")
    .selectOption({ label: "待转换" });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "转换并保存", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("待转换.epub");
  const path = await file.path();
  await page.getByRole("button", { name: "关闭弹窗", exact: true }).click();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "converted.epub",
      mimeType: "application/epub+zip",
      buffer: await (await import("node:fs/promises")).readFile(path!),
    });
  await expect(page.locator(".import-results")).toContainText("已加入书架");
});

test("WASM archive engine reads real CBT/TAR comics", async ({ page }) => {
  const { createPng } = await import("../fixtures.mjs");
  const { pack } = await import("tar-stream");
  const archive = pack();
  const chunks: Buffer[] = [];
  archive.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) =>
    archive.on("end", () => resolve(Buffer.concat(chunks))),
  );
  archive.entry({ name: "漫画/page2.png" }, createPng([80, 160, 100]));
  archive.entry({ name: "漫画/page1.png" }, createPng([160, 80, 100]));
  archive.finalize();
  await page.goto("/");
  await importBook(page, "归档漫画.cbt", await done);
  await page
    .getByRole("button", { name: "阅读 归档漫画", exact: true })
    .click();
  await expect(page.locator(".reader-page > img")).toBeVisible();
  expect(
    await page
      .locator(".reader-page > img")
      .evaluate((el: HTMLImageElement) => el.naturalWidth),
  ).toBe(100);
  await page.getByRole("button", { name: "打开阅读导航", exact: true }).click();
  await expect(page.locator(".chapter-list>button").first()).toContainText(
    "page1.png",
  );
});

test("image batches become one comic and long text restores scroll position", async ({
  page,
}) => {
  const { createPng } = await import("../fixtures.mjs");
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles([
      {
        name: "page2.png",
        mimeType: "image/png",
        buffer: createPng([100, 160, 80]),
      },
      {
        name: "page1.png",
        mimeType: "image/png",
        buffer: createPng([160, 100, 80]),
      },
    ]);
  await expect(page.locator(".import-results")).toContainText("已加入书架");
  await page.getByRole("button", { name: "关闭弹窗", exact: true }).click();
  await page
    .getByRole("button", { name: "阅读 图片合集", exact: true })
    .click();
  await expect(page.locator(".page-navigation")).toContainText("/ 2 页");
  await page.getByRole("button", { name: "返回书架", exact: true }).click();
  await importBook(
    page,
    "长文.txt",
    Buffer.from(
      "正文\n" + "这是一段用来验证长章节滚动恢复的阅读内容。\n".repeat(150),
    ),
  );
  await page.getByRole("button", { name: "阅读 长文", exact: true }).click();
  await expect(page.frameLocator("iframe").locator("body")).toContainText(
    "滚动恢复",
  );
  await expect
    .poll(() =>
      page
        .locator("iframe")
        .evaluate((el: HTMLIFrameElement) => el.clientHeight),
    )
    .toBeGreaterThan(2000);
  await page.locator(".reading-stage").evaluate((el) => {
    el.scrollTop = 1200;
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const req = indexedDB.open("yuejing-library");
        const db = await new Promise<IDBDatabase>((resolve) => {
          req.onsuccess = () => resolve(req.result);
        });
        const all = db.transaction("books").objectStore("books").getAll();
        const books = await new Promise<any[]>((resolve) => {
          all.onsuccess = () => resolve(all.result);
        });
        return books.find((b) => b.title === "长文")?.offset || 0;
      }),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "返回书架", exact: true }).click();
  await page.getByRole("button", { name: "阅读 长文", exact: true }).click();
  await expect
    .poll(() => page.locator(".reading-stage").evaluate((el) => el.scrollTop))
    .toBeGreaterThan(900);
});
