"use client";

import React, { useEffect, useState } from "react";
import { List } from "lucide-react";

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  contentHtml: string;
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({ contentHtml }) => {
  const [headings, setHeadings] = useState<TOCItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    // Parse H2 and H3 from the article content
    const parser = new DOMParser();
    const doc = parser.parseFromString(contentHtml, "text/html");
    const elements = doc.querySelectorAll("h2, h3");

    const items: TOCItem[] = [];
    elements.forEach((el, index) => {
      const text = el.textContent || "";
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
  }, [contentHtml]);

  if (headings.length === 0) return null;

  return (
    <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white/60 dark:bg-stone-900/60 backdrop-blur-sm sticky top-24">
      <div className="flex items-center gap-2 font-semibold text-xs tracking-wider uppercase text-stone-500 dark:text-stone-400 mb-3">
        <List className="w-3.5 h-3.5 text-blue-500" />
        <span>Mục lục bài viết</span>
      </div>
      <nav className="space-y-1 text-sm max-h-[70vh] overflow-y-auto pr-2">
        {headings.map((item) => {
          const isActive = activeId === item.id;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`block py-1 transition-colors leading-snug ${
                item.level === 3 ? "pl-4 text-xs" : "font-medium"
              } ${
                isActive
                  ? "text-blue-600 dark:text-blue-400 font-semibold"
                  : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200"
              }`}
            >
              {item.text}
            </a>
          );
        })}
      </nav>
    </div>
  );
};
