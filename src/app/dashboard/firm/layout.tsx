import { FirmSubNav } from "./FirmSubNav";

export default function FirmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <FirmSubNav />
      {children}
    </div>
  );
}
