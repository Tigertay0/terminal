import { Wordmark } from "@/components/BrandMark";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-6">
      <div className="max-w-sm">
        <Wordmark size={20} />
        <h1 className="mt-8 text-2xl font-medium text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-dim">This address has no screen in the terminal.</p>
        <a href="/" className="mt-6 inline-flex h-10 items-center px-4 rounded-md border border-border text-sm text-foreground hover:bg-raised transition-colors">
          Back to the terminal
        </a>
      </div>
    </div>
  );
}
