import Link from "next/link";
import { Logo } from "./Logo";
import { WalletButton } from "./WalletButton";

export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
      <Link href="/" aria-label="Abeggi home">
        <Logo />
      </Link>
      <nav className="flex items-center gap-3">
        <Link href="/dashboard" className="hidden text-sm font-semibold hover:underline sm:block">
          My loans
        </Link>
        <WalletButton />
      </nav>
    </header>
  );
}
