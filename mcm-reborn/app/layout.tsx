import type { Metadata, Viewport } from "next";
import { CaptureSessionProvider } from "@/components/screens/entry-capture/CaptureSessionProvider";
import { OrderDraftProvider } from "@/components/screens/order-certificate/OrderDraftProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MCM RE:BORN",
    template: "%s | MCM RE:BORN",
  },
  description: "MCM 제품의 다음 쓰임을 만드는 공식 업사이클링 서비스",
};

export const viewport: Viewport = {
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-scroll-behavior="smooth" lang="ko">
      <head>
        {/*
         * `--font-family-sans` in globals.css names "Pretendard Variable"
         * first, but nothing in the project ever loaded that font — every
         * screen has been silently rendering in the OS's fallback system
         * font instead, with different per-size metrics than Figma's
         * Pretendard-based designs (this is what was causing "수정하기"
         * to never quite baseline-align with "프로필 정보" no matter which
         * flex alignment was tried on My Page). Loading the actual
         * variable font via the CDN jsdelivr build (mirroring
         * https://github.com/orioncactus/pretendard's own recommended
         * usage) is the fix. This requires network access at runtime — a
         * self-hosted `next/font/local` setup would drop that dependency,
         * but installing the `pretendard` package needs `npm install`,
         * which isn't runnable from this session; swap to that later if
         * wanted.
         */}
        <link
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@latest/dist/web/variable/pretendardvariable.css"
          rel="stylesheet"
        />
      </head>
      <body>
        <CaptureSessionProvider>
          <OrderDraftProvider>{children}</OrderDraftProvider>
        </CaptureSessionProvider>
      </body>
    </html>
  );
}
