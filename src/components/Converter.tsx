import { useEffect, useState } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  Download,
  FileInput,
  LoaderCircle,
  Monitor,
  X,
} from "lucide-react";
import JSZip from "jszip";
import type { Book } from "../types";
import { escapeHtml, openDocument } from "../lib/formats";
import { Modal } from "./UI";

export default function Converter({
  books,
  onClose,
}: {
  books: Book[];
  onClose: () => void;
}) {
  const desktop = window.readerDesktop;
  const [bookId, setBookId] = useState(
    books.find(
      (b) =>
        b.demo === undefined && b.category !== "comic" && b.format !== "PDF",
    )?.id || "",
  );
  const [format, setFormat] = useState("epub");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [source, setSource] = useState<{ token: string; name: string }>();
  const [calibre, setCalibre] = useState(false);
  useEffect(() => {
    void desktop
      ?.calibreStatus()
      .then((result) => setCalibre(result.available));
  }, [desktop]);
  async function convert() {
    setBusy(true);
    setMessage("");
    setSuccess(false);
    try {
      if (desktop) {
        if (!source) throw new Error("请先选择需要转换的文件。");
        const result = await desktop.convert({ token: source.token, format });
        if (result.cancelled) return;
        if (!result.ok) throw new Error(result.error || "转换失败");
        setMessage("转换完成，文件已保存到你选择的位置。");
        setSuccess(true);
      } else {
        const book = books.find((b) => b.id === bookId);
        if (!book) throw new Error("请先导入并选择一本文字书籍。");
        const doc = await openDocument(book);
        try {
          const chapters: { title: string; text: string }[] = [];
          for (let i = 0; i < doc.length; i++) {
            const content = await doc.getPage(i);
            if (content.kind !== "html") {
              content.release?.();
              throw new Error(
                "图像/PDF 转换请在桌面版中使用 Calibre。浏览器支持文字书籍转换。",
              );
            }
            const parsed = new DOMParser().parseFromString(
              content.html,
              "text/html",
            );
            parsed
              .querySelectorAll("p,h1,h2,h3,div,br")
              .forEach((el) => el.append("\n"));
            chapters.push({
              title:
                doc.chapters.find((c) => c.index === i)?.label ||
                `第 ${i + 1} 章`,
              text: parsed.body.textContent || "",
            });
          }
          let blob: Blob;
          if (format === "txt")
            blob = new Blob(
              [
                "\uFEFF" +
                  book.title +
                  "\n" +
                  book.author +
                  "\n\n" +
                  chapters.map((c) => c.text).join("\n\n"),
              ],
              { type: "text/plain;charset=utf-8" },
            );
          else {
            const zip = new JSZip();
            const id = crypto.randomUUID();
            zip.file("mimetype", "application/epub+zip", {
              compression: "STORE",
            });
            zip.file(
              "META-INF/container.xml",
              '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
            );
            zip.file(
              "OEBPS/content.opf",
              `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:uuid:${id}</dc:identifier><dc:title>${escapeHtml(book.title)}</dc:title><dc:creator>${escapeHtml(book.author)}</dc:creator><dc:language>zh-CN</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${chapters.map((_, i) => `<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`).join("")}</manifest><spine>${chapters.map((_, i) => `<itemref idref="c${i}"/>`).join("")}</spine></package>`,
            );
            zip.file(
              "OEBPS/nav.xhtml",
              `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>目录</title></head><body><nav epub:type="toc"><ol>${chapters.map((c, i) => `<li><a href="c${i}.xhtml">${escapeHtml(c.title)}</a></li>`).join("")}</ol></nav></body></html>`,
            );
            chapters.forEach((c, i) =>
              zip.file(
                `OEBPS/c${i}.xhtml`,
                `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeHtml(c.title)}</title></head><body><h1>${escapeHtml(c.title)}</h1>${c.text
                  .split("\n")
                  .filter(Boolean)
                  .map((p) => `<p>${escapeHtml(p)}</p>`)
                  .join("")}</body></html>`,
              ),
            );
            blob = await zip.generateAsync({
              type: "blob",
              compression: "DEFLATE",
            });
          }
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `${book.title}.${format}`;
          anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          setSuccess(true);
          setMessage(
            "已生成文件并开始下载。文字转换保留正文与章节，不保留插图和原书排版。",
          );
        } finally {
          await doc.destroy();
        }
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "转换失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="让好书，自由流动"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="converter-intro">
        <span className="feature-icon">
          <ArrowRightLeft size={24} />
        </span>
        <p>在不同格式之间，找到适合你的阅读方式。</p>
      </div>
      {desktop ? (
        <>
          <button
            className="file-pick"
            disabled={busy}
            onClick={async () => {
              const picked = await desktop.pickConversionSource();
              if (picked) setSource(picked);
            }}
          >
            <FileInput size={22} />
            <span>{source?.name || "选择本地书籍文件"}</span>
            <span>选择文件</span>
          </button>
          <div className={`calibre-status ${calibre ? "connected" : ""}`}>
            <Monitor size={16} />
            <span>
              {calibre
                ? "已连接本机 Calibre 转换引擎"
                : "需要安装 Calibre，或选择 ebook-convert 程序"}
            </span>
            {!calibre && (
              <button
                className="text-btn"
                onClick={async () => {
                  const result = await desktop.chooseCalibre();
                  setCalibre(result.available);
                }}
              >
                选择程序
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <label className="form-field">
            选择书架中的文字书籍
            <select
              value={bookId}
              disabled={busy}
              onChange={(e) => setBookId(e.target.value)}
            >
              <option value="">请选择一本书</option>
              {books
                .filter(
                  (b) =>
                    b.demo === undefined &&
                    b.category !== "comic" &&
                    b.format !== "PDF",
                )
                .map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title}
                  </option>
                ))}
            </select>
          </label>
          <p className="subtle-text">
            浏览器版支持文字书籍导出为 EPUB / TXT；Mac 和 Windows 桌面版接入
            Calibre，支持更多格式。
          </p>
        </>
      )}
      <label className="form-field">
        转换为
        <select
          value={format}
          disabled={busy}
          onChange={(e) => setFormat(e.target.value)}
        >
          {(desktop
            ? ["epub", "pdf", "mobi", "azw3", "txt"]
            : ["epub", "txt"]
          ).map((f) => (
            <option key={f} value={f}>
              {f.toUpperCase()}
            </option>
          ))}
        </select>
      </label>
      {message && (
        <div className={`conversion-result ${success ? "success" : "error"}`}>
          {success ? <CheckCircle2 size={18} /> : <X size={18} />}
          <span>{message}</span>
        </div>
      )}
      <button
        className="primary-btn full-width"
        disabled={busy || (desktop ? !source || !calibre : !bookId)}
        onClick={() => void convert()}
      >
        {busy ? (
          <LoaderCircle className="spin" size={17} />
        ) : (
          <Download size={17} />
        )}
        {busy ? "正在转换，请稍候…" : "转换并保存"}
      </button>
      {busy && desktop && (
        <button
          className="text-btn full-width"
          onClick={() => void desktop.cancelConversion()}
        >
          取消转换
        </button>
      )}
      <p className="privacy-line">
        文件仅在本机处理 · 不上传 · 不移除 DRM 保护
      </p>
    </Modal>
  );
}
