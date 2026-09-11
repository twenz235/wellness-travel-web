"use client";

import { ConfigProvider } from "antd";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#24657a",
          colorText: "#203b38",
          borderRadius: 16,
          fontFamily: "var(--font-body), system-ui, sans-serif",
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
