"use client";

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CornerDownLeft,
} from "lucide-react";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  totalItems?: number;
  itemsName?: string;
  showQuickJumper?: boolean;
  className?: string;
}

function getPaginationRange(currentPage: number, totalPages: number, siblingCount = 1) {
  const totalPageNumbers = siblingCount * 2 + 5;

  if (totalPages <= totalPageNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

  const shouldShowLeftDots = leftSiblingIndex > 2;
  const shouldShowRightDots = rightSiblingIndex < totalPages - 2;

  const firstPageIndex = 1;
  const lastPageIndex = totalPages;

  if (!shouldShowLeftDots && shouldShowRightDots) {
    const leftItemCount = 3 + 2 * siblingCount;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, "...", totalPages];
  }

  if (shouldShowLeftDots && !shouldShowRightDots) {
    const rightItemCount = 3 + 2 * siblingCount;
    const rightRange = Array.from(
      { length: rightItemCount },
      (_, i) => totalPages - rightItemCount + i + 1
    );
    return [firstPageIndex, "...", ...rightRange];
  }

  if (shouldShowLeftDots && shouldShowRightDots) {
    const middleRange = Array.from(
      { length: rightSiblingIndex - leftSiblingIndex + 1 },
      (_, i) => leftSiblingIndex + i
    );
    return [firstPageIndex, "...", ...middleRange, "...", lastPageIndex];
  }

  return Array.from({ length: totalPages }, (_, i) => i + 1);
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
  totalItems,
  itemsName = "mục",
  showQuickJumper = true,
  className = "",
}) => {
  const [jumpInput, setJumpInput] = useState("");

  if (totalPages <= 1) return null;

  const validPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginationRange = getPaginationRange(validPage, totalPages);

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setJumpInput("");
    }
  };

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600 dark:text-stone-400 ${className}`}
    >
      {/* Summary Info */}
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span>
          Trang <strong className="font-semibold text-stone-900 dark:text-white">{validPage}</strong> / {totalPages}
        </span>
        {totalItems !== undefined && (
          <span className="text-stone-400">
            • Tổng số {totalItems} {itemsName}
          </span>
        )}
      </div>

      {/* Main Navigation Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-1">
        {/* First Page Button */}
        <button
          type="button"
          disabled={validPage <= 1 || disabled}
          onClick={() => onPageChange(1)}
          className="p-1.5 sm:px-2 sm:py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Trang đầu (Trang 1)"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* Previous Page Button */}
        <button
          type="button"
          disabled={validPage <= 1 || disabled}
          onClick={() => onPageChange(validPage - 1)}
          className="p-1.5 sm:px-2 sm:py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Trang trước"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Number Buttons & Dots */}
        <div className="flex items-center gap-1">
          {paginationRange.map((pageItem, index) => {
            if (typeof pageItem === "string") {
              return (
                <span
                  key={`dots-${index}`}
                  className="w-7 h-7 flex items-center justify-center text-xs text-stone-400 select-none"
                >
                  •••
                </span>
              );
            }

            const isCurrent = pageItem === validPage;

            return (
              <button
                key={pageItem}
                type="button"
                disabled={disabled || isCurrent}
                onClick={() => onPageChange(pageItem)}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-semibold transition-all flex items-center justify-center ${
                  isCurrent
                    ? "bg-blue-600 text-white shadow-xs pointer-events-none"
                    : "border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                }`}
                title={`Đến trang ${pageItem}`}
              >
                {pageItem}
              </button>
            );
          })}
        </div>

        {/* Next Page Button */}
        <button
          type="button"
          disabled={validPage >= totalPages || disabled}
          onClick={() => onPageChange(validPage + 1)}
          className="p-1.5 sm:px-2 sm:py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Trang tiếp"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last Page Button */}
        <button
          type="button"
          disabled={validPage >= totalPages || disabled}
          onClick={() => onPageChange(totalPages)}
          className="p-1.5 sm:px-2 sm:py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title={`Trang cuối (Trang ${totalPages})`}
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick Jump Input */}
      {showQuickJumper && totalPages > 3 && (
        <form onSubmit={handleJump} className="flex items-center gap-1.5">
          <span className="text-stone-500 whitespace-nowrap">Đến trang:</span>
          <div className="relative flex items-center">
            <input
              type="number"
              min={1}
              max={totalPages}
              disabled={disabled}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              placeholder={String(validPage)}
              className="w-12 px-1.5 py-1 text-xs text-center rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="submit"
              disabled={
                disabled ||
                !jumpInput ||
                parseInt(jumpInput, 10) < 1 ||
                parseInt(jumpInput, 10) > totalPages ||
                parseInt(jumpInput, 10) === validPage
              }
              className="ml-1 px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 text-[11px] font-semibold text-stone-700 dark:text-stone-300 transition-colors"
              title="Chuyển trang"
            >
              Đi
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
