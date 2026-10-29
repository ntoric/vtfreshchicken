"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

export interface ActionMenuItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  variant?: "default" | "danger";
  href?: string;
  disabled?: boolean;
}

export interface ActionMenuProps {
  items: ActionMenuItem[];
  align?: "left" | "right";
}

export function ActionMenu({ items, align = "right" }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      // Also check the portal menu — it's outside ref.current
      const menuEl = document.getElementById("action-menu-portal");
      if (menuEl && menuEl.contains(e.target as Node)) return;
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, handleClickOutside]);

  // Recompute position on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, left: align === "right" ? r.right : r.left });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, align]);

  const activeItems = items.filter((i) => !i.disabled);
  if (activeItems.length === 0) return null;

  const menu = open && menuPos
    ? createPortal(
        <div
          id="action-menu-portal"
          className="fixed min-w-[160px] bg-white rounded-xl shadow-lg border border-neutral-100 py-1.5 z-[9999]"
          style={{
            top: menuPos.top,
            left: align === "right" ? Math.max(8, menuPos.left - 160) : menuPos.left,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {activeItems.map((item, i) => {
            const cls = `flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium transition ${
              item.variant === "danger"
                ? "text-rose-600 hover:bg-rose-50"
                : "text-neutral-700 hover:bg-neutral-50"
            }`;
            return item.href ? (
              <a key={i} href={item.href} target="_blank" rel="noreferrer" className={cls} onClick={() => setOpen(false)}>
                {item.icon}
                {item.label}
              </a>
            ) : (
              <button
                key={i}
                type="button"
                className={cls}
                onClick={(e) => {
                  e.stopPropagation();
                  item.onClick();
                  setOpen(false);
                }}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
        aria-label="Actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {menu}
    </div>
  );
}
