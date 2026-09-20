"use client";

import React, { Suspense } from "react";
import { useParams } from "next/navigation";
import { PostEditorForm } from "@/components/editor/PostEditorForm";

export default function EditPostPage() {
  const params = useParams();
  const id = params?.id as string;

  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-stone-400">Đang khởi tạo trình soạn thảo...</div>}>
      <PostEditorForm postId={id} />
    </Suspense>
  );
}
