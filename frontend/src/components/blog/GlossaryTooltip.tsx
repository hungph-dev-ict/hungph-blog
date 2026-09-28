"use client";

import React, { useEffect, useRef, useState } from "react";
import { BookMarked, X, HelpCircle, ExternalLink } from "lucide-react";
import { GlossaryTerm } from "@/lib/types";

interface ActiveTooltip {
  term: string;
  definition: string;
  x: number;
  y: number;
  targetRect: DOMRect;
  placement: "top" | "bottom";
}

interface GlossaryTooltipProps {
  terms: GlossaryTerm[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const GlossaryTooltip: React.FC<GlossaryTooltipProps> = ({
  terms,
  containerRef,
}) => {
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // 1. Quét DOM trong containerRef và highlight các thuật ngữ lần đầu xuất hiện
  useEffect(() => {
    if (!containerRef.current || !terms || terms.length === 0) return;

    const container = containerRef.current;

    // Loại bỏ các highlight cũ nếu có để tránh lồng nhau khi terms cập nhật
    const oldSpans = container.querySelectorAll(".glossary-term");
    oldSpans.forEach((span) => {
      const parent = span.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(span.textContent || ""), span);
        parent.normalize();
      }
    });

    // Sắp xếp thuật ngữ theo độ dài giảm dần để ưu tiên từ dài trước (tránh 'AI' match trước 'Generative AI')
    const sortedTerms = [...terms].sort((a, b) => b.term.length - a.term.length);

    // Lưu các thuật ngữ đã được highlight (chỉ highlight lần xuất hiện đầu tiên để bài viết tự nhiên, không bị nhiễu)
    const highlightedTerms = new Set<string>();

    const skipTags = new Set([
      "A",
      "CODE",
      "PRE",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6",
      "BUTTON",
      "INPUT",
      "TEXTAREA",
      "SCRIPT",
      "STYLE",
    ]);

    // Hàm đệ quy duyệt các Text node
    const traverseAndHighlight = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (!text || !text.trim()) return;

        // Thử tìm thuật ngữ chưa được highlight trong node này
        for (const item of sortedTerms) {
          const lowerTerm = item.term.toLowerCase();
          if (highlightedTerms.has(lowerTerm)) continue;

          // Tạo regex an toàn: word boundary hoặc phân tách bởi khoảng trắng / dấu câu
          // Thoát các ký tự đặc biệt trong regex
          const escaped = item.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp(`(?<=^|\\s|[.,!?;:()""'“”—\\-])${escaped}(?=$|\\s|[.,!?;:()""'“”—\\-])`, "i");

          const match = text.match(regex);
          if (match && match.index !== undefined) {
            const matchIndex = match.index;
            const matchText = match[0];

            // Tách text node thành 3 phần: trước, match, sau
            const beforeText = text.substring(0, matchIndex);
            const afterText = text.substring(matchIndex + matchText.length);

            const fragment = document.createDocumentFragment();
            if (beforeText) {
              fragment.appendChild(document.createTextNode(beforeText));
            }

            const span = document.createElement("span");
            span.className = "glossary-term";
            span.dataset.glossaryTerm = item.term;
            span.dataset.glossaryDefinition = item.definition;
            span.textContent = matchText;
            fragment.appendChild(span);

            highlightedTerms.add(lowerTerm);

            if (afterText) {
              const afterNode = document.createTextNode(afterText);
              fragment.appendChild(afterNode);
              // Tiếp tục tìm các thuật ngữ khác trong phần còn lại
              traverseAndHighlight(afterNode);
            }

            node.parentNode?.replaceChild(fragment, node);
            return; // Dừng lại vì node hiện tại đã bị thay thế
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (skipTags.has(el.tagName.toUpperCase()) || el.classList.contains("glossary-term")) {
          return;
        }
        // Duyệt các con
        const children = Array.from(el.childNodes);
        for (const child of children) {
          traverseAndHighlight(child);
        }
      }
    };

    traverseAndHighlight(container);
  }, [terms, containerRef]);

  // 2. Event Delegation xử lý Hover (Desktop) và Tap/Click (Mobile)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const clearHideTimer = () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const showTooltipForElement = (el: HTMLElement) => {
      clearHideTimer();
      const term = el.dataset.glossaryTerm || el.textContent || "";
      const definition = el.dataset.glossaryDefinition || "";
      if (!term || !definition) return;

      const rect = el.getBoundingClientRect();
      const tooltipHeight = 130; // ước lượng chiều cao
      const tooltipWidth = Math.min(300, window.innerWidth - 24);

