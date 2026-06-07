import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-8 text-center">
      <p className="mono text-xs uppercase tracking-widest text-clay mb-4">404</p>
      <h1 className="serif text-5xl md:text-6xl mb-6">Page not found</h1>
      <p className="opacity-70 mb-10 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link href="/" className="btn">
        Back to Anonvey
      </Link>
    </main>
  );
}
