import type { Metadata } from "next";
import { ConfigProvider } from "antd";
import AppLayout from "@/components/Layout/AppLayout";
import { AgentsProvider } from "@/contexts/AgentsContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Android Farm - Agent Control Panel",
  description: "Control panel for Android Farm Agent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body>
        <ConfigProvider>
          <AgentsProvider>
            <AppLayout>{children}</AppLayout>
          </AgentsProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
