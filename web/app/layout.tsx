import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Datavatia",
  description:
    "Mapping the hidden cost of data infrastructure",
  applicationName: "Datavatia",
  appleWebApp: {
    capable: true,
    title: "Datavatia",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Extend under notches/home bars so the full-screen map has
  // no letterboxing on mobile devices.
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Plain block body, no flex: the full-screen map must
          never be displaced by injected siblings (extensions,
          dev overlays), and the page itself never scrolls.
          suppressHydrationWarning covers attributes injected
          into <body> by browser extensions (e.g. Grammarly)
          before React hydrates; it only applies to this
          element's attributes, not to the app tree. */}
      <body
        className="h-full overflow-hidden"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
