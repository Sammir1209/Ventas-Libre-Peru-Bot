import './globals.css';

export const metadata = {
  title: 'Ventas Libres Perú — Command Center Enterprise',
  description: 'Panel de Administración y Control Centralizado de Bots, Escrow, GBan y Sub-Bots',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
