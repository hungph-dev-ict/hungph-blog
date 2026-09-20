"use client";

import { useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

function RedirectHandler() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = params?.id;
    if (id) {
      const qs = searchParams?.toString() ? `?${searchParams.toString()}` : "";
      router.replace(`/editor/${id}${qs}`);
    }
  }, [params, router, searchParams]);

  return null;
}

export default function AdminEditorIdRedirect() {
  return (
    <Suspense fallback={null}>
      <RedirectHandler />
    </Suspense>
  );
}
