"use client";

import React, { Suspense } from "react";
import { PostEditorForm } from "@/components/editor/PostEditorForm";

export default function NewPostPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-stone-400">Đang khởi tạo trình soạn thảo...</div>}>
      <PostEditorForm />
    </Suspense>
  );
}
