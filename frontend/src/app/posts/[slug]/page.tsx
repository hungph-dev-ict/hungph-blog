import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchPostBySlug, fetchPosts, getFullImageUrl } from "@/lib/api";
import { PostDetailClient } from "@/components/blog/PostDetailClient";

export const revalidate = 60; // ISR: Tự động cập nhật ngầm sau mỗi 60 giây
export const dynamicParams = true; // Các bài viết mới tạo vẫn tự động render và cache on-demand

export async function generateStaticParams() {
  try {
    const postsData = await fetchPosts({ limit: 100, include_drafts: false });
    if (postsData?.items) {
      return postsData.items.map((post) => ({
        slug: post.slug,
      }));
    }
  } catch (err) {
    console.error("Lỗi khi sinh static params cho bài viết:", err);
  }
  return [];
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hungph-blog.vercel.app";

  try {
    const post = await fetchPostBySlug(slug);
    if (!post) {
      return {
        title: "Bài viết không tồn tại | HungPH. Blog",
      };
    }

    const coverUrl = post.cover_image
      ? getFullImageUrl(post.cover_image)
      : `${siteUrl}/og-image.jpg`;

    const description =
      post.summary ||
      post.content_html
        ?.replace(/<[^>]*>?/gm, "")
        ?.slice(0, 160)
        ?.trim() ||
      "Bài viết chuyên sâu về kỹ thuật, kiến trúc phần mềm và trí tuệ nhân tạo.";

    const keywords = [
      ...(post.tags ? post.tags.map((t) => t.name) : []),
      post.category ? post.category.name : "",
      "Kỹ thuật phần mềm",
      "Kiến trúc hệ thống",
      "AI RAG",
      "Hung Pham Hoang",
      "HungPH Blog",
    ].filter(Boolean);

    return {
      title: post.title,
      description,
      keywords,
      authors: [{ name: post.author?.full_name || "Hung Pham Hoang" }],
      alternates: {
        canonical: `/posts/${slug}`,
      },
      openGraph: {
        title: post.title,
        description,
        url: `${siteUrl}/posts/${slug}`,
        siteName: "HungPH. Blog",
        locale: "vi_VN",
        type: "article",
        publishedTime: post.published_at || undefined,
        modifiedTime: post.updated_at || undefined,
        authors: [post.author?.full_name || "Hung Pham Hoang"],
        tags: post.tags?.map((t) => t.name),
        images: [
          {
            url: coverUrl,
            width: 1200,
            height: 630,
            alt: post.title,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: post.title,
        description,
        images: [coverUrl],
      },
    };
  } catch {
    return {
      title: "Bài viết | HungPH. Blog",
    };
  }
}

export default async function PostDetailPage({ params }: Props) {
  const { slug } = await params;
  let post = null;

  try {
    post = await fetchPostBySlug(slug);
  } catch (err) {
    console.error("Lỗi khi tải bài viết phía server:", err);
  }

  if (!post) {
    notFound();
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hungph-blog.vercel.app";
  const coverUrl = post.cover_image
    ? getFullImageUrl(post.cover_image)
    : `${siteUrl}/og-image.jpg`;

  // Schema.org BlogPosting cho Google Rich Snippets
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    image: [coverUrl],
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    author: {
      "@type": "Person",
      name: post.author?.full_name || "Hung Pham Hoang",
      url: siteUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "HungPH. Blog",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/favicon.ico`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteUrl}/posts/${post.slug}`,
    },
    keywords: post.tags?.map((t) => t.name).join(", "),
    articleSection: post.category?.name,
  };

  // Schema.org BreadcrumbList
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Trang chủ",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: post.category?.name || "Bài viết",
        item: `${siteUrl}/?category=${post.category?.slug || ""}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: `${siteUrl}/posts/${post.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <PostDetailClient initialPost={post} />
    </>
  );
}
