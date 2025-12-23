import type { Metadata } from "next";
import { ConfigProvider } from "antd";
import AppLayout from "@/components/Layout/AppLayout";
import { AgentsProvider } from "@/contexts/AgentsContext";
import { AuthProvider } from "@/contexts/AuthContext";
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
          <AuthProvider>
            <AgentsProvider>
              <AppLayout>{children}</AppLayout>
            </AgentsProvider>
          </AuthProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
