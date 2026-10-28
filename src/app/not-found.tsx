import Link from "next/link";
import { Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-24">
      <Link href="/" aria-label="Pitchcraft home">
        <Logo />
      </Link>
      <p className="mt-16 font-mono text-sm text-faint">404</p>
      <h1 className="mt-2 font-serif text-3xl font-medium">Page not found</h1>
      <p className="mt-2 text-muted">
        The link may be mistyped, or the report it pointed to no longer exists.{" "}
        <Link href="/" className="text-foreground underline underline-offset-4">
          Back to the home page
        </Link>
        .
      </p>
    </main>
  );
}
