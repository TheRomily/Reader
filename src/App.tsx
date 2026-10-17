import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  ArrowRightLeft,
  BarChart3,
  BookHeart,
  BookMarked,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  CloudOff,
  Ellipsis,
  FileText,
  Folder,
  FolderPlus,
  Heart,
  HelpCircle,
  Image,
  LayoutGrid,
  Leaf,
  Library,
  List,
  LoaderCircle,
  Menu,
  Moon,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { Book as BookType, Category, ReaderSettings } from "./types";
import { demoBooks } from "./lib/demo";
import {
  deleteBook,
  formatSize,
  loadBooks,
  loadSettings,
  progress,
  saveBook,
  saveSettings,
} from "./lib/storage";
import {
  acceptFiles,
  prepareBook,
  supportedExtensions,
  imagePattern,
  bundleImages,
} from "./lib/formats";
import { Cover, FieldRange, Modal } from "./components/UI";
import Reader from "./components/Reader";
import Converter from "./components/Converter";

type View =
  | "library"
  | "recent"
  | "favorites"
  | "notes"
  | "stats"
  | "settings"
  | `group:${string}`;
const categoryNames = { comic: "漫画", ebook: "电子书", document: "文档" };
export default function App() {
  const [books, setBooks] = useState<BookType[]>([]);
  const booksRef = useRef(books);
  booksRef.current = books;
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("library");
  const [category, setCategory] = useState<Category | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("added");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [activeId, setActiveId] = useState<string>();
  const [settings, setSettings] = useState<ReaderSettings>(loadSettings);
  const [modal, setModal] = useState<
    "import" | "help" | "group" | "convert" | null
  >(null);
  const [editBook, setEditBook] = useState<BookType>();
  const [deleteTarget, setDeleteTarget] = useState<BookType>();
  const [groupName, setGroupName] = useState("");
  const [groups, setGroups] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("yuejing-groups") || "[]");
    } catch {
      return [];
    }
  });
  const [toast, setToast] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<
    { name: string; status: string; ok: boolean }[]
  >([]);
  const [importCurrent, setImportCurrent] = useState("");
  const [dragging, setDragging] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const directory = useRef<HTMLInputElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const dragCount = useRef(0);
  const writes = useRef(Promise.resolve());
  const ready = useRef(Promise.resolve());
  const importLock = useRef(false);
  const enqueue = useCallback((operation: () => Promise<unknown>) => {
    writes.current = writes.current
      .then(operation)
      .then(() => {})
      .catch(() =>
        setToast("本地保存失败，可能存储空间已满。请备份文件后释放空间。"),
      );
    return writes.current;
  }, []);
  useEffect(() => {
    let alive = true;
    async function init() {
      try {
        let data = await loadBooks();
        if (!localStorage.getItem("yuejing-initialized")) {
          if (!data.length) {
            for (const book of demoBooks) await saveBook(book);
            data = demoBooks;
          }
          localStorage.setItem("yuejing-initialized", "true");
        }
        if (alive) {
          booksRef.current = data;
          setBooks(data);
        }
      } catch {
        if (alive)
          setToast(
            "无法访问浏览器存储。请允许本地存储，或退出隐私模式后重试。",
          );
      }
      if (alive) setLoading(false);
    }
    ready.current = init();
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 4800);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !activeId &&
        !(e.target as HTMLElement).matches("input,textarea,select")
      ) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [activeId]);
  const updateBook = useCallback(
    (id: string, patch: Partial<BookType>) => {
      const latest = booksRef.current.find((b) => b.id === id);
      if (!latest) return;
      const next = { ...latest, ...patch };
      const all = booksRef.current.map((b) => (b.id === id ? next : b));
      booksRef.current = all;
      setBooks(all);
      void enqueue(() => saveBook(next));
    },
    [enqueue],
  );
  const updateSettings = useCallback((next: ReaderSettings) => {
    setSettings(next);
    try {
      saveSettings(next);
    } catch {
      setToast("阅读设置未能保存，请检查本地存储权限。");
    }
  }, []);
  const openBook = useCallback((book: BookType) => {
    setActiveId(book.id);
    setMobileMenu(false);
  }, []);
  const closeReader = useCallback(() => {
    setActiveId(undefined);
  }, []);
  const changeView = (next: View) => {
    setView(next);
    setQuery("");
    setCategory("all");
    setMobileMenu(false);
  };
  async function importFiles(files: File[]) {
    if (!files.length || importLock.current) return;
    importLock.current = true;
    await ready.current;
    setModal("import");
    setImporting(true);
    setImportResults([]);
    let count = 0;
    const images = files.filter((file) => imagePattern.test(file.name));
    if (images.length > 1) {
      setImportCurrent("正在将图片整理为一本漫画…");
      files = files.filter((file) => !imagePattern.test(file.name));
      try {
        files.unshift(await bundleImages(images));
      } catch (error) {
        setImportResults([
          {
            name: "图片合集",
            ok: false,
            status: error instanceof Error ? error.message : "图片整理失败",
          },
        ]);
      }
    }
    // Import serially to keep large PDF/archive memory use bounded.
    for (const file of files) {
      setImportCurrent(file.name);
      try {
        const book = await prepareBook(file);
        if (booksRef.current.some((b) => b.id === book.id)) {
          setImportResults((results) => [
            ...results,
            { name: file.name, status: "这本书已在书架中", ok: true },
          ]);
          continue;
        }
        if (view.startsWith("group:")) book.collection = view.slice(6);
        await saveBook(book);
        const all = [...booksRef.current, book];
        booksRef.current = all;
        setBooks(all);
        count++;
        setImportResults((results) => [
          ...results,
          { name: file.name, status: "已加入书架", ok: true },
        ]);
      } catch (e) {
        setImportResults((results) => [
          ...results,
          {
            name: file.name,
            status:
              e instanceof Error ? e.message : "导入失败，文件可能已损坏。",
            ok: false,
          },
        ]);
      }
    }
    setImportCurrent("");
    setImporting(false);
    importLock.current = false;
    if (count) setToast(`已将 ${count} 本新书放上书架`);
    if (input.current) input.current.value = "";
    if (directory.current) directory.current.value = "";
  }
  const filtered = useMemo(() => {
    return books
      .filter((book) => {
        if (view === "recent" && !book.lastRead) return false;
        if (view === "favorites" && !book.favorite) return false;
        if (view.startsWith("group:") && book.collection !== view.slice(6))
          return false;
        if (category !== "all" && book.category !== category) return false;
        return `${book.title} ${book.author} ${book.format}`
          .toLowerCase()
          .includes(query.toLowerCase().trim());
      })
      .sort((a, b) =>
        sort === "title"
          ? a.title.localeCompare(b.title, "zh-CN")
          : sort === "progress"
            ? progress(b) - progress(a)
            : view === "recent" || sort === "recent"
              ? (b.lastRead || 0) - (a.lastRead || 0)
              : b.addedAt - a.addedAt,
      );
  }, [books, view, category, query, sort]);
  const recent = [...books]
    .filter((b) => b.lastRead && !b.completed)
    .sort((a, b) => (b.lastRead || 0) - (a.lastRead || 0))[0];
  const recommended = recent || books.find((b) => b.demo === 0) || books[0];
  const realBooks = books.filter((b) => b.demo === undefined);
  const storage = realBooks.reduce((total, b) => total + b.size, 0);
  const favoriteCount = books.filter((b) => b.favorite).length;
  const totalMinutes = Math.floor(
    books.reduce((s, b) => s + (b.readingSeconds || 0), 0) / 60,
  );
  const active = books.find((b) => b.id === activeId);
  const titles: Record<string, string> = {
    library: "我的书架",
    recent: "最近阅读",
    favorites: "我的收藏",
    notes: "阅读笔记",
    stats: "阅读统计",
    settings: "阅读设置",
  };
  const currentTitle = view.startsWith("group:") ? view.slice(6) : titles[view];
  const isLibrary =
    ["library", "recent", "favorites"].includes(view) ||
    view.startsWith("group:");
  const nav = [
    {
      id: "library" as const,
      icon: Library,
      label: "我的书架",
      count: books.length,
    },
    { id: "recent" as const, icon: Clock3, label: "最近阅读" },
    {
      id: "favorites" as const,
      icon: Heart,
      label: "我的收藏",
      count: favoriteCount,
    },
    { id: "notes" as const, icon: StickyNote, label: "阅读笔记" },
  ];
  function dragOver(e: DragEvent) {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }
  return (
    <>
      <input
        className="visually-hidden"
        type="file"
        accept={acceptFiles}
        multiple
        ref={input}
        aria-label="选择阅读文件"
        onChange={(e) => void importFiles(Array.from(e.target.files || []))}
      />
      <input
        className="visually-hidden"
        type="file"
        multiple
        ref={directory}
        aria-label="选择书籍文件夹"
        {...{ webkitdirectory: "" }}
        onChange={(e) =>
          void importFiles(
            Array.from(e.target.files || []).filter((f) =>
              supportedExtensions.includes(
                f.name.split(".").pop()?.toLowerCase() || "",
              ),
            ),
          )
        }
      />
      {active ? (
        <Reader
          key={active.id}
          book={active}
          settings={settings}
          onSettings={updateSettings}
          onUpdate={(patch) => updateBook(active.id, patch)}
          onClose={closeReader}
        />
      ) : (
        <div
          className="app-shell"
          onDragOver={dragOver}
          onDragEnter={(e) => {
            if (e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
              dragCount.current++;
              setDragging(true);
            }
          }}
          onDragLeave={() => {
            dragCount.current--;
            if (dragCount.current <= 0) {
              dragCount.current = 0;
              setDragging(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            dragCount.current = 0;
            setDragging(false);
            void importFiles([...e.dataTransfer.files]);
          }}
        >
          {mobileMenu && (
            <div
              className="sidebar-scrim"
              onClick={() => setMobileMenu(false)}
            />
          )}
          <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
            <a
              className="brand"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                changeView("library");
              }}
            >
              <span className="brand-icon">
                <BookOpen size={25} strokeWidth={1.6} />
              </span>
              <span>
                <strong>阅境</strong>
                <small>READ YOUR WORLD</small>
              </span>
            </a>
            <div className="sidebar-label">我的空间</div>
            <nav className="primary-nav">
              {nav.map(({ id, icon: Icon, label, count }) => (
                <button
                  key={id}
                  className={view === id ? "nav-active" : ""}
                  onClick={() => changeView(id)}
                >
                  <Icon size={19} strokeWidth={1.7} />
                  <span>{label}</span>
                  {count !== undefined && <small>{count}</small>}
                </button>
              ))}
            </nav>
            <div className="sidebar-label collection-label">
              <span>书籍分组</span>
              <button
                className="icon-btn"
                aria-label="新建分组"
                onClick={() => setModal("group")}
              >
                <Plus size={16} />
              </button>
            </div>
            <nav className="group-nav">
              {groups.length ? (
                groups.map((group) => (
                  <button
                    key={group}
                    className={view === `group:${group}` ? "nav-active" : ""}
                    onClick={() => changeView(`group:${group}`)}
                  >
                    <Folder size={17} />
                    <span>{group}</span>
                    <small>
                      {books.filter((b) => b.collection === group).length}
                    </small>
                  </button>
                ))
              ) : (
                <button className="add-group" onClick={() => setModal("group")}>
                  <FolderPlus size={17} />
                  <span>为好书建个家</span>
                </button>
              )}
            </nav>
            <div className="sidebar-tools">
              <button onClick={() => setModal("convert")}>
                <ArrowRightLeft size={18} />
                <span>格式转换</span>
                <span className="tiny-badge">工具</span>
              </button>
              <button
                className={view === "stats" ? "nav-active" : ""}
                onClick={() => changeView("stats")}
              >
                <BarChart3 size={18} />
                <span>阅读统计</span>
              </button>
              <button
                className={view === "settings" ? "nav-active" : ""}
                onClick={() => changeView("settings")}
              >
                <Settings2 size={18} />
                <span>阅读设置</span>
              </button>
            </div>
            <div className="sidebar-bottom">
              <div className="local-card">
                <div>
                  <span className="local-indicator" />
                  本地书库
                  <ShieldCheck size={14} />
                </div>
                <p>文件留在这里，阅读自在安心。</p>
                <div className="storage-track">
                  <i
                    style={{
                      width: `${Math.min(100, Math.max(2, (storage / (1024 * 1024 * 1024)) * 100))}%`,
                    }}
                  />
                </div>
                <small>
                  {storage ? formatSize(storage) : "尚未导入文件"}
                  <span>{realBooks.length} 本书籍</span>
                </small>
              </div>
              <button className="user-profile" onClick={() => setModal("help")}>
                <span className="avatar">
                  <Leaf size={19} />
                </span>
                <span>
                  <strong>自在阅读的人</strong>
                  <small>让每一页，都值得停留</small>
                </span>
                <HelpCircle size={17} />
              </button>
            </div>
          </aside>
          <div className="main-shell">
            <header className="topbar">
              <div className="breadcrumb">
                <button
                  className="icon-btn mobile-menu"
                  aria-label="打开菜单"
                  onClick={() => setMobileMenu(true)}
                >
                  <Menu size={21} />
                </button>
                <span>我的空间</span>
                <ChevronRight size={14} />
                <strong>{currentTitle}</strong>
              </div>
              <div className="topbar-actions">
                <label className="search-box">
                  <Search size={17} />
                  <input
                    ref={search}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      if (!isLibrary) setView("library");
                    }}
                    placeholder="搜索书名、作者或格式"
                    aria-label="搜索书籍"
                  />
                  {query ? (
                    <button aria-label="清空搜索" onClick={() => setQuery("")}>
                      <X size={14} />
                    </button>
                  ) : (
                    <kbd>/</kbd>
                  )}
                </label>
                <button
                  className="icon-btn help-button"
                  aria-label="帮助与格式支持"
                  onClick={() => setModal("help")}
                >
                  <HelpCircle size={19} />
                </button>
                <button
                  className="primary-btn import-top"
                  disabled={importing}
                  onClick={() => {
                    setImportResults([]);
                    setModal("import");
                  }}
                >
                  <Plus size={17} />
                  <span>导入书籍</span>
                </button>
              </div>
            </header>
            <main className="main-content">
              <div className="page-title">
                <div>
                  <p className="eyebrow">A LITTLE SPACE, A BIG WORLD</p>
                  <h1>
                    {currentTitle}
                    <span className="title-dot">.</span>
                  </h1>
                  <p>
                    {view === "library"
                      ? "把喜欢的故事，放在触手可及的地方。"
                      : view === "recent"
                        ? "沿着上一次的书签，继续你的旅程。"
                        : view === "favorites"
                          ? "那些想要一读再读的故事。"
                          : view === "notes"
                            ? "每一个被文字点亮的瞬间。"
                            : view === "stats"
                              ? "阅读的每一分钟，都在丰富你的世界。"
                              : view === "settings"
                                ? "让每一页，都以你喜欢的方式展开。"
                                : "让相遇的好书，在这里相聚。"}
                  </p>
                </div>
                <div className="private-label">
                  <CloudOff size={15} />
                  <span>本地存储 · 私享阅读</span>
                </div>
              </div>
              {view === "library" && !query && (
                <section className="hero">
                  <div className="hero-copy">
                    <span className="hero-eyebrow">
                      <span />
                      给自己一段安静的时光
                    </span>
                    <h2>
                      把世界调成
                      <br />
                      阅读模式<span>。</span>
                    </h2>
                    <p>
                      翻过一页，遇见另一个世界。
                      <br />
                      漫画、小说与远方，都在这里。
                    </p>
                    <button
                      onClick={() =>
                        recommended ? openBook(recommended) : setModal("import")
                      }
                    >
                      {recent ? "继续我的阅读" : "开启阅读时光"}
                      <ArrowRight size={17} />
                    </button>
                    <span className="hero-bottom">
                      <Sparkles size={13} />
                      好故事，不该被格式限制
                    </span>
                  </div>
                  <div className="hero-art" aria-hidden="true">
                    <div className="hero-orbit orbit-one" />
                    <div className="hero-orbit orbit-two" />
                    <div className="hero-sun" />
                    <div className="hero-star star-one">✦</div>
                    <div className="hero-star star-two">✧</div>
                    <div className="hero-book book-back">
                      <img src="/covers/forest.svg" alt="" />
                    </div>
                    <div className="hero-book book-front">
                      <img src="/covers/mountains.svg" alt="" />
                    </div>
                    <div className="floating-label">
                      <BookOpen size={14} />
                      此刻，只读喜欢的
                    </div>
                    <span className="hero-caption">
                      YOUR NEXT CHAPTER AWAITS
                    </span>
                  </div>
                </section>
              )}
              {view === "library" && recommended && !query && (
                <section className="continue-section">
                  <div className="section-heading">
                    <h2>
                      {recent ? "接着上次的故事" : "不妨，从这本开始"}
                      <span>
                        {recent ? "CONTINUE READING" : "A MOMENT FOR YOU"}
                      </span>
                    </h2>
                    {recent && (
                      <button
                        className="text-btn"
                        onClick={() => changeView("recent")}
                      >
                        全部记录
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                  <div className="continue-card">
                    <div className="continue-cover">
                      <Cover book={recommended} />
                    </div>
                    <div className="continue-details">
                      <span className="tiny-label">
                        {recent ? "正在阅读" : "原创示例 · 即刻体验"}
                      </span>
                      <h3>{recommended.title}</h3>
                      <p>
                        {recommended.author}
                        <span>·</span>
                        {categoryNames[recommended.category]}
                      </p>
                      <div className="continue-progress">
                        <div>
                          <i style={{ width: `${progress(recommended)}%` }} />
                        </div>
                        <span>
                          {recent
                            ? `已读 ${progress(recommended)}%`
                            : "等你翻开第一页"}
                        </span>
                      </div>
                    </div>
                    <div className="continue-quote">
                      “阅读，是一场不必远行的出发。”
                      <span>留一点时间，给自己。</span>
                    </div>
                    <button
                      className="primary-btn continue-button"
                      onClick={() => openBook(recommended)}
                    >
                      {recent ? "继续阅读" : "翻开看看"}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </section>
              )}
              {isLibrary && (
                <section className="library-section">
                  <div className="library-heading">
                    <div className="library-tabs">
                      {(["all", "comic", "ebook", "document"] as const).map(
                        (c) => (
                          <button
                            key={c}
                            className={category === c ? "active" : ""}
                            onClick={() => setCategory(c)}
                          >
                            {c === "all" ? "全部书籍" : categoryNames[c]}
                            <span>
                              {
                                books.filter(
                                  (b) =>
                                    (c === "all" || b.category === c) &&
                                    (view !== "favorites" || b.favorite) &&
                                    (view !== "recent" || b.lastRead) &&
                                    (!view.startsWith("group:") ||
                                      b.collection === view.slice(6)),
                                ).length
                              }
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                    <div className="library-controls">
                      <label className="sort-control">
                        <ArrowDownUp size={14} />
                        <select
                          aria-label="书籍排序"
                          value={sort}
                          onChange={(e) => setSort(e.target.value)}
                        >
                          <option value="added">最近添加</option>
                          <option value="recent">最近阅读</option>
                          <option value="title">书名排序</option>
                          <option value="progress">阅读进度</option>
                        </select>
                        <ChevronDown size={12} />
                      </label>
                      <div className="layout-toggle">
                        <button
                          aria-label="网格视图"
                          className={layout === "grid" ? "active" : ""}
                          onClick={() => setLayout("grid")}
                        >
                          <LayoutGrid size={16} />
                        </button>
                        <button
                          aria-label="列表视图"
                          className={layout === "list" ? "active" : ""}
                          onClick={() => setLayout("list")}
                        >
                          <List size={17} />
                        </button>
                      </div>
                    </div>
                  </div>
                  {loading ? (
                    <div className="empty-state">
                      <LoaderCircle className="spin" />
                      <p>正在整理你的书架…</p>
                    </div>
                  ) : !filtered.length ? (
                    <div className="empty-state">
                      <span className="empty-icon">
                        {view === "favorites" ? (
                          <Heart size={30} />
                        ) : (
                          <BookOpen size={30} />
                        )}
                      </span>
                      <h3>
                        {query
                          ? "还没有找到这本书"
                          : view === "favorites"
                            ? "把喜欢的书，留在这里"
                            : view === "recent"
                              ? "你的故事，正要开始"
                              : "书架上的新位置，留给好故事"}
                      </h3>
                      <p>
                        {query
                          ? "试试其他书名、作者，或导入这本书。"
                          : view === "favorites"
                            ? "点击书籍上的爱心，就能收藏。"
                            : "导入你的第一本书，或打开原创示例开始阅读。"}
                      </p>
                      <button
                        className="primary-btn"
                        onClick={() => setModal("import")}
                      >
                        <Plus size={16} />
                        导入书籍
                      </button>
                    </div>
                  ) : (
                    <div className={`book-${layout}`}>
                      {filtered.map((book) => (
                        <article className="book-card" key={book.id}>
                          <div className="book-cover-wrap">
                            <button
                              className="cover-button"
                              aria-label={`阅读 ${book.title}`}
                              onClick={() => openBook(book)}
                            >
                              <Cover book={book} />
                              <span className="cover-shade" />
                              <span className="cover-read">
                                <BookOpen size={19} />
                                开始阅读
                              </span>
                            </button>
                            <span className="format-badge">{book.format}</span>
                            <button
                              className={`favorite-button ${book.favorite ? "favorited" : ""}`}
                              aria-label={`${book.favorite ? "取消收藏" : "收藏"} ${book.title}`}
                              onClick={() =>
                                updateBook(book.id, {
                                  favorite: !book.favorite,
                                })
                              }
                            >
                              <Heart
                                size={15}
                                fill={book.favorite ? "currentColor" : "none"}
                              />
                            </button>
                            {book.completed && (
                              <span className="completed-badge">
                                <Check size={10} />
                                已读完
                              </span>
                            )}
                          </div>
                          <div className="book-info">
                            <div className="book-title-row">
                              <button
                                className="book-title"
                                onClick={() => openBook(book)}
                              >
                                {book.title}
                              </button>
                              <button
                                className="icon-btn book-more"
                                aria-label={`${book.title}的详情与管理`}
                                onClick={() => setEditBook(book)}
                              >
                                <Ellipsis size={18} />
                              </button>
                            </div>
                            <p className="book-author">{book.author}</p>
                            <div className="book-status">
                              <span>
                                {book.demo !== undefined
                                  ? "原创示例"
                                  : formatSize(book.size)}
                              </span>
                              {book.lastRead ? (
                                <span
                                  className={book.completed ? "finished" : ""}
                                >
                                  {book.completed
                                    ? "已读完"
                                    : `已读 ${progress(book)}%`}
                                </span>
                              ) : (
                                <span className="unread">
                                  <i />
                                  未读
                                </span>
                              )}
                            </div>
                            {book.lastRead && (
                              <div className="book-progress">
                                <i style={{ width: `${progress(book)}%` }} />
                              </div>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  <div className="library-footer">
                    <span>
                      {query
                        ? `找到 ${filtered.length} 本书`
                        : `共 ${filtered.length} 本书籍`}
                      <i />
                      每一本，都有一个值得走进去的世界
                    </span>
                    <button
                      className="text-btn"
                      onClick={() => setModal("help")}
                    >
                      <ShieldCheck size={13} />
                      你的书籍，仅属于你
                    </button>
                  </div>
                </section>
              )}
              {view === "notes" && (
                <div className="notes-grid">
                  {books.flatMap((book) =>
                    (book.notes || []).map((note) => (
                      <article className="library-note" key={note.id}>
                        <div>
                          <StickyNote size={17} />
                          <span>
                            {new Date(note.createdAt).toLocaleDateString(
                              "zh-CN",
                            )}
                          </span>
                        </div>
                        <p>{note.text}</p>
                        <button
                          onClick={() => {
                            updateBook(book.id, { page: note.page });
                            openBook(book);
                          }}
                        >
                          {book.title}
                          <span>第 {note.page + 1} 页 / 章</span>
                          <ArrowRight size={15} />
                        </button>
                        <button
                          className="note-delete icon-btn"
                          aria-label="删除此笔记"
                          onClick={() =>
                            updateBook(book.id, {
                              notes: book.notes!.filter(
                                (n) => n.id !== note.id,
                              ),
                            })
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </article>
                    )),
                  )}
                  {!books.some((b) => b.notes?.length) && (
                    <div className="empty-state">
                      <span className="empty-icon">
                        <StickyNote size={30} />
                      </span>
                      <h3>留住阅读中的灵光</h3>
                      <p>
                        打开书籍，点击顶部笔记图标，记录你想珍藏的句子与想法。
                      </p>
                    </div>
                  )}
                </div>
              )}
              {view === "stats" && (
                <>
                  <div className="stats-grid">
                    {[
                      {
                        label: "书架藏书",
                        value: books.length,
                        unit: "本",
                        icon: Library,
                      },
                      {
                        label: "阅读时长",
                        value: totalMinutes,
                        unit: "分钟",
                        icon: Clock3,
                      },
                      {
                        label: "已经读完",
                        value: books.filter((b) => b.completed).length,
                        unit: "本",
                        icon: BookMarked,
                      },
                      {
                        label: "珍藏书签",
                        value: books.reduce(
                          (s, b) => s + (b.bookmarks?.length || 0),
                          0,
                        ),
                        unit: "枚",
                        icon: BookmarkIcon,
                      },
                    ].map(({ label, value, unit, icon: Icon }) => (
                      <div className="stat-card" key={label}>
                        <Icon size={21} />
                        <span>{label}</span>
                        <p>
                          {value}
                          <small>{unit}</small>
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="stats-panel">
                    <h2>书架里的世界</h2>
                    <p className="muted">按内容分类，看看你的阅读偏好。</p>
                    {(["comic", "ebook", "document"] as const).map((c) => (
                      <div className="category-stat" key={c}>
                        <span>{categoryNames[c]}</span>
                        <div>
                          <i
                            style={{
                              width: `${books.length ? (books.filter((b) => b.category === c).length / books.length) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <strong>
                          {books.filter((b) => b.category === c).length} 本
                        </strong>
                      </div>
                    ))}
                    <p className="subtle-text">
                      时长仅统计当前应用在前台打开阅读器的时间；示例书籍计入书架数量。
                    </p>
                  </div>
                </>
              )}
              {view === "settings" && (
                <div className="preferences-panel">
                  <div className="preferences-intro">
                    <span className="feature-icon">
                      <Leaf size={24} />
                    </span>
                    <h2>找到你的阅读节奏</h2>
                    <p>这些设置会自动保存，并应用到下一次阅读。</p>
                  </div>
                  <div className="preferences-row">
                    <div>
                      <h3>阅读主题</h3>
                      <p>为文字与画面，选择舒适的底色。</p>
                    </div>
                    <div className="theme-buttons">
                      {(["light", "paper", "dark"] as const).map((theme, i) => (
                        <button
                          className={`theme-choice ${settings.theme === theme ? "selected" : ""}`}
                          onClick={() => updateSettings({ ...settings, theme })}
                          key={theme}
                        >
                          {
                            [
                              <Sun size={18} />,
                              <Leaf size={18} />,
                              <Moon size={18} />,
                            ][i]
                          }
                          {["明亮", "护眼", "夜间"][i]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="preferences-row">
                    <div>
                      <h3>默认阅读方式</h3>
                      <p>漫画支持单页、双页和连续滚动。</p>
                    </div>
                    <select
                      value={settings.mode}
                      onChange={(e) =>
                        updateSettings({
                          ...settings,
                          mode: e.target.value as ReaderSettings["mode"],
                        })
                      }
                    >
                      <option value="single">单页阅读</option>
                      <option value="double">双页阅读</option>
                      <option value="scroll">连续滚动</option>
                    </select>
                  </div>
                  <div className="preferences-row">
                    <div>
                      <h3>漫画翻页方向</h3>
                      <p>适配日漫与从右向左的作品。</p>
                    </div>
                    <select
                      value={settings.direction}
                      onChange={(e) =>
                        updateSettings({
                          ...settings,
                          direction: e.target
                            .value as ReaderSettings["direction"],
                        })
                      }
                    >
                      <option value="ltr">从左到右</option>
                      <option value="rtl">从右到左</option>
                    </select>
                  </div>
                  <div className="preferences-row">
                    <div>
                      <h3>文字字号</h3>
                      <p>仅对文字书籍生效。</p>
                    </div>
                    <FieldRange
                      label="字号"
                      value={settings.fontSize}
                      min={14}
                      max={32}
                      unit="px"
                      onChange={(fontSize) =>
                        updateSettings({ ...settings, fontSize })
                      }
                    />
                  </div>
                  <div className="preferences-row">
                    <div>
                      <h3>页面亮度</h3>
                      <p>降低画面亮度，适应周围光线。</p>
                    </div>
                    <FieldRange
                      label="亮度"
                      value={settings.brightness}
                      min={30}
                      max={100}
                      unit="%"
                      onChange={(brightness) =>
                        updateSettings({ ...settings, brightness })
                      }
                    />
                  </div>
                  <div className="privacy-note">
                    <ShieldCheck size={20} />
                    <div>
                      <strong>你的阅读，无需连接外界</strong>
                      <p>
                        书籍与笔记保存在当前浏览器或桌面应用的本地存储中，不自动同步。请保留原始文件；清除应用数据会移除书库。
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </main>
            <footer className="app-footer">
              <span className="footer-brand">
                <BookOpen size={14} />
                阅境
              </span>
              <span>让阅读，自成一境。</span>
              <span className="platform-note">
                {window.readerDesktop
                  ? `${window.readerDesktop.platform === "darwin" ? "macOS" : window.readerDesktop.platform === "win32" ? "Windows" : "Linux"} 桌面版`
                  : "为每一块屏幕，留一处阅读角落"}
              </span>
            </footer>
          </div>
          {dragging && (
            <div className="drop-overlay">
              <div>
                <Upload size={44} />
                <h2>把好故事，放进来</h2>
                <p>松开鼠标，将文件加入你的私人书架</p>
                <span>PDF · EPUB · MOBI · 漫画压缩包 · 图片</span>
              </div>
            </div>
          )}
        </div>
      )}
      {modal === "import" && (
        <Modal
          title="给书架，添一个新世界"
          onClose={() => {
            if (!importing) setModal(null);
          }}
          wide
        >
          <p className="modal-description">
            拖入你的书籍，或从电脑中选择。所有文件都留在本地。
          </p>
          <button
            className="import-dropzone"
            disabled={importing}
            onClick={() => input.current?.click()}
          >
            <span className="import-drop-icon">
              {importing ? (
                <LoaderCircle className="spin" size={29} />
              ) : (
                <Upload size={29} />
              )}
            </span>
            <strong>
              {importing
                ? `正在导入：${importCurrent}`
                : "点击选择书籍，或拖放文件到窗口"}
            </strong>
            <span>支持批量导入 · 单个文件最大 300 MB</span>
            <span className="primary-btn">
              {importing ? "正在整理书籍…" : "选择本地文件"}
            </span>
          </button>
          <button
            className="text-btn folder-import"
            disabled={importing}
            onClick={() => directory.current?.click()}
          >
            <FolderPlus size={16} />
            也可以导入文件夹，图片会合为一本漫画
          </button>
          {importResults.length > 0 && (
            <div className="import-results" aria-live="polite">
              {importResults.map((result, i) => (
                <div
                  key={i}
                  className={result.ok ? "import-ok" : "import-error"}
                >
                  {result.ok ? <CheckCircle2 size={17} /> : <X size={17} />}
                  <span>
                    <strong>{result.name}</strong>
                    <small>{result.status}</small>
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="format-groups">
            <div>
              <Image size={18} />
              <strong>漫画与图片</strong>
              <p>
                CBZ · CBR · CB7 · CBT
                <br />
                ZIP · RAR · 7Z · TAR · 常见图片
              </p>
            </div>
            <div>
              <BookOpen size={18} />
              <strong>电子书</strong>
              <p>
                EPUB · MOBI · AZW3
                <br />
                AZW · FB2
              </p>
            </div>
            <div>
              <FileText size={18} />
              <strong>文档与文字</strong>
              <p>
                PDF · TXT · MD
                <br />
                HTML · UTF-8 / GB 编码
              </p>
            </div>
          </div>
          <p className="privacy-line">
            <ShieldCheck size={13} />
            不上传文件 · 不需要账户 · 不支持 DRM 加密书籍
          </p>
        </Modal>
      )}
      {modal === "help" && (
        <Modal title="你好，这里是阅境" onClose={() => setModal(null)}>
          <div className="help-intro">
            <span className="brand-icon">
              <BookOpen size={27} />
            </span>
            <h3>让阅读，自成一境。</h3>
            <p>一个为漫画与电子书打造的私人阅读角落。</p>
          </div>
          <div className="help-feature">
            <LayoutGrid size={20} />
            <div>
              <strong>像整理书房一样整理书架</strong>
              <p>
                导入文件后，按分类筛选、搜索、收藏或加入自定义分组。点击书籍右侧的
                ··· 管理书籍。
              </p>
            </div>
          </div>
          <div className="help-feature">
            <BookOpen size={20} />
            <div>
              <strong>为每一种故事，找到舒服的读法</strong>
              <p>
                单页、双页、连续滚动、日漫方向、主题和缩放。文字书籍支持系统语音朗读。
              </p>
            </div>
          </div>
          <div className="help-feature">
            <ShieldCheck size={20} />
            <div>
              <strong>本地优先，安心阅读</strong>
              <p>
                书籍保存在当前设备，不自动上传或跨设备同步。请保留原始文件，重要笔记可复制备份。
              </p>
            </div>
          </div>
          <div className="help-feature">
            <ArrowRightLeft size={20} />
            <div>
              <strong>更多格式，自由流转</strong>
              <p>
                支持 PDF、EPUB、MOBI、AZW3、FB2、TXT、HTML
                以及常见漫画压缩包。CHM、DOCX 等请通过桌面版 Calibre 转为
                EPUB。DRM、扫描件文字识别和云同步暂不支持。
              </p>
            </div>
          </div>
          <p className="help-shortcuts">
            <kbd>←</kbd>
            <kbd>→</kbd>翻页<kbd>B</kbd>书签<kbd>F</kbd>全屏<kbd>/</kbd>搜索
          </p>
        </Modal>
      )}
      {modal === "group" && (
        <Modal title="为喜欢的书，建个家" onClose={() => setModal(null)}>
          <p className="muted">用主题、心情或一段旅程，给分组取个名字。</p>
          <label className="form-field">
            分组名称
            <input
              value={groupName}
              maxLength={30}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="例如：周末的漫画时光"
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  document.getElementById("create-group")?.click();
              }}
            />
          </label>
          <button
            id="create-group"
            className="primary-btn full-width"
            disabled={!groupName.trim()}
            onClick={() => {
              const name = groupName.trim();
              if (groups.includes(name)) {
                setToast("这个分组已经存在");
                return;
              }
              const next = [...groups, name];
              setGroups(next);
              localStorage.setItem("yuejing-groups", JSON.stringify(next));
              setGroupName("");
              setModal(null);
              changeView(`group:${name}`);
              setToast("分组已建立。打开书籍详情，即可把好书放进来。");
            }}
          >
            <FolderPlus size={17} />
            创建分组
          </button>
        </Modal>
      )}
      {modal === "convert" && (
        <Converter books={books} onClose={() => setModal(null)} />
      )}
      {editBook && (
        <Modal title="书籍详情" onClose={() => setEditBook(undefined)}>
          <div className="book-detail">
            <Cover book={editBook} />
            <div>
              <h3>{editBook.title}</h3>
              <p>{editBook.author}</p>
              <span className="detail-format">{editBook.format}</span>
              <p>
                {editBook.total} 页 / 章
                {editBook.size
                  ? ` · ${formatSize(editBook.size)}`
                  : " · 原创示例"}
              </p>
              <p>阅读进度 {progress(editBook)}%</p>
            </div>
          </div>
          <label className="form-field">
            书籍名称
            <input
              value={editBook.title}
              maxLength={160}
              onChange={(e) =>
                setEditBook({ ...editBook, title: e.target.value })
              }
            />
          </label>
          <label className="form-field">
            内容分类
            <select
              value={editBook.category}
              onChange={(e) =>
                setEditBook({
                  ...editBook,
                  category: e.target.value as Category,
                })
              }
            >
              {Object.entries(categoryNames).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            放入分组
            <select
              value={editBook.collection || ""}
              onChange={(e) =>
                setEditBook({ ...editBook, collection: e.target.value })
              }
            >
              <option value="">不分组</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <div className="detail-actions">
            <button
              className="danger-text"
              onClick={() => {
                setDeleteTarget(editBook);
                setEditBook(undefined);
              }}
            >
              <Trash2 size={16} />
              移出书架
            </button>
            <button
              className="primary-btn"
              disabled={!editBook.title.trim()}
              onClick={() => {
                updateBook(editBook.id, {
                  title: editBook.title.trim(),
                  category: editBook.category,
                  collection: editBook.collection,
                });
                setEditBook(undefined);
                setToast("书籍信息已保存");
              }}
            >
              保存修改
            </button>
          </div>
        </Modal>
      )}
      {deleteTarget && (
        <Modal
          title="将这本书移出书架？"
          onClose={() => setDeleteTarget(undefined)}
        >
          <p className="modal-description">
            《{deleteTarget.title}
            》的本地副本、进度和笔记会一并移除。电脑中的原始文件不受影响。
          </p>
          <div className="detail-actions">
            <button
              className="secondary-btn"
              onClick={() => setDeleteTarget(undefined)}
            >
              再想一想
            </button>
            <button
              className="danger-btn"
              onClick={() => {
                const id = deleteTarget.id;
                const next = booksRef.current.filter((b) => b.id !== id);
                booksRef.current = next;
                setBooks(next);
                void enqueue(() => deleteBook(id));
                setDeleteTarget(undefined);
                setToast("书籍已移出书架");
              }}
            >
              确认移除
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          <span>{toast}</span>
          <button aria-label="关闭提示" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}
function BookmarkIcon({ size }: { size: number }) {
  return <BookHeart size={size} />;
}
