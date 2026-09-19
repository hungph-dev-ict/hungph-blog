"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Folder, Hash, ArrowRight } from "lucide-react";
import { fetchCategories, fetchTags } from "@/lib/api";
import { Category, Tag } from "@/lib/types";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    Promise.all([fetchCategories(), fetchTags()])
      .then(([cats, tgs]) => {
        setCategories(cats);
        setTags(tgs);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-16">
      <div className="space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-white">
          Chủ Đề & Thẻ Bài Viết
        </h1>
        <p className="text-stone-600 dark:text-stone-400">
          Khám phá bài viết được tổ chức theo chuyên mục và các từ khóa liên quan.
        </p>
      </div>

      {/* Categories */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-base font-bold text-stone-900 dark:text-white">
          <Folder className="w-5 h-5 text-blue-600" />
          <span>Danh mục chính</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-stone-200 dark:bg-stone-800" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/?category=${cat.slug}`}
                className="group p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-blue-500/50 hover:shadow-lg transition-all flex items-center justify-between"
              >
                <div>
                  <h3 className="font-bold text-stone-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {cat.name}
                  </h3>
                  {cat.description && (
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">
                      {cat.description}
                    </p>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all shrink-0 ml-4" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Tags */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-base font-bold text-stone-900 dark:text-white">
          <Hash className="w-5 h-5 text-indigo-600" />
          <span>Thẻ từ khóa</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/?tag=${tag.slug}`}
              className="px-3.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-xs font-medium text-stone-700 dark:text-stone-300 hover:border-blue-500 hover:text-blue-600 transition-all"
            >
              #{tag.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
