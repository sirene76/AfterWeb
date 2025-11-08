export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-black">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 px-6 py-32 text-center">
        <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-1 text-sm font-semibold uppercase tracking-[0.3em] text-blue-200">
          AfterWeb
        </span>
        <h1 className="text-4xl font-semibold leading-tight text-zinc-50 sm:text-6xl">
          Upload → Optimize → Deploy → Maintain
        </h1>
        <p className="max-w-2xl text-lg text-zinc-300 sm:text-xl">
          Ship modern performance without the rebuild. AfterWeb ingests your legacy
          website, analyzes SEO and structure, and prepares it for one-click deployment
          to the cloud.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <a
            href="/dashboard"
            className="rounded-full bg-blue-600 px-8 py-3 text-base font-medium text-white shadow-lg shadow-blue-600/40 transition hover:bg-blue-500"
          >
            View Dashboard
          </a>
          <a
            href="#"
            className="rounded-full border border-zinc-700 px-8 py-3 text-base font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
          >
            Talk to Sales
          </a>
        </div>
        <div className="grid w-full gap-6 rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-left sm:grid-cols-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Upload</h2>
            <p className="mt-2 text-sm text-zinc-300">
              Drag-and-drop your existing website as a .zip or connect directly to your
              current host.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Analyze</h2>
            <p className="mt-2 text-sm text-zinc-300">
              Our SEO and structure engine maps every page, script, and opportunity for
              improvement.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Deploy</h2>
            <p className="mt-2 text-sm text-zinc-300">
              Launch to Cloudflare Pages automatically and monitor performance from one
              dashboard.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
