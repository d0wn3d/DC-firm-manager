import { BookSubNav } from "./BookSubNav";

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <BookSubNav />
      {children}
    </div>
  );
}
