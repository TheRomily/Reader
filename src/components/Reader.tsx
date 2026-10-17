import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Expand,
  List,
  LoaderCircle,
  Maximize,
  Minus,
  Moon,
  PanelLeftClose,
  Pause,
  Play,
  Plus,
  Settings2,
  StickyNote,
  Sun,
  Volume2,
  X,
  ZoomIn,
} from "lucide-react";
import type { Book, ReadableBook, ReaderSettings, PageContent } from "../types";
import { openDocument, sanitizeHtml } from "../lib/formats";
import { Modal, FieldRange } from "./UI";

function PageView({
  document: book,
  index,
  settings,
  onVisible,
  onNavigate,
  lazy,
  initialOffset,
}: {
  document: ReadableBook;
  index: number;
  settings: ReaderSettings;
  onVisible: (n: number, offset: number) => void;
  onNavigate: (n: number) => void;
  lazy: boolean;
  initialOffset: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [visible, setVisible] = useState(!lazy);
  const [content, setContent] = useState<PageContent>();
  const [error, setError] = useState("");
  const [height, setHeight] = useState(500);
  const [placeholderHeight, setPlaceholderHeight] = useState(500);
  const [frameReady, setFrameReady] = useState(false);
  const restored = useRef(false);
  const restoreScroll = useCallback(() => {
    if (restored.current) return;
    restored.current = true;
    if (!initialOffset) return;
    requestAnimationFrame(() => {
      const root = ref.current?.closest(".reading-stage");
      if (!root || !ref.current) return;
      root.scrollTop =
        ref.current.offsetTop + ref.current.offsetHeight * initialOffset;
    });
  }, [initialOffset]);
  useLayoutEffect(() => {
    if (frameReady) restoreScroll();
  }, [frameReady, height, restoreScroll]);
  useEffect(() => {
    if (!content || !ref.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.height > 0)
        setPlaceholderHeight(Math.ceil(entry.contentRect.height));
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [content]);
  useEffect(() => {
    if (!lazy) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setVisible(entry.isIntersecting);
      },
      { rootMargin: "900px 0px" },
    );
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, [lazy]);
  useEffect(() => {
    if (!visible) return;
    let disposed = false;
    let release: (() => void) | undefined;
    setError("");
    book
      .getPage(index)
      .then((value) => {
        if (value.kind === "image") release = value.release;
        if (disposed) {
          release?.();
          return;
        }
        setContent(value);
      })
      .catch((e) => {
        if (!disposed)
          setError(e instanceof Error ? e.message : "页面加载失败");
      });
    return () => {
      disposed = true;
      release?.();
      setContent(undefined);
      setFrameReady(false);
    };
  }, [book, index, visible]);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const root = node.closest(".reading-stage")!;
    let last = 0;
    const track = () => {
      if (performance.now() - last < 400 || !restored.current) return;
      last = performance.now();
      const rect = node.getBoundingClientRect();
      const boundary = root.getBoundingClientRect().top + (lazy ? 90 : 0);
      if (rect.top <= boundary + 26 && rect.bottom > boundary)
        onVisible(
          index,
          Math.min(0.999, Math.max(0, (boundary - rect.top) / rect.height)),
        );
    };
    root.addEventListener("scroll", track, { passive: true });
    return () => root.removeEventListener("scroll", track);
  }, [index, lazy, onVisible]);
  useEffect(() => {
    const iframe = frame.current;
    if (!iframe || content?.kind !== "html") return;
    let observer: ResizeObserver | undefined;
    const load = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;
      const measure = () =>
        setHeight(
          Math.max(
            400,
            doc.documentElement.scrollHeight,
            doc.body.scrollHeight,
          ),
        );
      observer = new ResizeObserver(measure);
      observer.observe(doc.body);
      measure();
      setFrameReady(true);
      doc.addEventListener("click", (e) => {
        const anchor = (e.target as Element)?.closest("a");
        if (anchor) {
          e.preventDefault();
          const page = anchor.getAttribute("data-page");
          if (page !== null) onNavigate(Number(page));
        }
      });
      doc.addEventListener("keydown", (e) => {
        if (
          [
            "ArrowRight",
            "ArrowLeft",
            "Escape",
            "f",
            "F",
            "b",
            "B",
            " ",
          ].includes(e.key)
        ) {
          e.preventDefault();
          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: e.key, bubbles: true }),
          );
        }
      });
    };
    iframe.addEventListener("load", load);
    return () => {
      iframe.removeEventListener("load", load);
      observer?.disconnect();
    };
  }, [content, onNavigate, settings.fontSize, settings.theme, restoreScroll]);
  const ink = settings.theme === "dark" ? "#d8dfd8" : "#323d35";
  const html =
    content?.kind === "html"
      ? `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src blob: data:; style-src 'unsafe-inline'; font-src blob: data:;"><style>:root{color-scheme:${settings.theme === "dark" ? "dark" : "light"}}*{box-sizing:border-box}html,body{margin:0;padding:0;background:transparent;color:${ink}}body{padding:50px 9%;font-family:Georgia,'Noto Serif SC','Songti SC',SimSun,serif;font-size:${settings.fontSize}px;line-height:1.95;overflow-wrap:anywhere}h1,h2,h3{line-height:1.5;font-weight:500;margin:1.8em 0 1em}h1{font-size:1.6em}p{margin:1em 0}img,svg{max-width:100%;height:auto;display:block;margin:auto}.eyebrow{font-size:12px;letter-spacing:.1em;opacity:.6}a{color:inherit;text-decoration:underline}pre{white-space:pre-wrap}table{max-width:100%}</style></head><body>${sanitizeHtml(content.html)}</body></html>`
      : "";
  return (
    <div
      className={`reader-page ${content?.kind === "html" ? "text-page" : ""}`}
      ref={ref}
      data-page-index={index}
      style={{ minHeight: !content ? placeholderHeight : undefined }}
    >
      {error ? (
        <div className="page-error">
          <BookOpen />
          <p>{error}</p>
        </div>
      ) : !content ? (
        <div className="page-loading">
          <LoaderCircle className="spin" size={24} />
          <span>
            正在展开第 {index + 1} {book.unit || "页"}
          </span>
        </div>
      ) : content.kind === "image" ? (
        <img
          src={content.src}
          alt={`第 ${index + 1} 页`}
          draggable={false}
          onLoad={restoreScroll}
          onError={() =>
            setError("图片无法显示，文件可能已损坏或采用不支持的编码。")
          }
        />
      ) : (
        <iframe
          ref={frame}
          title={`第 ${index + 1} ${book.unit || "章"}`}
          sandbox="allow-same-origin"
          srcDoc={html}
          style={{ height }}
        />
      )}
    </div>
  );
}
export default function Reader({
  book,
  settings,
  onSettings,
  onUpdate,
  onClose,
}: {
  book: Book;
  settings: ReaderSettings;
  onSettings: (s: ReaderSettings) => void;
  onUpdate: (patch: Partial<Book>) => void;
  onClose: () => void;
}) {
  const [document, setDocument] = useState<ReadableBook>();
  const [error, setError] = useState("");
  const [page, setPage] = useState(book.page);
  const [panel, setPanel] = useState<"toc" | "bookmarks" | "notes" | null>(
    null,
  );
  const [showSettings, setShowSettings] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [autoScroll, setAutoScroll] = useState(false);
  const [speed, setSpeed] = useState(35);
  const [speaking, setSpeaking] = useState(false);
  const [notice, setNotice] = useState("");
  const stage = useRef<HTMLDivElement>(null);
  const reader = useRef<HTMLDivElement>(null);
  const update = useRef(onUpdate);
  update.current = onUpdate;
  const current = useRef(page);
  current.current = page;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const pageRef = useRef<ReadableBook | undefined>(undefined);
  pageRef.current = document;
  const navigating = useRef(false);
  const initialLocation = useRef({ page: book.page, offset: book.offset || 0 });
  useEffect(() => {
    let disposed = false;
    let loaded: ReadableBook | undefined;
    openDocument(book)
      .then((value) => {
        loaded = value;
        if (disposed) {
          void value.destroy();
          return;
        }
        setPage((p) => Math.min(p, value.length - 1));
        setDocument(value);
        update.current({ total: value.length, lastRead: Date.now() });
      })
      .catch((e) => {
        if (!disposed) setError(e instanceof Error ? e.message : "打开失败");
      });
    return () => {
      disposed = true;
      if (loaded) void loaded.destroy();
    };
    // File is fixed for this reader session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);
  useEffect(() => {
    let seconds = 0;
    const interval = window.setInterval(() => {
      if (window.document.visibilityState === "visible") seconds++;
      if (seconds >= 15) {
        update.current({ readingSeconds: (bookSeconds.current += seconds) });
        seconds = 0;
      }
    }, 1000);
    return () => {
      clearInterval(interval);
      if (seconds)
        update.current({ readingSeconds: bookSeconds.current + seconds });
    };
  }, []);
  const bookSeconds = useRef(book.readingSeconds || 0);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3600);
    return () => clearTimeout(timer);
  }, [notice]);
  const navigate = useCallback((target: number) => {
    const length = pageRef.current?.length || 1;
    const next = Math.max(0, Math.min(length - 1, target));
    initialLocation.current.offset = 0;
    setPage(next);
    update.current({
      page: next,
      offset: 0,
      lastRead: Date.now(),
      completed: false,
    });
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    if (settingsRef.current.mode === "scroll") {
      navigating.current = true;
      stage.current
        ?.querySelector(`[data-page-index="${next}"]`)
        ?.scrollIntoView({ block: "start" });
      setTimeout(() => {
        navigating.current = false;
      }, 200);
    } else stage.current?.scrollTo({ top: 0 });
  }, []);
  const onVisible = useCallback((index: number, offset: number) => {
    if (navigating.current) return;
    setPage(index);
    update.current({
      page: index,
      offset,
      lastRead: Date.now(),
      completed: false,
    });
  }, []);
  useEffect(() => {
    if (document && settings.mode === "scroll") {
      const target = stage.current?.querySelector(
        `[data-page-index="${current.current}"]`,
      ) as HTMLElement | null;
      if (target)
        stage.current!.scrollTop =
          target.offsetTop + target.offsetHeight * (book.offset || 0);
    }
  }, [document, settings.mode]);
  const toggleBookmark = useCallback(() => {
    const marks = book.bookmarks || [];
    update.current({
      bookmarks: marks.includes(current.current)
        ? marks.filter((n) => n !== current.current)
        : [...marks, current.current].sort((a, b) => a - b),
    });
  }, [book.bookmarks]);
  const toggleFullscreen = useCallback(() => {
    if (window.document.fullscreenElement)
      void window.document
        .exitFullscreen()
        .catch(() => setNotice("无法退出全屏"));
    else
      void reader.current
        ?.requestFullscreen()
        .catch(() => setNotice("当前环境暂不支持全屏"));
  }, []);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (
        (e.target instanceof Element &&
          e.target.matches("input, textarea, select")) ||
        window.document.querySelector('[role="dialog"]')
      )
        return;
      const step = settingsRef.current.mode === "double" ? 2 : 1;
      const forward =
        settingsRef.current.direction === "rtl" ? "ArrowLeft" : "ArrowRight";
      if (e.key === forward || e.key === " ") {
        e.preventDefault();
        navigate(current.current + step);
      }
      if (e.key === (forward === "ArrowLeft" ? "ArrowRight" : "ArrowLeft")) {
        e.preventDefault();
        navigate(current.current - step);
      }
      if (e.key === "Escape") onClose();
      if (e.key.toLowerCase() === "b") toggleBookmark();
      if (e.key.toLowerCase() === "f") toggleFullscreen();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [navigate, onClose, toggleBookmark, toggleFullscreen]);
  useEffect(() => {
    if (!autoScroll) return;
    let last = performance.now();
    let id = 0;
    let carry = 0;
    const tick = (time: number) => {
      const delta = Math.min(100, time - last);
      last = time;
      const container = stage.current;
      if (container && window.document.visibilityState === "visible") {
        carry += (speed * delta) / 1000;
        const pixels = Math.floor(carry);
        carry -= pixels;
        container.scrollTop += pixels;
        if (
          container.scrollTop + container.clientHeight >=
          container.scrollHeight - 2
        ) {
          if (
            settingsRef.current.mode === "scroll" ||
            current.current >= (pageRef.current?.length || 1) - 1
          ) {
            setAutoScroll(false);
            update.current({ completed: true });
            return;
          }
          navigate(
            current.current + (settingsRef.current.mode === "double" ? 2 : 1),
          );
        }
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [autoScroll, speed, navigate]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  async function speak() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    if (!("speechSynthesis" in window)) {
      setNotice("当前系统未提供语音朗读功能。");
      return;
    }
    try {
      const content = await document!.getPage(page);
      if (content.kind !== "html") {
        if (content.kind === "image") content.release?.();
        setNotice(
          "当前是图像页面。朗读适用于 EPUB、MOBI、FB2、TXT 等文字书籍。",
        );
        return;
      }
      const text =
        new DOMParser().parseFromString(content.html, "text/html").body
          .textContent || "";
      if (!text.trim()) {
        setNotice("本页没有可朗读的文字。");
        return;
      }
      // Short utterances work reliably with native voices on Windows and macOS.
      const parts = text.match(/[^。！？.!?\n]{1,180}[。！？.!?\n]?/g) || [
        text,
      ];
      setSpeaking(true);
      parts.forEach((part, index) => {
        const utterance = new SpeechSynthesisUtterance(part);
        utterance.lang = /[\u4e00-\u9fff]/.test(part) ? "zh-CN" : "en-US";
        utterance.onend = () => {
          if (index === parts.length - 1) setSpeaking(false);
        };
        utterance.onerror = () => {
          setSpeaking(false);
          setNotice("朗读未能启动，请检查系统是否已安装对应的语音。");
        };
        window.speechSynthesis.speak(utterance);
      });
    } catch {
      setNotice("读取文字失败，暂时无法朗读。");
    }
  }
  const change = (patch: Partial<ReaderSettings>) =>
    onSettings({ ...settings, ...patch });
  const unit = document?.unit || "页";
  const total = document?.length || book.total;
  const percent = book.completed
    ? 100
    : Math.round(((page + (book.offset || 0)) / Math.max(1, total)) * 100);
  return (
    <div className={`reader-shell theme-${settings.theme}`} ref={reader}>
      <header className="reader-header">
        <button className="text-btn reader-back" onClick={onClose}>
          <ArrowLeft size={18} />
          <span>返回书架</span>
        </button>
        <div className="reader-title">
          <strong>{book.title}</strong>
          <span>
            {book.demo !== undefined
              ? "阅境原创示例"
              : `${book.author} · ${book.format}`}
          </span>
        </div>
        <div className="reader-actions">
          <button
            className={`icon-btn ${book.bookmarks?.includes(page) ? "is-active" : ""}`}
            aria-label="添加书签"
            title="书签 B"
            onClick={toggleBookmark}
          >
            <Bookmark
              size={19}
              fill={book.bookmarks?.includes(page) ? "currentColor" : "none"}
            />
          </button>
          <button
            className="icon-btn"
            aria-label="写笔记"
            onClick={() => setNoteOpen(true)}
          >
            <StickyNote size={19} />
          </button>
          <button
            className="icon-btn"
            aria-label="全屏阅读"
            title="全屏 F"
            onClick={toggleFullscreen}
          >
            <Expand size={19} />
          </button>
          <button
            className={`icon-btn ${showSettings ? "is-active" : ""}`}
            aria-label="阅读设置"
            onClick={() => setShowSettings((v) => !v)}
          >
            <Settings2 size={19} />
          </button>
        </div>
      </header>
      <div className="reader-body">
        {panel && (
          <aside className="reader-sidebar">
            <div className="panel-heading">
              <strong>阅读导航</strong>
              <button
                className="icon-btn"
                aria-label="收起导航"
                onClick={() => setPanel(null)}
              >
                <PanelLeftClose size={17} />
              </button>
            </div>
            <div className="panel-tabs">
              {(["toc", "bookmarks", "notes"] as const).map((p, i) => (
                <button
                  className={panel === p ? "active" : ""}
                  key={p}
                  onClick={() => setPanel(p)}
                >
                  {["目录", "书签", "笔记"][i]}
                </button>
              ))}
            </div>
            <div className="chapter-list">
              {panel === "toc" ? (
                (document?.chapters.length
                  ? document.chapters
                  : Array.from({ length: total }, (_, index) => ({
                      label: `第 ${index + 1} ${unit}`,
                      index,
                    }))
                ).map((chapter, i) => (
                  <button
                    key={i}
                    className={page === chapter.index ? "active" : ""}
                    onClick={() => navigate(chapter.index)}
                  >
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {chapter.label}
                  </button>
                ))
              ) : panel === "bookmarks" ? (
                book.bookmarks?.length ? (
                  book.bookmarks.map((n) => (
                    <div className="bookmark-row" key={n}>
                      <button onClick={() => navigate(n)}>
                        <Bookmark size={15} />第 {n + 1} {unit}
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={`删除第 ${n + 1} 页书签`}
                        onClick={() =>
                          onUpdate({
                            bookmarks: book.bookmarks!.filter((p) => p !== n),
                          })
                        }
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="panel-empty">
                    按 B 或点击顶部书签图标，留住这一页。
                  </p>
                )
              ) : book.notes?.length ? (
                book.notes.map((n) => (
                  <div key={n.id} className="note-entry">
                    <button onClick={() => navigate(n.page)}>
                      <small>
                        第 {n.page + 1} {unit}
                      </small>
                      <p>{n.text}</p>
                    </button>
                    <button
                      className="icon-btn"
                      aria-label="删除笔记"
                      onClick={() =>
                        onUpdate({
                          notes: book.notes!.filter((note) => note.id !== n.id),
                        })
                      }
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="panel-empty">阅读中的想法，值得被记下来。</p>
              )}
            </div>
          </aside>
        )}
        <main
          ref={stage}
          className={`reading-stage mode-${settings.mode} fit-${settings.fit}`}
          style={
            {
              "--page-zoom": settings.zoom / 100,
              "--brightness": settings.brightness / 100,
            } as CSSProperties
          }
        >
          {error ? (
            <div className="reader-error">
              <BookOpen size={38} />
              <h2>这本书暂时无法展开</h2>
              <p>{error}</p>
              <button className="primary-btn" onClick={onClose}>
                返回书架
              </button>
            </div>
          ) : !document ? (
            <div className="reader-error">
              <LoaderCircle className="spin" />
              <p>正在准备你的阅读空间…</p>
            </div>
          ) : (
            <div className="pages-container">
              <div
                className={
                  settings.mode === "double" ? "page-spread" : "page-sequence"
                }
                style={{
                  flexDirection:
                    settings.mode === "double" && settings.direction === "rtl"
                      ? "row-reverse"
                      : undefined,
                }}
              >
                {(settings.mode === "scroll"
                  ? Array.from({ length: total }, (_, i) => i)
                  : settings.mode === "double" && page + 1 < total
                    ? [page, page + 1]
                    : [page]
                ).map((index) => (
                  <PageView
                    key={`${settings.mode}-${index}`}
                    document={document}
                    index={index}
                    settings={settings}
                    onVisible={onVisible}
                    onNavigate={navigate}
                    lazy={settings.mode === "scroll"}
                    initialOffset={
                      initialLocation.current.page === index
                        ? initialLocation.current.offset
                        : 0
                    }
                  />
                ))}
              </div>
              <div className="end-of-book">
                <span>读到这里，也是一段旅程。</span>
                <button
                  className="text-btn"
                  onClick={() => {
                    onUpdate({
                      completed: true,
                      page: total - 1,
                      lastRead: Date.now(),
                    });
                    setNotice("已标记为读完，阅读进度已保存。");
                  }}
                >
                  <Check size={16} />
                  标记读完
                </button>
              </div>
            </div>
          )}
        </main>
        {showSettings && (
          <aside className="reader-settings">
            <div className="panel-heading">
              <strong>舒适，刚刚好</strong>
              <button
                className="icon-btn"
                aria-label="关闭阅读设置"
                onClick={() => setShowSettings(false)}
              >
                <X size={17} />
              </button>
            </div>
            <p className="setting-label">阅读方式</p>
            <div className="mode-options">
              {(["single", "double", "scroll"] as const).map((mode, i) => (
                <button
                  className={settings.mode === mode ? "selected" : ""}
                  key={mode}
                  onClick={() => change({ mode })}
                >
                  {
                    [
                      <BookOpen size={21} />,
                      <Columns2 size={21} />,
                      <List size={21} />,
                    ][i]
                  }
                  <span>{["单页", "双页", "连续"][i]}</span>
                </button>
              ))}
            </div>
            <p className="setting-label">阅读背景</p>
            <div className="theme-options">
              {(["light", "paper", "dark"] as const).map((theme, i) => (
                <button
                  aria-label={["明亮主题", "护眼主题", "夜间主题"][i]}
                  className={`theme-swatch swatch-${theme} ${settings.theme === theme ? "selected" : ""}`}
                  key={theme}
                  onClick={() => change({ theme })}
                >
                  {settings.theme === theme ? (
                    <Check size={17} />
                  ) : (
                    [
                      <Sun size={17} />,
                      <BookOpen size={17} />,
                      <Moon size={17} />,
                    ][i]
                  )}
                </button>
              ))}
            </div>
            <FieldRange
              label="页面亮度"
              min={30}
              max={100}
              value={settings.brightness}
              unit="%"
              onChange={(brightness) => change({ brightness })}
            />
            <FieldRange
              label="文字字号"
              min={14}
              max={32}
              value={settings.fontSize}
              unit="px"
              onChange={(fontSize) => change({ fontSize })}
            />
            <p className="setting-label">漫画翻页方向</p>
            <div className="segmented">
              <button
                className={settings.direction === "ltr" ? "selected" : ""}
                onClick={() => change({ direction: "ltr" })}
              >
                从左到右
              </button>
              <button
                className={settings.direction === "rtl" ? "selected" : ""}
                onClick={() => change({ direction: "rtl" })}
              >
                从右到左
              </button>
            </div>
            <p className="setting-label">页面适配</p>
            <div className="segmented">
              <button
                className={settings.fit === "page" ? "selected" : ""}
                onClick={() => change({ fit: "page" })}
              >
                完整页面
              </button>
              <button
                className={settings.fit === "width" ? "selected" : ""}
                onClick={() => change({ fit: "width" })}
              >
                适应宽度
              </button>
            </div>
            <div className="settings-divider" />
            <button
              className={`setting-action ${speaking ? "is-active" : ""}`}
              onClick={() => void speak()}
            >
              <Volume2 size={18} />
              {speaking ? "停止朗读" : "朗读当前章节"}
              {speaking ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              className={`setting-action ${autoScroll ? "is-active" : ""}`}
              onClick={() => setAutoScroll((v) => !v)}
            >
              <List size={18} />
              {autoScroll ? "暂停自动阅读" : "自动滚动阅读"}
              {autoScroll ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <FieldRange
              label="自动滚动速度"
              min={10}
              max={100}
              value={speed}
              unit=" px/s"
              onChange={setSpeed}
            />
            <p className="setting-hint">
              ← → 翻页 · B 书签 · F 全屏
              <br />
              Esc 返回书架 · 进度自动保存
            </p>
          </aside>
        )}
      </div>
      <footer className="reader-footer">
        <button
          className={`icon-btn ${panel ? "is-active" : ""}`}
          aria-label="打开阅读导航"
          onClick={() => setPanel((p) => (p ? null : "toc"))}
        >
          <List size={20} />
        </button>
        <div className="page-navigation">
          <button
            className="icon-btn"
            aria-label="上一页"
            disabled={page === 0 || !document}
            onClick={() =>
              navigate(page - (settings.mode === "double" ? 2 : 1))
            }
          >
            {settings.direction === "rtl" ? (
              <ChevronRight size={21} />
            ) : (
              <ChevronLeft size={21} />
            )}
          </button>
          <label>
            <input
              aria-label="跳转页码"
              type="number"
              min={1}
              max={total}
              value={page + 1}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (value >= 1) navigate(value - 1);
              }}
            />
            <span>
              / {total} {unit}
            </span>
          </label>
          <button
            className="icon-btn"
            aria-label="下一页"
            disabled={page >= total - 1 || !document}
            onClick={() =>
              navigate(page + (settings.mode === "double" ? 2 : 1))
            }
          >
            {settings.direction === "rtl" ? (
              <ArrowLeft size={19} />
            ) : (
              <ArrowRight size={19} />
            )}
          </button>
        </div>
        <input
          className="reading-progress"
          aria-label="阅读进度"
          type="range"
          min={0}
          max={Math.max(1, total - 1)}
          value={page}
          onChange={(e) => navigate(Number(e.target.value))}
        />
        <span className="reader-percent">{percent}%</span>
        <div className="zoom-control">
          <button
            className="icon-btn"
            aria-label="缩小页面"
            onClick={() => change({ zoom: Math.max(50, settings.zoom - 10) })}
          >
            <Minus size={16} />
          </button>
          <span>{settings.zoom}%</span>
          <button
            className="icon-btn"
            aria-label="放大页面"
            onClick={() => change({ zoom: Math.min(200, settings.zoom + 10) })}
          >
            <Plus size={16} />
          </button>
          <button
            className="icon-btn"
            aria-label="重置缩放"
            onClick={() => change({ zoom: 100 })}
          >
            <Maximize size={16} />
          </button>
        </div>
        <ZoomIn className="mobile-zoom-icon" size={17} />
      </footer>
      {notice && (
        <div className="reader-notice" role="status">
          {notice}
        </div>
      )}
      {noteOpen && (
        <Modal title="记下此刻的想法" onClose={() => setNoteOpen(false)}>
          <p className="muted">
            {book.title} · 第 {page + 1} {unit}
          </p>
          <textarea
            className="note-input"
            value={note}
            maxLength={5000}
            onChange={(e) => setNote(e.target.value)}
            placeholder="这一页，让你想到了什么？"
            rows={6}
            autoFocus
          />
          <button
            className="primary-btn full-width"
            disabled={!note.trim()}
            onClick={() => {
              onUpdate({
                notes: [
                  ...(book.notes || []),
                  {
                    id: crypto.randomUUID(),
                    page,
                    text: note.trim(),
                    createdAt: Date.now(),
                  },
                ],
              });
              setNote("");
              setNoteOpen(false);
              setNotice("笔记已保存");
              setPanel("notes");
            }}
          >
            保存笔记
          </button>
        </Modal>
      )}
    </div>
  );
}
