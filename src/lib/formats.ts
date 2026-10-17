import DOMPurify from "dompurify";
import JSZip from "jszip";
import type { Book, Category, ReadableBook, PageContent } from "../types";
import { createDemo } from "./demo";

export const imagePattern = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
export const supportedExtensions = [
  "pdf",
  "epub",
  "mobi",
  "azw",
  "azw3",
  "fb2",
  "txt",
  "md",
  "html",
  "htm",
  "cbz",
  "zip",
  "cbr",
  "rar",
  "cb7",
  "7z",
  "cbt",
  "tar",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "bmp",
];
export const acceptFiles = supportedExtensions
  .map((ext) => `.${ext}`)
  .join(",");
export const MAX_FILE_SIZE = 300 * 1024 * 1024;
const MAX_PAGES = 10000;

function validateArchiveSizes(zip: JSZip) {
  let total = 0;
  const entries = Object.values(zip.files);
  if (entries.length > 20000)
    throw new Error("压缩包内的文件过多，请拆分后导入。");
  for (const entry of entries) {
    // JSZip retains the ZIP directory's declared uncompressed size here.
    const size =
      (entry as unknown as { _data?: { uncompressedSize?: number } })._data
        ?.uncompressedSize || 0;
    if (size > 64 * 1024 * 1024)
      throw new Error("压缩包中单个资源超过 64 MB，请拆分后导入。");
    total += size;
    if (total > 1024 * 1024 * 1024)
      throw new Error("压缩包展开后超过 1 GB，请拆分后导入。");
  }
}

