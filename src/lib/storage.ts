import { openDB } from "idb";
import type { Book, ReaderSettings } from "../types";
import { defaultSettings } from "../types";

const database = () =>
  openDB("yuejing-library", 1, {
    upgrade(db) {
      db.createObjectStore("books", { keyPath: "id" });
    },
  });
export async function loadBooks(): Promise<Book[]> {
  const db = await database();
  return db.getAll("books");
}
export async function saveBook(book: Book) {
  const db = await database();
  await db.put("books", book);
}
export async function deleteBook(id: string) {
  const db = await database();
  await db.delete("books", id);
}
export function loadSettings(): ReaderSettings {
  try {
    return {
      ...defaultSettings,
      ...JSON.parse(localStorage.getItem("yuejing-settings") || "{}"),
    };
  } catch {
    return defaultSettings;
  }
}
export function saveSettings(settings: ReaderSettings) {
  localStorage.setItem("yuejing-settings", JSON.stringify(settings));
}
export function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
export function progress(book: Book) {
  return book.completed
    ? 100
    : book.lastRead
      ? Math.round(
          ((book.page + (book.offset || 0)) / Math.max(book.total, 1)) * 100,
        )
      : 0;
}
