import type { Metadata } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Wellness Travel",
  description: "ค้นหาธรรมชาติที่เหมาะกับอากาศและความชอบของคุณ",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
