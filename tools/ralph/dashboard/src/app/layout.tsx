import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import { ToastProvider } from "@/components/toast-provider"
import { TaskProvider } from "@/components/task-provider"
import { QueryProvider } from "@/lib/query"
import { SSEProvider } from "@/components/sse-provider"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Ralph Dashboard",
  description: "PRD viewer for Ralph autonomous development loop",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
          themes={['light', 'dark', 'cyber-light', 'cyber-dark', 'system']}
        >
          <QueryProvider>
            <SSEProvider>
              <ToastProvider>
                <TaskProvider>
                  <div className="flex h-screen bg-background text-foreground">
                    <Sidebar />
                    <main className="flex-1 overflow-auto pt-16 md:pt-0">
                      {children}
                    </main>
                  </div>
                </TaskProvider>
              </ToastProvider>
            </SSEProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
