import "./globals.css";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Figtree } from "next/font/google";
import { Suspense } from "react";
import GrainientLoader from "@/components/background/useGrainient";
import AccentSync from "@/components/startpage/AccentSync";

export const metadata: Metadata = {
  title: "xisz.dev",
  description: "world's worst startpage",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#8DA3B9",
};

const mono = IBM_Plex_Mono({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
});

const figtree = Figtree({
  weight: "variable",
  subsets: ["latin"],
  variable: "--font-figtree",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${mono.variable} ${figtree.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply the saved accent color before first paint (see settings.ts). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var c=JSON.parse(localStorage.getItem("whimsy-settings")||"{}").accentColor;if(c){var r=document.documentElement;r.style.setProperty("--accent",c);r.dataset.accent=""}}catch(e){}`,
          }}
        />
      </head>
      <body>
        <div className="text-paradise-fg min-h-screen overflow-x-hidden flex items-center justify-center">
          <div className="fixed left-0 top-0 w-screen h-screen bg-paradise-bg -z-30" />
          <AccentSync />
          <Suspense>
            <GrainientLoader />
          </Suspense>
          <div className="w-full max-w-5xl px-6">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
