import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { X, BookOpen } from "lucide-react";
import type { Book } from "../types";

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const node = ref.current!;
    const candidates = () =>
      [
        ...node.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex="0"]',
        ),
      ].filter((el) => !el.hasAttribute("disabled"));
    candidates()[0]?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        close.current();
      }
      if (e.key === "Tab") {
        const list = candidates();
        const first = list[0];
        const last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle, true);
    return () => {
      document.removeEventListener("keydown", handle, true);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="关闭弹窗" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Cover({
  book,
  className = "",
}: {
  book: Book;
  className?: string;
}) {
  const [url, setUrl] = useState(book.cover);
  useEffect(() => {
    if (book.coverBlob) {
      const local = URL.createObjectURL(book.coverBlob);
      setUrl(local);
      return () => URL.revokeObjectURL(local);
    }
    setUrl(book.cover);
  }, [book.coverBlob, book.cover]);
  return url ? (
    <img
      className={`cover-image ${className}`}
      src={url}
      alt={`${book.title}封面`}
      loading="lazy"
    />
  ) : (
    <div className={`cover-fallback ${className}`}>
      <BookOpen size={32} strokeWidth={1} />
      <strong>{book.title}</strong>
      <span>{book.format}</span>
    </div>
  );
}
export function FieldRange({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="range-field">
      <span>
        {label}
        <b>
          {value}
          {unit}
        </b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
