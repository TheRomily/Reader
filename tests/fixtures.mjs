import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { deflateSync } from "node:zlib";

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, checksum]);
}
export function createPng(color = [96, 138, 109]) {
  const width = 100;
  const height = 150;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      color.forEach((c, i) => {
        raw[y * (width * 3 + 1) + 1 + x * 3 + i] = c;
      });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
export async function createEpub({
  encrypted = false,
  malicious = false,
} = {}) {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>',
  );
  zip.file(
    "OPS/book.opf",
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>测试 EPUB 漫游</dc:title><dc:creator>测试作者</dc:creator></metadata><manifest><item id="a" href="chapter1.xhtml" media-type="application/xhtml+xml"/><item id="b" href="chapter2.xhtml" media-type="application/xhtml+xml"/><item id="image" href="images/page.png" media-type="image/png"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>',
  );
  zip.file(
    "OPS/chapter1.xhtml",
    `<html><body><h1>第一章 山间来信</h1><p>这是 EPUB 文件里的真实正文。</p><img src="images/page.png"/><a href="chapter2.xhtml">前往下一章</a>${malicious ? '<script>parent.window.__bookScriptRan=true</script><img src="https://tracker.invalid/pixel.png" onerror="parent.window.__bookEventRan=true"><form action="https://tracker.invalid/"><input/></form>' : ""}</body></html>`,
  );
  zip.file(
    "OPS/chapter2.xhtml",
    "<html><body><h1>第二章 海边重逢</h1><p>第二章已成功读取。</p></body></html>",
  );
  zip.file(
    "OPS/nav.xhtml",
    '<html><body><nav><ol><li><a href="chapter1.xhtml">山间来信</a></li><li><a href="chapter2.xhtml">海边重逢</a></li></ol></nav></body></html>',
  );
  zip.file("OPS/images/page.png", createPng());
  if (encrypted)
    zip.file(
      "META-INF/encryption.xml",
      '<encryption><EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes256-cbc"/></encryption>',
    );
  return zip.generateAsync({ type: "nodebuffer" });
}
export async function createCbz() {
  const zip = new JSZip();
  zip.file("page10.png", createPng([30, 70, 200]));
  zip.file("page2.png", createPng([70, 200, 30]));
  zip.file("page1.png", createPng([200, 30, 70]));
  zip.file("notes.txt", "Ignore this non-image file.");
  return zip.generateAsync({ type: "nodebuffer" });
}
export async function createPdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 2; i++) {
    const page = pdf.addPage([400, 600]);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: 400,
      height: 600,
      color: i ? rgb(0.7, 0.8, 0.9) : rgb(0.8, 0.9, 0.7),
    });
    page.drawText(`Reader PDF page ${i + 1}`, {
      x: 40,
      y: 480,
      size: 25,
      font,
    });
  }
  return Buffer.from(await pdf.save());
}
export function createMobi({ encrypted = false } = {}) {
  const text = Buffer.from(
    "<html><head></head><body><h1>MOBI FIRST CHAPTER</h1><p>A real PalmDOC MOBI book.</p><mbp:pagebreak/><h1>MOBI SECOND CHAPTER</h1><p>The next chapter works.</p></body></html>",
  );
  const title = Buffer.from("MOBI Test Book");
  const record = Buffer.alloc(300 + title.length);
  record.writeUInt16BE(1, 0);
  record.writeUInt32BE(text.length, 4);
  record.writeUInt16BE(1, 8);
  record.writeUInt16BE(4096, 10);
  record.writeUInt16BE(encrypted ? 2 : 0, 12);
  record.write("MOBI", 16);
  record.writeUInt32BE(232, 20);
  record.writeUInt32BE(2, 24);
  record.writeUInt32BE(65001, 28);
  record.writeUInt32BE(42, 32);
  record.writeUInt32BE(6, 36);
  record.writeUInt32BE(300, 84);
  record.writeUInt32BE(title.length, 88);
  record[95] = 9;
  record.writeUInt32BE(2, 108);
  record.writeUInt32BE(64, 128);
  record.writeUInt32BE(0xffffffff, 244);
  record.write("EXTH", 248);
  record.writeUInt32BE(12, 252);
  record.writeUInt32BE(0, 256);
  title.copy(record, 300);
  const header = Buffer.alloc(96);
  header.write("MobiFixture");
  header.write("BOOK", 60);
  header.write("MOBI", 64);
  header.writeUInt16BE(2, 76);
  header.writeUInt32BE(96, 78);
  header.writeUInt32BE(96 + record.length, 86);
  return Buffer.concat([header, record, text]);
}
export const fb2Fixture =
  '<?xml version="1.0" encoding="utf-8"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>测试 FB2</book-title><author><first-name>阅读者</first-name></author></title-info></description><body><section><title><p>FB2 第一章</p></title><p>真实的 FB2 章节内容。</p></section><section><title><p>FB2 第二章</p></title><p>第二个章节。</p></section></body></FictionBook>';
