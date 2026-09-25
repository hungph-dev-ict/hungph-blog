import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/common/Header";
import { Footer } from "@/components/common/Footer";
import { ScrollToTop } from "@/components/common/ScrollToTop";
import { AuthProvider } from "@/lib/auth-context";
import { LoadingProvider } from "@/lib/loading-context";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hungph-blog.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "HungPH. | Blog Kỹ Thuật, Kiến Trúc & AI",
    template: "%s | HungPH. Blog",
  },
  description:
    "Không gian chia sẻ kiến thức chuyên sâu về lập trình, thiết kế kiến trúc phần mềm, AI RAG và góc nhìn cuộc sống.",
  keywords: [
    "Software Architecture",
    "Next.js",
    "FastAPI",
    "Supabase",
    "RAG",
    "AI",
    "Lập trình",
    "Blog Kỹ Thuật",
    "Hưng Phạm Hoàng",
    "Hung Pham Hoang",
  ],
  authors: [{ name: "Hung Pham Hoang", url: siteUrl }],
  creator: "Hung Pham Hoang",
  publisher: "Hung Pham Hoang",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "HungPH. | Blog Kỹ Thuật, Kiến Trúc & AI",
    description: "Không gian chia sẻ kiến thức chuyên sâu về lập trình, thiết kế kiến trúc và công nghệ AI.",
    url: siteUrl,
    siteName: "HungPH. Blog",
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HungPH. | Blog Kỹ Thuật, Kiến Trúc & AI",
    description: "Không gian chia sẻ kiến thức chuyên sâu về lập trình, thiết kế kiến trúc và công nghệ AI.",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "HungPH. Blog",
    url: siteUrl,
    description:
      "Không gian chia sẻ kiến thức chuyên sâu về lập trình, thiết kế kiến trúc phần mềm, AI RAG và góc nhìn cuộc sống.",
    author: {
      "@type": "Person",
      name: "Hung Pham Hoang",
      url: siteUrl,
    },
    inLanguage: "vi-VN",
  };

  return (
    <html lang="vi" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="flex flex-col min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 selection:bg-blue-500 selection:text-white transition-colors duration-200">
        <AuthProvider>
          <LoadingProvider>
            <Header />
            <main className="flex-1 max-w-7xl 2xl:max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0 overflow-x-hidden">
              {children}
            </main>
            <Footer />
            <ScrollToTop />
          </LoadingProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