      // Tính toạ độ
      let x = rect.left + rect.width / 2;
      // Giới hạn x không vượt ra ngoài màn hình
      if (x - tooltipWidth / 2 < 12) {
        x = 12 + tooltipWidth / 2;
      } else if (x + tooltipWidth / 2 > window.innerWidth - 12) {
        x = window.innerWidth - 12 - tooltipWidth / 2;
      }

      // Kiểm tra vị trí hiển thị: ưu tiên hiển thị phía trên từ, nếu gần mép trên thì hiển thị phía dưới
      let placement: "top" | "bottom" = "top";
      let y = rect.top - 8;
      if (rect.top < tooltipHeight + 20) {
        placement = "bottom";
        y = rect.bottom + 8;
      }

      // Đánh dấu active class cho span
      document.querySelectorAll(".glossary-term.active").forEach((s) => s.classList.remove("active"));
      el.classList.add("active");

      setActiveTooltip({
        term,
        definition,
        x,
        y,
        targetRect: rect,
        placement,
      });
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest(".glossary-term") as HTMLElement | null;
      if (target) {
        showTooltipForElement(target);
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      // Nếu rê chuột vào chính tooltip thì không tắt
      if (tooltipRef.current && (related === tooltipRef.current || tooltipRef.current.contains(related))) {
        return;
      }
      clearHideTimer();
      hideTimerRef.current = setTimeout(() => {
        setActiveTooltip(null);
        document.querySelectorAll(".glossary-term.active").forEach((s) => s.classList.remove("active"));
      }, 200);
    };

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest(".glossary-term") as HTMLElement | null;
      if (target) {
        // Toggle nếu là cùng 1 target
        if (activeTooltip && target.dataset.glossaryTerm === activeTooltip.term) {
          setActiveTooltip(null);
          target.classList.remove("active");
        } else {
          showTooltipForElement(target);
        }
      } else if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        // Click ngoài tooltip
        setActiveTooltip(null);
        document.querySelectorAll(".glossary-term.active").forEach((s) => s.classList.remove("active"));
      }
    };

    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseout", handleMouseOut);
    container.addEventListener("click", handleClick);
    document.addEventListener("click", handleClick);

    return () => {
      clearHideTimer();
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseout", handleMouseOut);
      container.removeEventListener("click", handleClick);
      document.removeEventListener("click", handleClick);
    };
  }, [containerRef, activeTooltip]);

  if (!activeTooltip) return null;

  return (
    <div
      ref={tooltipRef}
      onMouseEnter={() => {
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
      }}
      onMouseLeave={() => {
        hideTimerRef.current = setTimeout(() => {
          setActiveTooltip(null);
          document.querySelectorAll(".glossary-term.active").forEach((s) => s.classList.remove("active"));
        }, 150);
      }}
      style={{
        position: "fixed",
        left: `${activeTooltip.x}px`,
        top: `${activeTooltip.y}px`,
        transform:
          activeTooltip.placement === "top"
            ? "translate(-50%, -100%)"
            : "translate(-50%, 0)",
        zIndex: 9999,
      }}
      className="w-[90vw] max-w-[320px] rounded-2xl bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border border-purple-200 dark:border-purple-800/80 shadow-2xl p-3.5 text-xs animate-in fade-in zoom-in-95 duration-150 select-text"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-1.5 font-bold text-stone-900 dark:text-white truncate">
          <BookMarked className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
          <span className="truncate">{activeTooltip.term}</span>
          <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950 px-1.5 py-0.5 rounded-full shrink-0">
            Thuật ngữ
          </span>
        </div>
        <button
          onClick={() => {
            setActiveTooltip(null);
            document.querySelectorAll(".glossary-term.active").forEach((s) => s.classList.remove("active"));
          }}
          className="p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          title="Đóng giải thích"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Definition Content */}
      <div className="text-stone-700 dark:text-stone-300 leading-relaxed max-h-48 overflow-y-auto pr-1 whitespace-pre-line text-xs">
        {activeTooltip.definition}
      </div>

      {/* Footer Hint */}
      <div className="mt-2.5 pt-2 border-t border-stone-100 dark:border-stone-800/60 flex items-center justify-between text-[10px] text-stone-400">
        <span className="flex items-center gap-1">
          <HelpCircle className="w-3 h-3 text-purple-500" />
          <span>Tra cứu nhanh qua bài viết</span>
        </span>
        <span className="text-[10px] text-stone-400/80">Chạm ngoài để đóng</span>
      </div>
    </div>
  );
};
