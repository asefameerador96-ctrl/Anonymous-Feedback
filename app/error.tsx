"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-8 text-center">
      <p className="mono text-xs uppercase tracking-widest text-clay mb-4">
        Something went wrong
      </p>
      <h1 className="serif text-4xl md:text-5xl mb-6">
        An unexpected error occurred
      </h1>
      <p className="opacity-70 mb-10 max-w-sm">
        Please try again. If the problem persists, come back in a little while.
      </p>
      <button className="btn" onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}
