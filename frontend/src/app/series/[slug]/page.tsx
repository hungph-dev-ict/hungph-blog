import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchSeries, fetchSeriesBySlug, getFullImageUrl } from "@/lib/api";
import { SeriesDetailClient } from "@/components/blog/SeriesDetailClient";

export const revalidate = 60; // ISR: Tự động cập nhật ngầm sau mỗi 60 giây
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const seriesList = await fetchSeries();
    if (Array.isArray(seriesList)) {
      return seriesList.map((s) => ({
        slug: s.slug,
      }));
    }
  } catch (err) {
    console.error("Lỗi khi sinh static params cho series:", err);
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
    const series = await fetchSeriesBySlug(slug);
    if (!series) {
      return {
        title: "Khóa học không tồn tại | HungPH. Blog",
      };
    }

    const coverUrl = series.cover_image
      ? getFullImageUrl(series.cover_image)
      : `${siteUrl}/og-image.jpg`;

    const description =
      series.summary ||
      `Khóa học ${series.title} gồm ${series.total_chapters} chương và ${series.total_lessons} bài học chuyên sâu.`;

    return {
      title: `${series.title} (Khóa Học)`,
      description,
      keywords: [
        series.title,
        series.category ? series.category.name : "",
        "Khóa học lập trình",
        "Series bài viết",
        "Hung Pham Hoang",
      ].filter(Boolean),
      alternates: {
        canonical: `/series/${slug}`,
      },
      openGraph: {
        title: series.title,
        description,
        url: `${siteUrl}/series/${slug}`,
        siteName: "HungPH. Blog",
        locale: "vi_VN",
        type: "website",
        images: [
          {
            url: coverUrl,
            width: 1200,
            height: 630,
            alt: series.title,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: series.title,
        description,
        images: [coverUrl],
      },
    };
  } catch {
    return {
      title: "Khóa học | HungPH. Blog",
    };
  }
}

export default async function SeriesDetailPage({ params }: Props) {
  const { slug } = await params;
  let series = null;

  try {
    series = await fetchSeriesBySlug(slug);
  } catch (err) {
    console.error("Lỗi khi tải series phía server:", err);
  }

  if (!series) {
    notFound();
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hungph-blog.vercel.app";
  const coverUrl = series.cover_image
    ? getFullImageUrl(series.cover_image)
    : `${siteUrl}/og-image.jpg`;

  // Schema.org Course
  const courseJsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: series.title,
    description: series.summary,
    provider: {
      "@type": "Person",
      name: "Hung Pham Hoang",
      url: siteUrl,
    },
    image: [coverUrl],
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
        name: "Khóa học & Series",
        item: `${siteUrl}/series`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: series.title,
        item: `${siteUrl}/series/${series.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <SeriesDetailClient initialSeries={series} />
    </>
  );
}
