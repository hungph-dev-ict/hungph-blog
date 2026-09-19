import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/common/Header";
import { Footer } from "@/components/common/Footer";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "HungPH. | Blog Kỹ Thuật, Kiến Trúc & AI",
  description:
    "Không gian chia sẻ kiến thức chuyên sâu về lập trình, thiết kế kiến trúc phần mềm, AI RAG và góc nhìn cuộc sống.",
  keywords: ["Software Architecture", "Next.js", "FastAPI", "RAG", "AI", "Blog Kỹ Thuật"],
  authors: [{ name: "Hung Pham Hoang" }],
  openGraph: {
    title: "HungPH. | Blog Kỹ Thuật, Kiến Trúc & AI",
    description: "Không gian chia sẻ kiến thức chuyên sâu về lập trình và công nghệ.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 selection:bg-blue-500 selection:text-white transition-colors duration-200">
        <AuthProvider>
          <Header />
          <main className="flex-1 max-w-7xl 2xl:max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
