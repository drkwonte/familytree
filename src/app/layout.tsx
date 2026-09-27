import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const ADSENSE_CLIENT_ID = "ca-pub-9342204830254267";
const ADSENSE_SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;

const notoSansKr = Noto_Sans_KR({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "가계도 메이커",
  description: "폼과 자연어로 상담 가계도를 자동 렌더링합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko-KR" className={`${notoSansKr.variable} h-full overflow-hidden antialiased`}>
      <head>
        <Script
          id="adsense"
          src={ADSENSE_SCRIPT_SRC}
          strategy="beforeInteractive"
          crossOrigin="anonymous"
        />
      </head>
      <body className="h-full overflow-hidden bg-background text-foreground">{children}</body>
    </html>
  );
}
