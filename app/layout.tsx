import type { Metadata } from "next";
import { App as AntdApp, ConfigProvider, theme } from "antd";
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
        <ConfigProvider
          theme={{
            algorithm: theme.defaultAlgorithm,
            token: {
              // Сучасна кольорова схема з градієнтами
              colorPrimary: '#1890ff',
              colorSuccess: '#52c41a',
              colorWarning: '#faad14',
              colorError: '#ff4d4f',
              colorInfo: '#1890ff',
              
              // Покращені сірі тони
              colorBgBase: '#ffffff',
              colorBgContainer: '#ffffff',
              colorBgElevated: '#ffffff',
              colorBgLayout: 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%)',
              
              // Строгі текстові кольори
              colorText: '#0a0e27',
              colorTextSecondary: '#4a5568',
              colorTextTertiary: '#718096',
              
              // Строгі границі
              colorBorder: '#e2e8f0',
              colorBorderSecondary: '#edf2f7',
              
              // Покращена типографіка
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              fontSize: 14,
              fontSizeHeading1: 32,
              fontSizeHeading2: 22,
              fontSizeHeading3: 20,
              fontWeightStrong: 600,
              lineHeight: 1.5,
              
              // Сучасні радіуси
              borderRadius: 8,
              borderRadiusLG: 12,
              borderRadiusSM: 6,
              
              // Покращені тіні
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
              boxShadowSecondary: '0 2px 8px rgba(0, 0, 0, 0.06)',
              boxShadowTertiary: '0 1px 4px rgba(0, 0, 0, 0.04)',
            },
            components: {
              Layout: {
                bodyBg: 'transparent',
                headerBg: '#ffffff',
                siderBg: '#ffffff',
              },
              Menu: {
                itemSelectedBg: 'linear-gradient(90deg, #e6f7ff 0%, #f0f9ff 100%)',
                itemHoverBg: '#f8fafc',
                itemActiveBg: '#e6f7ff',
                itemSelectedColor: '#1890ff',
                subMenuItemBg: '#fafbfc',
                itemMarginInline: 8,
                itemBorderRadius: 8,
                itemHeight: 44,
                iconSize: 18,
                fontSize: 14,
                fontWeightStrong: 500,
              },
              Card: {
                borderRadiusLG: 12,
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                paddingLG: 28,
                headerBg: '#fafbfc',
                padding: 24,
              },
              Button: {
                borderRadius: 8,
                fontWeight: 500,
                boxShadow: 'none',
                paddingInline: 20,
                paddingBlock: 8,
                fontSize: 14,
                controlHeight: 40,
                controlHeightLG: 48,
                controlHeightSM: 32,
              },
              Input: {
                borderRadius: 8,
                paddingBlock: 8,
                paddingInline: 12,
              },
              Select: {
                borderRadius: 8,
              },
              Table: {
                borderRadius: 8,
                headerBg: '#fafbfc',
                headerColor: '#0a0e27',
              },
            },
          }}
        >
          <AntdApp>
            <AuthProvider>
              <AgentsProvider>
                <AppLayout>{children}</AppLayout>
              </AgentsProvider>
            </AuthProvider>
          </AntdApp>
        </ConfigProvider>
      </body>
    </html>
  );
}
