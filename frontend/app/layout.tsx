import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Importa la fuente
import "./globals.css"; // <-- 1. IMPORTA LOS ESTILOS DE TAILWIND

// Configura la fuente 'Inter' (la que pusiste en tu config)
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Reservas - Travel App",
  description: "Sistema de reservas de transporte",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      {/* 2. Carga Font Awesome (íconos) */}
      <head>
        <link 
          rel="stylesheet" 
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" 
        />
      </head>
      {/* 3. Aplica la fuente a todo el body */}
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}