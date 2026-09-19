"use client";

import React, { useMemo } from "react";
import { Plus, Trash2, Layers, ChevronRight, Sparkles } from "lucide-react";

interface HierarchyConfigEditorProps {
  value: string;
  onChange: (newValue: string) => void;
  className?: string;
}

const PRESETS = [
  {
    name: "5 Cấp (Chapter > Phần > Chương > Bài > Mục)",
    levels: ["Chapter", "Phần", "Chương", "Bài", "Mục"],
  },
  {
    name: "3 Cấp (Phần > Chương > Bài)",
    levels: ["Phần", "Chương", "Bài"],
  },
  {
    name: "2 Cấp (Module > Bài học)",
    levels: ["Module", "Bài học"],
  },
  {
    name: "1 Cấp (Mặc định: Chương)",
    levels: ["Chương"],
  },
];

export const HierarchyConfigEditor: React.FC<HierarchyConfigEditorProps> = ({
  value,
  onChange,
  className = "",
}) => {
  const levels: string[] = useMemo(() => {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item) => String(item).trim() || "Cấp");
      }
    } catch (e) {}
    return ["Chương"];
  }, [value]);

  const updateLevels = (newLevels: string[]) => {
    const cleaned = newLevels.map((l, i) => l.trim() || `Cấp ${i + 1}`);
    onChange(JSON.stringify(cleaned));
  };

  const handleLevelCountChange = (count: number) => {
    const validCount = Math.max(1, Math.min(10, count));
    if (validCount === levels.length) return;

    if (validCount > levels.length) {
      const added: string[] = [];
      const defaultNames = ["Chapter", "Phần", "Chương", "Bài", "Mục", "Tiểu mục", "Chủ đề", "Phần mục"];
      for (let i = levels.length; i < validCount; i++) {
        added.push(defaultNames[i] || `Cấp ${i + 1}`);
      }
      updateLevels([...levels, ...added]);
    } else {
      updateLevels(levels.slice(0, validCount));
    }
  };

  const handleNameChange = (index: number, newName: string) => {
    const updated = [...levels];
    updated[index] = newName;
    updateLevels(updated);
  };

  const handleRemoveLevel = (index: number) => {
    if (levels.length <= 1) return;
    const updated = levels.filter((_, i) => i !== index);
    updateLevels(updated);
  };

  const handleAddLevel = () => {
    if (levels.length >= 10) return;
    const defaultNames = ["Chapter", "Phần", "Chương", "Bài", "Mục", "Tiểu mục", "Chủ đề", "Phần mục"];
    const nextName = defaultNames[levels.length] || `Cấp ${levels.length + 1}`;
    updateLevels([...levels, nextName]);
  };

  return (
    <div className={`space-y-3.5 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/40 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-blue-600" />
          <span>Cấu trúc phân cấp động (Số lượng cấp độ & Tên cấp):</span>
        </label>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
          {levels.length} cấp độ
        </span>
      </div>

      {/* Preset Buttons */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-medium text-stone-500 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Gợi ý mẫu cấu hình nhanh:</span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const isSelected = JSON.stringify(levels) === JSON.stringify(p.levels);
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => updateLevels(p.levels)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600 font-semibold shadow-xs"
                    : "bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700/80"
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Number of levels stepper & controls */}
      <div className="flex items-center gap-3 pt-1">
        <span className="text-xs text-stone-600 dark:text-stone-400 font-medium">
          Số cấp độ phân chia:
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={levels.length <= 1}
            onClick={() => handleLevelCountChange(levels.length - 1)}
            className="w-7 h-7 rounded-lg border border-stone-300 dark:border-stone-700 flex items-center justify-center font-bold text-stone-600 dark:text-stone-300 disabled:opacity-30 hover:bg-stone-100 dark:hover:bg-stone-800 text-sm"
          >
            -
          </button>
          <input
            type="number"
            min={1}
            max={10}
            value={levels.length}
            onChange={(e) => handleLevelCountChange(parseInt(e.target.value) || 1)}
            className="w-12 text-center py-1 text-xs font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
          />
          <button
            type="button"
            disabled={levels.length >= 10}
            onClick={() => handleLevelCountChange(levels.length + 1)}
            className="w-7 h-7 rounded-lg border border-stone-300 dark:border-stone-700 flex items-center justify-center font-bold text-stone-600 dark:text-stone-300 disabled:opacity-30 hover:bg-stone-100 dark:hover:bg-stone-800 text-sm"
          >
            +
          </button>
        </div>
      </div>

      {/* Dynamic Inputs for each level name */}
      <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-stone-800">
        <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block">
          Tùy chỉnh tên từng cấp (từ cấp lớn nhất đến cấp nhỏ nhất):
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {levels.map((lvlName, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 p-1.5 rounded-xl border border-stone-200 dark:border-stone-700/80 bg-white dark:bg-stone-800/80"
            >
              <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 shrink-0">
                Cấp {idx + 1}
              </span>
              <input
                type="text"
                value={lvlName}
                onChange={(e) => handleNameChange(idx, e.target.value)}
                placeholder={`Tên cấp ${idx + 1}...`}
                className="flex-1 min-w-0 px-2 py-1 text-xs font-medium bg-transparent border-0 focus:outline-hidden text-stone-900 dark:text-white"
              />
              {levels.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveLevel(idx)}
                  className="p-1 text-stone-400 hover:text-rose-500 rounded-md transition-colors"
                  title={`Xóa cấp ${idx + 1}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {levels.length < 10 && (
          <button
            type="button"
            onClick={handleAddLevel}
            className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm cấp độ tiếp theo
          </button>
        )}
      </div>

      {/* Real-time Visual Breadcrumb / Hierarchy Preview */}
      <div className="pt-2 border-t border-stone-200 dark:border-stone-800">
        <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400 dark:text-stone-500 block mb-1.5">
          Xem trước chuỗi phân cấp khi viết bài:
        </span>
        <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs">
          {levels.map((lvl, idx) => (
            <React.Fragment key={idx}>
              <span className="font-semibold text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md bg-white dark:bg-stone-900 shadow-2xs border border-blue-200 dark:border-blue-800/60">
                {lvl || `Cấp ${idx + 1}`}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-blue-400 dark:text-blue-500 shrink-0" />
            </React.Fragment>
          ))}
          <span className="font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800">
            📝 Bài viết (Gán vào {levels[levels.length - 1] || "cấp cuối"})
          </span>
        </div>
      </div>
    </div>
  );
};
