'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import MainContent from '@/components/MainContent';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <MainContent>{children}</MainContent>
    </>
  );
}
