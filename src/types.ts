export type Category = "comic" | "ebook" | "document";
export interface Book {
  id: string;
  title: string;
  author: string;
  format: string;
  category: Category;
  cover?: string;
  coverBlob?: Blob;
  file?: Blob;
  fileName?: string;
  size: number;
  addedAt: number;
  lastRead?: number;
  page: number;
  total: number;
  favorite: boolean;
  demo?: number;
  collection?: string;
  bookmarks?: number[];
  notes?: { id: string; page: number; text: string; createdAt: number }[];
  completed?: boolean;
  offset?: number;
  readingSeconds?: number;
}
export interface ReaderSettings {
  mode: "single" | "double" | "scroll";
  theme: "paper" | "light" | "dark";
  direction: "ltr" | "rtl";
  fit: "width" | "page";
  zoom: number;
  fontSize: number;
  brightness: number;
}
export const defaultSettings: ReaderSettings = {
  mode: "single",
  theme: "paper",
  direction: "ltr",
  fit: "page",
  zoom: 100,
  fontSize: 19,
  brightness: 100,
};
export interface Chapter {
  label: string;
  index: number;
}
export type PageContent =
  | { kind: "image"; src: string; release?: () => void }
  | { kind: "html"; html: string };
export interface ReadableBook {
  title?: string;
  author?: string;
  length: number;
  chapters: Chapter[];
  cover?: Blob;
  getPage: (index: number) => Promise<PageContent>;
  destroy: () => void | Promise<void>;
  unit?: string;
}
