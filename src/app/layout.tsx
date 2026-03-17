import type { Metadata } from "next";
import { Syne, Instrument_Sans } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "700", "800"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sydney → Melbourne · Ultra 2026",
  description: "Road trip planner: Sydney → Albury → Melbourne for Ultra Australia 2026",
  openGraph: {
    title: "Sydney → Melbourne · Ultra 2026",
    description: "Road trip planner for Ultra Australia 2026",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${syne.variable} ${instrumentSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
