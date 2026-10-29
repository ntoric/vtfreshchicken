import { useEffect, useState } from "react";

/**
 * Client-side pagination hook. Slices an array into pages.
 * Resets to page 0 when the source array length changes.
 */
export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(0);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(0);
  }, [total]);

  // Clamp page if items shrink
  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const start = page * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageItems = items.slice(start, end);

  return { page, setPage, pageSize, total, totalPages, start, end, pageItems };
}

/**
 * Reusable pagination controls bar.
 * Shows "Showing X–Y of Z" and Prev / page numbers / Next buttons.
 */
export function Pagination({
  page,
  totalPages,
  total,
  start,
  end,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  start: number;
  end: number;
  onPage: (p: number) => void;
}) {
  if (total === 0) return null;
  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
        <span className="text-neutral-500">{total} item{total !== 1 ? "s" : ""}</span>
      </div>
    );
  }

  // Build page number list with ellipsis
  const pages: (number | "...")[] = [];
  const maxButtons = 5;
  if (totalPages <= maxButtons + 2) {
    for (let i = 0; i < totalPages; i++) pages.push(i);
  } else {
    pages.push(0);
    if (page > 2) pages.push("...");
    for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) pages.push(i);
    if (page < totalPages - 3) pages.push("...");
    pages.push(totalPages - 1);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
      <span className="text-neutral-500">
        Showing {start + 1}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(Math.max(0, page - 1))}
          disabled={page === 0}
          className="px-3 py-1 border border-neutral-200 rounded-lg disabled:opacity-40 hover:bg-neutral-50 transition"
        >
          Prev
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="px-2 text-neutral-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={`min-w-[32px] px-2 py-1 border rounded-lg transition ${
                p === page
                  ? "bg-red-600 text-white border-red-600"
                  : "border-neutral-200 hover:bg-neutral-50"
              }`}
            >
              {p + 1}
            </button>
          )
        )}
        <button
          onClick={() => onPage(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          className="px-3 py-1 border border-neutral-200 rounded-lg disabled:opacity-40 hover:bg-neutral-50 transition"
        >
          Next
        </button>
      </div>
    </div>
  );
}
