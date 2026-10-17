import { beforeAll, describe, expect, it, vi } from "vitest";
import { File, Blob } from "node:buffer";
import { URL as NodeURL } from "node:url";
import {
  openDocument,
  prepareBook,
  sanitizeHtml,
  naturalSort,
  MAX_FILE_SIZE,
} from "../src/lib/formats";
import { createCbz, createEpub, createMobi, fb2Fixture } from "./fixtures.mjs";
import type { Book } from "../src/types";

beforeAll(() => {
  vi.stubGlobal("File", File);
  vi.stubGlobal("Blob", Blob);
  URL.createObjectURL = vi.fn(NodeURL.createObjectURL);
  URL.revokeObjectURL = vi.fn(NodeURL.revokeObjectURL);
});
function book(file: File): Book {
  return {
    id: "test",
    file: file as unknown as globalThis.Blob,
    fileName: file.name,
    title: file.name,
    author: "",
    format: "",
    category: "ebook",
    size: file.size,
    total: 1,
    page: 0,
    addedAt: 0,
    favorite: false,
  };
}
describe("real document parsing", () => {
  it("reads EPUB metadata, ordered spine, local images and chapter links", async () => {
    const doc = await openDocument(
      book(new File([await createEpub()], "a.epub")),
    );
    expect(doc.title).toBe("测试 EPUB 漫游");
    expect(doc.author).toBe("测试作者");
    expect(doc.length).toBe(2);
    expect(doc.chapters.map((c) => c.label)).toEqual(["山间来信", "海边重逢"]);
    const page = await doc.getPage(0);
    expect(page.kind).toBe("html");
    if (page.kind === "html") {
      expect(page.html).toContain("真实正文");
      expect(page.html).toContain("blob:nodedata:");
      expect(page.html).toContain('data-page="1"');
    }
    await doc.destroy();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
  it("rejects DRM protected EPUB before rendering", async () => {
    await expect(
      openDocument(
        book(
          new File([await createEpub({ encrypted: true })], "protected.epub"),
        ),
      ),
    ).rejects.toThrow("DRM");
  });
  it("reads real uncompressed MOBI PalmDOC chapters", async () => {
    const doc = await openDocument(book(new File([createMobi()], "test.mobi")));
    expect(doc.title).toBe("MOBI Test Book");
    expect(doc.length).toBe(2);
    expect(await doc.getPage(1)).toMatchObject({
      kind: "html",
      html: expect.stringContaining("MOBI SECOND CHAPTER"),
    });
    await doc.destroy();
  });
  it("reads older MOBI files with no EXTH metadata", async () => {
    const data = createMobi();
    data.writeUInt32BE(0, 96 + 128);
    const doc = await openDocument(book(new File([data], "old.mobi")));
    expect(await doc.getPage(0)).toMatchObject({
      html: expect.stringContaining("MOBI FIRST CHAPTER"),
    });
    await doc.destroy();
  });
  it("rejects encrypted MOBI before parsing", async () => {
    await expect(
      openDocument(
        book(new File([createMobi({ encrypted: true })], "protected.mobi")),
      ),
    ).rejects.toThrow("DRM");
  });
  it("reads FB2 XML title and chapters", async () => {
    const doc = await openDocument(book(new File([fb2Fixture], "test.fb2")));
    expect(doc.title).toBe("测试 FB2");
    expect(doc.length).toBe(2);
    expect(await doc.getPage(0)).toMatchObject({
      kind: "html",
      html: expect.stringContaining("真实的 FB2"),
    });
  });
  it("splits UTF-8 TXT at Chinese chapter headings without losing text", async () => {
    const doc = await openDocument(
      book(
        new File(
          ["第一章 开始\n首章内容\n第二章 继续\n第二章内容"],
          "story.txt",
        ),
      ),
    );
    expect(doc.length).toBe(2);
    expect(await doc.getPage(1)).toMatchObject({
      html: expect.stringContaining("第二章内容"),
    });
  });
  it("decodes legacy GB encoded Chinese text", async () => {
    const doc = await openDocument(
      book(new File([Buffer.from([0xd6, 0xd0, 0xce, 0xc4])], "gb.txt")),
    );
    expect(await doc.getPage(0)).toMatchObject({
      html: expect.stringContaining("中文"),
    });
  });
  it("sorts comic pages by numeric order and excludes non-images", async () => {
    const doc = await openDocument(
      book(new File([await createCbz()], "comic.cbz")),
    );
    expect(doc.length).toBe(3);
    expect(doc.chapters.map((c) => c.label)).toEqual([
      "page1.png",
      "page2.png",
      "page10.png",
    ]);
    expect(await doc.getPage(0)).toMatchObject({ kind: "image" });
    await doc.destroy();
  });
  it("rejects an empty text file instead of inventing a page", async () => {
    await expect(
      openDocument(book(new File(["   \n"], "empty.txt"))),
    ).rejects.toThrow("没有可阅读");
  });
  it("rejects unsupported, empty and oversized input before parsing", async () => {
    await expect(
      prepareBook(new File(["abc"], "file.exe") as unknown as globalThis.File),
    ).rejects.toThrow("暂不支持");
    await expect(
      prepareBook(new File([], "empty.pdf") as unknown as globalThis.File),
    ).rejects.toThrow("空文件");
    const file = new File(["x"], "big.epub");
    Object.defineProperty(file, "size", { value: MAX_FILE_SIZE + 1 });
    await expect(
      prepareBook(file as unknown as globalThis.File),
    ).rejects.toThrow("300 MB");
  });
});
describe("untrusted ebook content", () => {
  it("removes active content, event handlers, forms and javascript URLs", () => {
    const html = sanitizeHtml(
      '<script>alert(1)</script><iframe src="file:///etc/passwd"></iframe><img src="blob:http://localhost/a" onerror="alert(1)"><a href="javascript:alert(1)">hello</a><form><input></form><svg onload="alert(1)"><foreignObject><iframe/></foreignObject></svg>',
    );
    expect(html).not.toMatch(
      /script|onerror|onload|iframe|foreignObject|input|form|javascript:/i,
    );
    expect(html).toContain("blob:http://localhost/a");
  });
  it("naturally sorts nested numbered filenames", () => {
    expect(["ch/11.jpg", "ch/2.jpg", "ch/1.jpg"].sort(naturalSort)).toEqual([
      "ch/1.jpg",
      "ch/2.jpg",
      "ch/11.jpg",
    ]);
  });
});
