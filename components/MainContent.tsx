export default function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto px-4 py-4 pb-20 max-w-lg">
      {children}
    </main>
  );
}
