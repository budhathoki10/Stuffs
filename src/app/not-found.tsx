import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-muted">The page or report you&apos;re looking for doesn&apos;t exist.</p>
      <ButtonLink href="/">Go home</ButtonLink>
    </main>
  );
}
