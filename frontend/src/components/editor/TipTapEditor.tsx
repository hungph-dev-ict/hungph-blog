"use client";

import React, { useRef, useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  FileCode,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo,
  Redo,
  Upload,
  Table as TableIcon,
  ChevronDown,
  Trash2,
  Plus,
} from "lucide-react";
import { uploadMedia, getFullImageUrl } from "@/lib/api";

interface TipTapEditorProps {
  content: string;
  onChange: (contentHtml: string) => void;
  token?: string | null;
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  content,
  onChange,
  token,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableMenuRef = useRef<HTMLDivElement>(null);
  const [showTableMenu, setShowTableMenu] = useState(false);

  // Close table menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tableMenuRef.current && !tableMenuRef.current.contains(e.target as Node)) {
        setShowTableMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline font-medium",
        },
      }),
      Placeholder.configure({
        placeholder: "Bắt đầu viết nội dung tại đây... Hãy chia sẻ ý tưởng của bạn!",
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose dark:prose-invert max-w-none focus:outline-none min-h-[420px] p-6 text-stone-900 dark:text-stone-100",
      },
    },
    immediatelyRender: false,
  });

  if (!editor) {
    return (
      <div className="p-8 border border-stone-200 dark:border-stone-800 rounded-2xl animate-pulse bg-stone-50 dark:bg-stone-900/50 text-center text-sm text-stone-400">
        Đang khởi động trình soạn thảo...
      </div>
    );
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Nhập URL liên kết:", previousUrl);

    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const addImageUrl = () => {
    const url = window.prompt("Nhập URL hình ảnh:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    try {
      const res = await uploadMedia(file, token);
      const fullUrl = getFullImageUrl(res.url);
      editor.chain().focus().setImage({ src: fullUrl }).run();
    } catch (err: any) {
      alert(`Lỗi upload ảnh: ${err.message || "Vui lòng thử lại"}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isTableActive = editor.isActive("table");

  return (
    <div className="border border-stone-200 dark:border-stone-800 rounded-2xl bg-white dark:bg-stone-900/80 shadow-sm relative">
      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Editor Toolbar - Fixed cleanly at top of editor card */}
      <div className="relative flex flex-wrap items-center gap-1 p-2.5 border-b border-stone-200 dark:border-stone-800 bg-stone-50/90 dark:bg-stone-900/90 rounded-t-2xl z-20 backdrop-blur-sm">
        {/* Headings */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2 rounded-lg transition-colors ${
            editor.isActive("heading", { level: 1 })
              ? "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold"
              : "text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800"
          }`}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded-lg transition-colors ${
            editor.isActive("heading", { level: 2 })
              ? "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold"
              : "text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800"
          }`}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-2 rounded-lg transition-colors ${
            editor.isActive("heading", { level: 3 })
              ? "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold"
              : "text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800"
          }`}
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-5 bg-stone-300 dark:bg-stone-700 mx-1" />

        {/* Text Formats */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded-lg transition-colors ${
            editor.isActive("bold")
              ? "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold"
              : "text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800"
          }`}
          title="Đậm (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded-lg transition-colors ${
            editor.isActive("italic")
              ? "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold"
              : "text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800"
          }`}
          title="Nghiêng (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-2 rounded-lg transition-colors ${
            editor.isActive("strike")
              ? "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold"
              : "text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800"
          }`}
          title="Gạch ngang"
        >
          <Strikethrough className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`p-2 rounded-lg transition-colors ${
            editor.isActive("code")
              ? "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold"
              : "text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800"
          }`}
          title="Code inline"
        >
          <Code className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-5 bg-stone-300 dark:bg-stone-700 mx-1" />

        {/* Lists & Blocks */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded-lg transition-colors ${
            editor.isActive("bulletList")
              ? "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold"
              : "text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800"
          }`}
          title="Danh sách gạch đầu dòng"
        >
          <List className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded-lg transition-colors ${
            editor.isActive("orderedList")
              ? "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold"
              : "text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800"
          }`}
          title="Danh sách số thứ tự"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded-lg transition-colors ${
            editor.isActive("blockquote")
              ? "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold"
              : "text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800"
          }`}
          title="Trích dẫn blockquote"
        >
          <Quote className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-2 rounded-lg transition-colors ${
            editor.isActive("codeBlock")
              ? "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold"
              : "text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800"
          }`}
          title="Khối code (Code block)"
        >
          <FileCode className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-5 bg-stone-300 dark:bg-stone-700 mx-1" />

        {/* Table Dropdown Menu */}
        <div className="relative" ref={tableMenuRef}>
          <button
            type="button"
            onClick={() => setShowTableMenu(!showTableMenu)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium ${
              isTableActive
                ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold border border-blue-300 dark:border-blue-800"
                : "text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800 border border-transparent"
            }`}
            title="Bảng biểu (Table)"
          >
            <TableIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Bảng</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {showTableMenu && (
            <div className="absolute left-0 top-full mt-1.5 w-56 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xl py-1.5 z-50 text-xs text-stone-700 dark:text-stone-300 space-y-0.5">
              {!isTableActive ? (
                <>
                  <div className="px-3 py-1 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                    Tạo bảng mới
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                      setShowTableMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                    <span>Chèn bảng 3 hàng × 3 cột</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      editor.chain().focus().insertTable({ rows: 4, cols: 4, withHeaderRow: true }).run();
                      setShowTableMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                    <span>Chèn bảng 4 hàng × 4 cột</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="px-3 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    Thao tác trên bảng
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      editor.chain().focus().addRowAfter().run();
                      setShowTableMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Thêm hàng bên dưới</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      editor.chain().focus().addRowBefore().run();
                      setShowTableMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Thêm hàng bên trên</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      editor.chain().focus().deleteRow().run();
                      setShowTableMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2 text-stone-600 dark:text-stone-400"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Xóa hàng này</span>
                  </button>

                  <div className="my-1 border-t border-stone-200 dark:border-stone-800" />

                  <button
                    type="button"
                    onClick={() => {
                      editor.chain().focus().addColumnAfter().run();
                      setShowTableMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                    <span>Thêm cột bên phải</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      editor.chain().focus().addColumnBefore().run();
                      setShowTableMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                    <span>Thêm cột bên trái</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      editor.chain().focus().deleteColumn().run();
                      setShowTableMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2 text-stone-600 dark:text-stone-400"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Xóa cột này</span>
                  </button>

                  <div className="my-1 border-t border-stone-200 dark:border-stone-800" />

                  <button
                    type="button"
                    onClick={() => {
                      if (editor.can().mergeCells()) {
                        editor.chain().focus().mergeCells().run();
                      } else {
                        editor.chain().focus().splitCell().run();
                      }
                      setShowTableMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2"
                  >
                    <span>Gộp / Tách ô</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      editor.chain().focus().toggleHeaderRow().run();
                      setShowTableMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2"
                  >
                    <span>Bật / tắt dòng tiêu đề</span>
                  </button>

                  <div className="my-1 border-t border-stone-200 dark:border-stone-800" />

                  <button
                    type="button"
                    onClick={() => {
                      editor.chain().focus().deleteTable().run();
                      setShowTableMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Xóa toàn bộ bảng</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Quick table actions visible right on toolbar when cursor is inside table */}
        {isTableActive && (
          <div className="flex items-center gap-1 pl-1 border-l border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className="px-2 py-1 rounded bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-[11px] font-medium text-stone-700 dark:text-stone-300"
              title="Thêm hàng dưới"
            >
              + Hàng
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              className="px-2 py-1 rounded bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-[11px] font-medium text-stone-700 dark:text-stone-300"
              title="Thêm cột phải"
            >
              + Cột
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteRow().run()}
              className="px-2 py-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/50 text-[11px] font-medium text-rose-600 dark:text-rose-400"
              title="Xóa hàng hiện tại"
            >
              - Hàng
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteColumn().run()}
              className="px-2 py-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/50 text-[11px] font-medium text-rose-600 dark:text-rose-400"
              title="Xóa cột hiện tại"
            >
              - Cột
            </button>
          </div>
        )}

        <div className="w-[1px] h-5 bg-stone-300 dark:bg-stone-700 mx-1" />

        {/* Media & Links */}
        <button
          type="button"
          onClick={setLink}
          className={`p-2 rounded-lg transition-colors ${
            editor.isActive("link")
              ? "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold"
              : "text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800"
          }`}
          title="Chèn liên kết"
        >
          <LinkIcon className="w-4 h-4" />
        </button>

        {token && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
            title="Tải ảnh lên từ máy tính"
          >
            <Upload className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={addImageUrl}
          className="p-2 rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
          title="Chèn ảnh từ URL"
        >
          <ImageIcon className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-5 bg-stone-300 dark:bg-stone-700 mx-1" />

        {/* History */}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-2 rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800 disabled:opacity-30 transition-colors"
          title="Hoàn tác (Undo)"
        >
          <Undo className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-2 rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800 disabled:opacity-30 transition-colors"
          title="Làm lại (Redo)"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      {/* Editor Main Content Area */}
      <div className="relative min-h-[420px] rounded-b-2xl">
        <EditorContent editor={editor} />
      </div>

      {/* Editor Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-stone-400 border-t border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 rounded-b-2xl">
        <span>Gõ văn bản trực tiếp, dán từ clipboard hoặc chèn bảng / ảnh</span>
        <span>HTML Live Sync</span>
      </div>
    </div>
  );
};
