"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Renders `placeholder` until the slot scrolls within `rootMargin` of the
 * viewport, then mounts `children` (and keeps them mounted). Pair with a
 * `next/dynamic` import so the children's JS is only fetched on demand.
 * Mounts immediately where IntersectionObserver is unavailable.
 */
export function LazyMount({
  children,
  placeholder,
  rootMargin = "600px 0px",
}: {
  children: ReactNode;
  placeholder: ReactNode;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  return <div ref={ref}>{visible ? children : placeholder}</div>;
}
