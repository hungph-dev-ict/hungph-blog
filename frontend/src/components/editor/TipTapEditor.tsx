"use client";

import React, { useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
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
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose dark:prose-invert max-w-none focus:outline-none min-h-[400px] p-6 text-stone-900 dark:text-stone-100",
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

  return (
    <div className="border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden bg-white dark:bg-stone-900/80 shadow-sm">
      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Editor Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2.5 border-b border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-900 sticky top-16 z-20 backdrop-blur-sm">
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
      <div className="relative min-h-[400px]">
        <EditorContent editor={editor} />
      </div>

      {/* Editor Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-stone-400 border-t border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
        <span>Gõ văn bản trực tiếp hoặc dán nội dung từ clipboard</span>
        <span>HTML Live Sync</span>
      </div>
    </div>
  );
};
