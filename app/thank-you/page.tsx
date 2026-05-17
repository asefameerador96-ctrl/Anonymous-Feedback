export default function ThankYou() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-8 text-center">
      <div className="fade-up max-w-lg">
        <p className="mono text-xs uppercase tracking-widest text-sage mb-6">
          Received
        </p>
        <h1 className="serif text-5xl md:text-6xl leading-tight mb-8">
          Thank you for
          <br />
          <em className="text-clay">being honest.</em>
        </h1>
        <p className="opacity-80 leading-relaxed mb-12">
          Your response is now part of an aggregate that no one — including the
          people running this survey — can trace back to you. It will only be
          visible to leadership once at least five colleagues have responded
          for the same manager or topic.
        </p>
        <a href="/" className="mono text-xs uppercase tracking-widest underline-hand">
          Return home
        </a>
      </div>
    </main>
  );
}
