import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./grok_app__app__globals.css";
import { Toaster } from "sonner";
import { DashboardChatProvider } from "@/components/dashboard-chat-provider";
import { Navbar } from "@/components/navbar";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/grok_app__components_ui__tooltip";
import { UserGuard } from "@/components/user-guard";
import { cn } from "@/lib/grok_app__lib__utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Grok App",
  description: "Grok dementia app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable,
      )}
    >
      <body className="h-full flex flex-col overflow-hidden">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <UserGuard>
              <DashboardChatProvider>
                <Navbar />
                {children}
              </DashboardChatProvider>
            </UserGuard>
            <Toaster richColors position="bottom-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
