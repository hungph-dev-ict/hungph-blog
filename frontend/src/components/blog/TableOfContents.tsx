"use client";

import React, { useEffect, useState } from "react";
import { List, ChevronDown, ChevronUp } from "lucide-react";

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  contentHtml: string;
  initialCollapsed?: boolean;
  onHeadingsFound?: (count: number) => void;
  className?: string;
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({
  contentHtml,
  initialCollapsed = false,
  onHeadingsFound,
  className = "",
}) => {
  const [headings, setHeadings] = useState<TOCItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [isCollapsed, setIsCollapsed] = useState<boolean>(initialCollapsed);

  useEffect(() => {
    // Parse H2 and H3 from the article content
    const parser = new DOMParser();
    const doc = parser.parseFromString(contentHtml, "text/html");
    const elements = doc.querySelectorAll("h2, h3");

    const items: TOCItem[] = [];
    elements.forEach((el, index) => {
      const text = (el.textContent || "").trim();
      if (!text) return;
      let id = el.id;
      if (!id) {
        id = `heading-${index}-${text.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      }
      items.push({
        id,
        text,
        level: el.tagName === "H2" ? 2 : 3,
      });
    });

    setHeadings(items);
    if (onHeadingsFound) {
      onHeadingsFound(items.length);
    }

    // Add corresponding IDs to actual rendered DOM elements
    const article = document.querySelector(".blog-content");
    if (article) {
      const renderedHeadings = article.querySelectorAll("h2, h3");
      renderedHeadings.forEach((el, index) => {
        if (items[index]) {
          el.id = items[index].id;
        }
      });
    }

    // Intersection observer to track active section
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0% -60% 0%" }
    );

    const headingNodes = document.querySelectorAll(".blog-content h2, .blog-content h3");
    headingNodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [contentHtml, onHeadingsFound]);

  // Cuộn mượt mà tới mục tiêu bằng Javascript, tuyệt đối không reload trang
  const handleScrollTo = (e: React.MouseEvent, id: string, text: string) => {
    e.preventDefault();

    // 1. Tìm element theo ID
    let targetElement = document.getElementById(id);

    // 2. Fallback nếu element chưa được gắn ID kịp thời
    if (!targetElement) {
      const article = document.querySelector(".blog-content");
      if (article) {
        const headings = article.querySelectorAll("h2, h3");
        for (const h of headings) {
          if ((h.textContent || "").trim() === text.trim()) {
            h.id = id;
            targetElement = h as HTMLElement;
            break;
          }
        }
      }
    }

    if (targetElement) {
      // Bù trừ độ cao của Sticky Header / Top Navbar (khoảng 85px)
      const topOffset = 85;
      const elementPosition = targetElement.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - topOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });

      setActiveId(id);

      // Cập nhật hash trên URL mà không reload trang
      try {
        window.history.pushState(null, "", `#${id}`);
      } catch {}
    }
  };

  if (headings.length === 0) return null;

  return (
    <div
      className={`p-4 rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white/80 dark:bg-stone-900/70 backdrop-blur-sm shadow-sm transition-all ${className}`}
    >
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between font-semibold text-xs tracking-wider uppercase text-stone-600 dark:text-stone-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group cursor-pointer"
        title={isCollapsed ? "Mở rộng mục lục" : "Thu gọn mục lục"}
      >
        <div className="flex items-center gap-2">
          <List className="w-3.5 h-3.5 text-blue-500" />
          <span>Mục lục bài viết</span>
          <span className="text-[10px] lowercase tracking-normal text-stone-400 font-normal">
            ({headings.length} mục)
          </span>
        </div>
        <div className="p-1 rounded-md group-hover:bg-stone-100 dark:group-hover:bg-stone-800 transition-colors">
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4 text-stone-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-stone-400" />
          )}
        </div>
      </button>

      {!isCollapsed && (
        <nav className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800 space-y-1 text-sm max-h-[60vh] overflow-y-auto pr-2 animate-in fade-in duration-150">
          {headings.map((item) => {
            const isActive = activeId === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => handleScrollTo(e, item.id, item.text)}
                className={`block py-1 transition-colors leading-snug cursor-pointer ${
                  item.level === 3 ? "pl-4 text-xs" : "font-medium text-xs sm:text-sm"
                } ${
                  isActive
                    ? "text-blue-600 dark:text-blue-400 font-bold"
                    : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200"
                }`}
              >
                {item.text}
              </a>
            );
          })}
        </nav>
      )}
    </div>
  );
};

