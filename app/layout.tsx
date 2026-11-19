import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { content } from "@/lib/content";
import { WaitlistFlashProvider } from "./_sections/waitlist/FlashContext";
import "./globals.css";
import { decodeFlash, WAITLIST_FLASH_COOKIE } from "@/lib/waitlist-flash";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  // The variable font covers weights 600 and 800. The optical-size axis gives
  // large headings the tighter letterforms the comps use.
  axes: ["opsz"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: content.site.title,
  description: content.site.description,
};

// The layout reads the cookie that carries a no-JavaScript waitlist result, so
// every page renders per request. A page with a prerendered shell and a deferred
// part cannot answer a no-JavaScript form post with a full document. See
// lib/waitlist-flash.ts.
export const instant = false;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const flash = decodeFlash((await cookies()).get(WAITLIST_FLASH_COOKIE)?.value);

  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <WaitlistFlashProvider state={flash}>{children}</WaitlistFlashProvider>
      </body>
    </html>
  );
}
