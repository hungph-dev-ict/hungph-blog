import { MetadataRoute } from "next";
import { fetchPosts, fetchSeries } from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // Cập nhật sitemap mỗi 1 giờ

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hungph-blog.vercel.app";
  const now = new Date();

  // Các trang tĩnh quan trọng
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${siteUrl}/series`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/categories`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/utilities`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  // Lấy danh sách bài viết động
  let postRoutes: MetadataRoute.Sitemap = [];
  try {
    const postsData = await fetchPosts({ limit: 500, include_drafts: false });
    if (postsData && postsData.items) {
      postRoutes = postsData.items.map((post) => ({
        url: `${siteUrl}/posts/${post.slug}`,
        lastModified: post.published_at ? new Date(post.published_at) : now,
        changeFrequency: "weekly",
        priority: 0.8,
      }));
    }
  } catch (err) {
    console.error("Lỗi khi sinh sitemap cho bài viết:", err);
  }

  // Lấy danh sách khóa học / series động
  let seriesRoutes: MetadataRoute.Sitemap = [];
  try {
    const seriesData = await fetchSeries();
    if (seriesData && Array.isArray(seriesData)) {
      seriesRoutes = seriesData.map((series) => ({
        url: `${siteUrl}/series/${series.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
      }));
    }
  } catch (err) {
    console.error("Lỗi khi sinh sitemap cho series:", err);
  }

  return [...staticRoutes, ...postRoutes, ...seriesRoutes];
}