export async function bundleImages(files: File[]): Promise<File> {
  if (
    files.length > MAX_PAGES ||
    files.reduce((sum, file) => sum + file.size, 0) >
      MAX_FILE_SIZE - 1024 * 1024
  )
    throw new Error("图片合集最多支持 10,000 页、总计 299 MB，请分批导入。");
  const sorted = [...files].sort((a, b) =>
    naturalSort(a.webkitRelativePath || a.name, b.webkitRelativePath || b.name),
  );
  const root = sorted[0].webkitRelativePath?.split("/")[0];
  const title = root || "图片合集";
  const zip = new JSZip();
  for (const [index, file] of sorted.entries())
    zip.file(
      `${String(index + 1).padStart(5, "0")}-${file.name}`,
      await file.arrayBuffer(),
    );
  return new File(
    [await zip.generateAsync({ type: "blob", compression: "STORE" })],
    `${title}.cbz`,
    { type: "application/zip" },
  );
}
export function extension(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}
export function categoryOf(ext: string): Category {
  if (
    [
      "cbz",
      "zip",
      "cbr",
      "rar",
      "cb7",
      "7z",
      "cbt",
      "tar",
      "jpg",
      "jpeg",
      "png",
      "webp",
      "gif",
      "avif",
      "bmp",
    ].includes(ext)
  )
    return "comic";
  if (["pdf", "html", "htm", "txt", "md"].includes(ext)) return "document";
  return "ebook";
}
export function naturalSort(a: string, b: string) {
  return a.localeCompare(b, "zh-CN", { numeric: true, sensitivity: "base" });
}
export function escapeHtml(text: string) {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function sanitizeHtml(html: string) {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true },
    FORBID_TAGS: [
      "script",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "button",
      "base",
      "link",
      "meta",
      "foreignObject",
      "style",
    ],
    FORBID_ATTR: ["srcset", "action", "formaction", "autofocus", "style"],
    ADD_DATA_URI_TAGS: ["image"],
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|data|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
}
function htmlBook(html: string, title?: string): ReadableBook {
  return {
    length: 1,
    title,
    unit: "节",
    chapters: [{ label: title || "正文", index: 0 }],
    getPage: async () => ({ kind: "html", html: sanitizeHtml(html) }),
    destroy() {},
  };
}
function textBook(text: string, title: string): ReadableBook {
  const sections: { label: string; text: string }[] = [];
  // Keep paragraphs whole when possible; cap chapter length for long unbroken text.
  let chunk = "";
  let label = "正文";
  for (const paragraph of text.split(/\r?\n/)) {
    if (
      (/^\s*(第[零〇一二三四五六七八九十百千万\d]+[章节回卷部](?:\s|[：:、]|$)|#{1,3}\s)/.test(
        paragraph,
      ) &&
        chunk.trim()) ||
      chunk.length + paragraph.length > 9000
    ) {
      sections.push({ label, text: chunk });
      chunk = "";
      label = paragraph.trim().slice(0, 60) || `第 ${sections.length + 1} 节`;
    }
    if (!chunk && /^\s*(第|#)/.test(paragraph))
      label = paragraph.trim().slice(0, 60);
    if (paragraph.length > 15000) {
      if (chunk.trim()) sections.push({ label, text: chunk });
      for (let i = 0; i < paragraph.length; i += 9000)
        sections.push({
          label: `第 ${sections.length + 1} 节`,
          text: paragraph.slice(i, i + 9000),
        });
      chunk = "";
    } else chunk += paragraph + "\n";
  }
  if (chunk.trim()) sections.push({ label, text: chunk });
  if (!sections.length) throw new Error("这份文件没有可阅读的文字。");
  if (sections.length > MAX_PAGES)
    throw new Error("文件章节过多，请拆分后再导入。");
  return {
    title,
    length: sections.length,
    unit: "节",
    chapters: sections.map((s, index) => ({ label: s.label, index })),
    getPage: async (index) => ({
      kind: "html",
      html: `<article><h1>${escapeHtml(sections[index].label)}</h1>${sections[
        index
      ].text
        .split("\n")
        .filter(Boolean)
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join("")}</article>`,
    }),
    destroy() {},
  };
}
function resolvePath(base: string, relative: string) {
  try {
    return decodeURIComponent(
      new URL(relative, `https://book.local/${base}`).pathname.slice(1),
    );
  } catch {
    return "";
  }
}
async function epubBook(file: Blob): Promise<ReadableBook> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  validateArchiveSizes(zip);
  if (zip.file("META-INF/encryption.xml")) {
    const encryption = await zip.file("META-INF/encryption.xml")!.async("text");
    if (/adobe\.com\/adept|xmlenc#|aes\d|aes-/i.test(encryption))
      throw new Error(
        "这本 EPUB 受 DRM 加密保护，无法直接阅读。请导入合法取得的无 DRM 版本。",
      );
  }
  const parse = (xml: string) =>
    new DOMParser().parseFromString(xml, "application/xml");
  const container = zip.file("META-INF/container.xml");
  if (!container) throw new Error("EPUB 缺少 container.xml，文件可能已损坏。");
  const opfPath = parse(await container.async("text"))
    .getElementsByTagName("rootfile")[0]
    ?.getAttribute("full-path");
  const opfFile = opfPath && zip.file(opfPath);
  if (!opfFile || !opfPath) throw new Error("找不到 EPUB 的书籍内容清单。");
  const opf = parse(await opfFile.async("text"));
  const items = Array.from(opf.getElementsByTagName("item"));
  const manifest = new Map(
    items.map((item) => [
      item.getAttribute("id"),
      {
        path: resolvePath(opfPath, item.getAttribute("href") || ""),
        type: item.getAttribute("media-type") || "",
      },
    ]),
  );
  const spine = Array.from(opf.getElementsByTagName("itemref"))
    .filter((item) => item.getAttribute("linear") !== "no")
    .map((item) => manifest.get(item.getAttribute("idref")))
    .filter(
      (item): item is { path: string; type: string } =>
        !!item && !!zip.file(item.path),
    );
  if (!spine.length || spine.length > MAX_PAGES)
    throw new Error("EPUB 没有有效章节，或章节数量超出限制。");
  const title =
    opf.getElementsByTagNameNS("*", "title")[0]?.textContent || undefined;
  const author = Array.from(opf.getElementsByTagNameNS("*", "creator"))
    .map((el) => el.textContent)
    .join("、");
  const urls = new Map<string, string>();
  const resource = async (path: string) => {
    if (urls.has(path)) return urls.get(path)!;
    const entry = zip.file(path);
    if (!entry) return "";
    const raw = await entry.async("uint8array");
    if (raw.byteLength > 64 * 1024 * 1024)
      throw new Error("书籍中的单个资源过大。");
    const type =
      [...manifest.values()].find((v) => v.path === path)?.type ||
      "application/octet-stream";
    const url = URL.createObjectURL(new Blob([new Uint8Array(raw)], { type }));
    urls.set(path, url);
    return url;
  };
  const nav = items.find((el) =>
    el.getAttribute("properties")?.split(" ").includes("nav"),
  );
  let chapters = spine.map((_, index) => ({
    index,
    label: `第 ${index + 1} 章`,
  }));
  if (nav) {
    const path = resolvePath(opfPath, nav.getAttribute("href") || "");
    const navFile = zip.file(path);
    if (navFile) {
      const navDoc = new DOMParser().parseFromString(
        await navFile.async("text"),
        "text/html",
      );
      const links = Array.from(
        (navDoc.querySelector("nav") || navDoc).querySelectorAll("a[href]"),
      );
      const toc = links
        .map((a) => ({
          label: a.textContent?.trim() || "章节",
          index: spine.findIndex(
            (item) =>
              item.path ===
              resolvePath(
                path,
                a.getAttribute("href")!.split("#")[0] || path.split("/").pop()!,
              ),
          ),
        }))
        .filter((item) => item.index >= 0);
      if (toc.length) chapters = toc;
    }
  }
  let cover: Blob | undefined;
  const coverId = Array.from(opf.getElementsByTagName("meta"))
    .find((el) => el.getAttribute("name") === "cover")
    ?.getAttribute("content");
  const coverItem = items.find(
    (el) =>
      el.getAttribute("properties")?.includes("cover-image") ||
      (coverId && el.getAttribute("id") === coverId),
  );
  if (coverItem) {
    const item = manifest.get(coverItem.getAttribute("id"));
    if (item && zip.file(item.path))
      cover = new Blob([await zip.file(item.path)!.async("arraybuffer")], {
        type: item.type,
      });
  }
  return {
    title,
    author,
    length: spine.length,
    chapters,
    cover,
    unit: "章",
    getPage: async (index) => {
      const path = spine[index].path;
      const doc = new DOMParser().parseFromString(
        sanitizeHtml(await zip.file(path)!.async("text")),
        "text/html",
      );
      await Promise.all(
        Array.from(doc.querySelectorAll("img, image")).map(async (el) => {
          const attr =
            el.tagName.toLowerCase() === "image"
              ? el.hasAttribute("href")
                ? "href"
                : "xlink:href"
              : "src";
          const src = el.getAttribute(attr) || "";
          if (src.startsWith("data:image/")) return;
          if (/^[a-z]+:/i.test(src) || src.startsWith("//")) {
            el.removeAttribute(attr);
            return;
          }
          el.setAttribute(attr, await resource(resolvePath(path, src)));
        }),
      );
      for (const anchor of doc.querySelectorAll("a")) {
        const href = anchor.getAttribute("href") || "";
        const target = spine.findIndex(
          (item) =>
            item.path ===
            resolvePath(path, href.split("#")[0] || path.split("/").pop()!),
        );
        if (target >= 0) anchor.setAttribute("data-page", String(target));
        anchor.setAttribute("href", "#");
      }
      return { kind: "html", html: doc.body.innerHTML };
    },
    destroy: () => urls.forEach((url) => URL.revokeObjectURL(url)),
  };
}
async function pdfBook(file: Blob): Promise<ReadableBook> {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } =
    await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
  const loading = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: `${base}pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}pdfjs/standard_fonts/`,
    wasmUrl: `${base}pdfjs/wasm/`,
  });
  const pdf = await loading.promise.catch((error) => {
    if (error.name === "PasswordException")
      throw new Error("这份 PDF 有密码保护，请先解锁后再导入。");
    throw error;
  });
  const urls = new Set<string>();
  return {
    length: pdf.numPages,
    chapters: [],
    unit: "页",
    getPage: async (index) => {
      const page = await pdf.getPage(index + 1);
      const viewport = page.getViewport({
        scale: Math.min(2, 1600 / page.getViewport({ scale: 1 }).width),
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport, background: "#ffffff" }).promise;
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value ? resolve(value) : reject(new Error("PDF 页面渲染失败")),
          "image/webp",
          0.92,
        ),
      );
      canvas.width = 0;
      canvas.height = 0;
      const src = URL.createObjectURL(blob);
      urls.add(src);
      return {
        kind: "image",
        src,
        release: () => {
          URL.revokeObjectURL(src);
          urls.delete(src);
        },
      };
    },
    destroy: async () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      await loading.destroy();
    },
  };
}
async function archiveBook(file: File, ext: string): Promise<ReadableBook> {
  const urls = new Set<string>();
  let names: string[];
  let read: (name: string) => Promise<Blob>;
  let close: () => void | Promise<void> = () => {};
  if (["zip", "cbz"].includes(ext)) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    validateArchiveSizes(zip);
    names = Object.keys(zip.files).filter(
      (name) =>
        !zip.files[name].dir &&
        imagePattern.test(name) &&
        !name.startsWith("__MACOSX/"),
    );
    read = async (name) => {
      const data = await zip.file(name)!.async("uint8array");
      if (data.byteLength > 64 * 1024 * 1024)
        throw new Error("压缩包中单张图片超过 64 MB，无法打开。");
      return new Blob([new Uint8Array(data)], { type: imageMime(name) });
    };
  } else {
    const { Archive } = await import("libarchive.js");
    Archive.init({
      workerUrl: new URL(
        `${import.meta.env.BASE_URL}libarchive/worker-bundle.js`,
        document.baseURI,
      ).href,
    });
    const archive = await Archive.open(file);
    close = () => archive.close();
    try {
      if (await archive.hasEncryptedData())
        throw new Error("漫画压缩包已加密，请先解压后再导入。");
      const entries = await archive.getFilesArray();
      const files = new Map<string, { extract: () => Promise<File> }>(
        entries.map(
          (entry: {
            path: string;
            file: { name: string; extract: () => Promise<File> };
          }) => [
            entry.path
              ? `${entry.path.replace(/\/$/, "")}/${entry.file.name}`
              : entry.file.name,
            entry.file,
          ],
        ),
      );
      names = [...files.keys()].filter(
        (name) => imagePattern.test(name) && !name.includes("__MACOSX/"),
      );
      read = async (name) => {
        const blob = await files.get(name)!.extract();
        if (blob.size > 64 * 1024 * 1024)
          throw new Error("漫画图片过大，请拆分后再导入。");
        return new Blob([blob], { type: imageMime(name) });
      };
    } catch (error) {
      await close();
      throw error;
    }
  }
  names.sort(naturalSort);
  if (!names.length || names.length > MAX_PAGES) {
    await close();
    throw new Error("压缩包内没有支持的图片，或超过 10,000 页。");
  }
  return {
    length: names.length,
    chapters: names.map((name, index) => ({
      index,
      label: name.split("/").pop()!,
    })),
    unit: "页",
    getPage: async (index) => {
      const src = URL.createObjectURL(await read(names[index]));
      urls.add(src);
      return {
        kind: "image",
        src,
        release: () => {
          URL.revokeObjectURL(src);
          urls.delete(src);
        },
      };
    },
    destroy: async () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      await close();
    },
  };
}
function imageMime(name: string) {
  return (
    (
      {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        gif: "image/gif",
        bmp: "image/bmp",
        avif: "image/avif",
      } as Record<string, string>
    )[extension(name)] || "image/jpeg"
  );
}
async function mobiBook(file: File): Promise<ReadableBook> {
  const [{ MOBI }, { unzlibSync }] = await Promise.all([
    import("foliate-js/mobi.js"),
    import("fflate"),
  ]);
  const bytes = new Uint8Array(await file.slice(0, 86).arrayBuffer());
  if (bytes.length < 86) throw new Error("Kindle 文件不完整。");
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const firstOffset = header.getUint32(78);
  if (firstOffset + 40 > file.size) throw new Error("Kindle 文件头已损坏。");
  const firstRecord = new DataView(
    await file.slice(firstOffset, firstOffset + 40).arrayBuffer(),
  );
  if (firstRecord.getUint16(12) !== 0)
    throw new Error("Kindle 文件受 DRM 加密保护，请使用无 DRM 版本。");
  const parser = await new MOBI({ unzlib: unzlibSync })
    .open(file)
    .catch((error) => {
      throw new Error(
        `无法解析 Kindle 文件，文件可能已损坏。${error instanceof Error ? error.message : ""}`,
      );
    });
  if (!parser.sections.length) {
    parser.destroy();
    throw new Error("Kindle 文件中没有可阅读章节。");
  }
  const chapters: { label: string; index: number }[] = [];
  const flatten = async (items: typeof parser.toc) => {
    for (const item of items || []) {
      try {
        const target = await parser.resolveHref(item.href);
        if (target && target.index >= 0)
          chapters.push({ label: item.label, index: target.index });
      } catch {
        /* Ignore invalid optional TOC entries. */
      }
      await flatten(item.subitems);
    }
  };
  await flatten(parser.toc);
  return {
    title: parser.metadata.title,
    author: parser.metadata.author?.join("、"),
    length: parser.sections.length,
    cover: await parser.getCover(),
    unit: "章",
    chapters: chapters.length
      ? chapters
      : parser.sections.map((_, index) => ({
          label: `第 ${index + 1} 章`,
          index,
        })),
    getPage: async (index) => {
      const html = await fetch(await parser.sections[index].load()).then(
        (response) => response.text(),
      );
      const doc = new DOMParser().parseFromString(html, "text/html");
      for (const anchor of doc.querySelectorAll("a[href]")) {
        try {
          const target = await parser.resolveHref(anchor.getAttribute("href")!);
          if (target && target.index >= 0)
            anchor.setAttribute("data-page", String(target.index));
        } catch {
          /* Unsupported/external links stay inside the reading sandbox. */
        }
        anchor.setAttribute("href", "#");
      }
      return { kind: "html", html: sanitizeHtml(doc.body.innerHTML) };
    },
    destroy: () => parser.destroy(),
  };
}
async function fb2Book(file: Blob): Promise<ReadableBook> {
  const doc = new DOMParser().parseFromString(
    await file.text(),
    "application/xml",
  );
  if (doc.querySelector("parsererror"))
    throw new Error("FB2 文件不是有效的 XML 文档。");
  const binaries = new Map<string, string>();
  doc
    .querySelectorAll("binary[id]")
    .forEach((el) =>
      binaries.set(
        el.id,
        `data:${el.getAttribute("content-type") || "image/jpeg"};base64,${el.textContent?.replace(/\s/g, "") || ""}`,
      ),
    );
  const sections = Array.from(doc.getElementsByTagName("body"))
    .filter((el) => !el.hasAttribute("name"))
    .flatMap((el) =>
      Array.from(el.children).filter((child) => child.localName === "section"),
    );
  const html = sections.map((el) => {
    const part = el.cloneNode(true) as Element;
    part.querySelectorAll("image").forEach((image) => {
      const img = doc.createElement("img");
      const id =
        image.getAttributeNS("http://www.w3.org/1999/xlink", "href") ||
        image.getAttribute("href") ||
        "";
      img.setAttribute("src", binaries.get(id.slice(1)) || "");
      image.replaceWith(img);
    });
    return sanitizeHtml(
      part.innerHTML
        .replace(/\s+xmlns(?::[\w-]+)?="[^"]*"/g, "")
        .replace(/<title>/g, "<h1>")
        .replace(/<\/title>/g, "</h1>")
        .replace(/<empty-line\s*\/>/g, "<br/>"),
    );
  });
  if (!html.length) throw new Error("FB2 文件中没有可阅读的章节。");
  const title = doc.querySelector("book-title")?.textContent || undefined;
  const author = Array.from(doc.querySelectorAll("title-info > author"))
    .map((el) => el.textContent?.trim())
    .join("、");
  return {
    title,
    author,
    length: html.length,
    unit: "章",
    chapters: sections.map((el, index) => ({
      label: el.querySelector("title")?.textContent || `第 ${index + 1} 章`,
      index,
    })),
    getPage: async (index) => ({ kind: "html", html: html[index] }),
    destroy() {},
  };
}
export async function openDocument(book: Book): Promise<ReadableBook> {
  if (book.demo !== undefined) return createDemo(book.demo);
  if (!book.file) throw new Error("找不到书籍文件，请重新导入。");
  const file = new File([book.file], book.fileName || book.title, {
    type: book.file.type,
  });
  const ext = extension(file.name);
  if (ext === "pdf") return pdfBook(file);
  if (ext === "epub") return epubBook(file);
  if (["mobi", "azw", "azw3"].includes(ext)) return mobiBook(file);
  if (ext === "fb2") return fb2Book(file);
  if (["cbz", "zip", "cbr", "rar", "cb7", "7z", "cbt", "tar"].includes(ext))
    return archiveBook(file, ext);
  if (imagePattern.test(file.name)) {
    const src = URL.createObjectURL(file);
    return {
      length: 1,
      cover: file,
      chapters: [],
      getPage: async () => ({ kind: "image", src }),
      destroy: () => URL.revokeObjectURL(src),
    };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("gb18030").decode(bytes);
  }
  if (["html", "htm"].includes(ext)) return htmlBook(text, book.title);
  return textBook(text, book.title);
}
export async function prepareBook(file: File): Promise<Book> {
  const ext = extension(file.name);
  if (!supportedExtensions.includes(ext))
    throw new Error(
      `暂不支持 .${ext || "未知"} 文件，请使用 EPUB、PDF 或漫画压缩包。`,
    );
  if (!file.size) throw new Error("这是一个空文件。");
  if (file.size > MAX_FILE_SIZE)
    throw new Error("单个文件最大支持 300 MB，请压缩或拆分后再导入。");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  const id = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const book: Book = {
    id,
    title: file.name.replace(/\.[^.]+$/, ""),
    author: "未知作者",
    file,
    fileName: file.name,
    size: file.size,
    format: ext.toUpperCase(),
    category: categoryOf(ext),
    addedAt: Date.now(),
    page: 0,
    total: 1,
    favorite: false,
  };
  const document = await openDocument(book);
  try {
    book.total = document.length;
    if (document.title) book.title = document.title;
    if (document.author) book.author = document.author;
    if (document.cover) book.coverBlob = document.cover;
    else {
      const first = await document.getPage(0);
      if (first.kind === "image") {
        book.coverBlob = await fetch(first.src).then((res) => res.blob());
        first.release?.();
      }
    }
  } finally {
    await document.destroy();
  }
  return book;
}
export async function plainTextPage(content: PageContent) {
  if (content.kind !== "html") return "";
  return (
    new DOMParser().parseFromString(content.html, "text/html").body
      .textContent || ""
  );
}
