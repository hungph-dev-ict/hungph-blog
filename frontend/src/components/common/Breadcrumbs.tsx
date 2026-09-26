import React from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = "" }) => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hungph-blog.vercel.app";

  // Filter out redundant "Trang chủ" / "Home" if passed as initial item
  const validItems = items.filter(
    (item, index) =>
      !(
        index === 0 &&
        (item.label.trim().toLowerCase() === "trang chủ" ||
          item.label.trim().toLowerCase() === "home" ||
          item.href === "/")
      )
  );

  const allItems: BreadcrumbItem[] = [
    { label: "Trang chủ", href: "/" },
    ...validItems,
  ];

  // Schema.org BreadcrumbList JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: allItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: item.href.startsWith("http") ? item.href : `${siteUrl}${item.href}` } : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav
        aria-label="Breadcrumb"
        className={`flex items-center flex-wrap gap-1.5 text-xs text-stone-500 dark:text-stone-400 mb-6 ${className}`}
      >
        <Link
          href="/"
          className="inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          title="Về trang chủ"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Trang chủ</span>
        </Link>

        {validItems.map((item, index) => {
          const isLast = index === validItems.length - 1;
          return (
            <React.Fragment key={index}>
              <ChevronRight className="w-3 h-3 text-stone-300 dark:text-stone-600 shrink-0" />
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate max-w-[200px]"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={`font-semibold text-stone-800 dark:text-stone-200 truncate max-w-[280px] ${
                    isLast ? "text-stone-900 dark:text-white" : ""
                  }`}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </nav>
    </>
  );
};
