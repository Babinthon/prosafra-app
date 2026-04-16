import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProSafra — O que realmente vale seu grão",
  description: "Plataforma de inteligência de preço para produtores de grãos no Brasil",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
