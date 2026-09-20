"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RedirectHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams?.toString() ? `?${searchParams.toString()}` : "";
    router.replace(`/editor/new${qs}`);
  }, [router, searchParams]);

  return null;
}

export default function AdminEditorNewRedirect() {
  return (
    <Suspense fallback={null}>
      <RedirectHandler />
    </Suspense>
  );
}
