import Link from "next/link";

const REASON_COPY: Record<string, { title: string; body: string }> = {
  signin_failed: {
    title: "HANDSHAKE REFUSED",
    body: "The bunker could not raise GitHub on the line. The transmitter is cold.",
  },
  missing_code: {
    title: "EMPTY DISPATCH",
    body: "GitHub sent you back without a token. The handshake never completed.",
  },
  exchange_failed: {
    title: "TOKEN REJECTED",
    body: "The 404 Lands rejected the credentials. The session could not be opened.",
  },
};

const FALLBACK = {
  title: "TRANSMISSION INTERRUPTED",
  body: "Something went wrong on the way back from GitHub.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const copy = (reason && REASON_COPY[reason]) || FALLBACK;

  return (
    <main className="flex-1 w-full h-full flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-6 border border-[#E6DFC8]/20 p-6">
        <div className="text-xs uppercase tracking-widest text-[#E6DFC8]/60">
          {"// auth :: error"}
        </div>
        <h1 className="text-2xl font-mono">{copy.title}</h1>
        <p className="text-sm text-[#E6DFC8]/80 leading-relaxed">{copy.body}</p>
        {reason ? (
          <p className="text-[10px] uppercase tracking-widest text-[#E6DFC8]/40">
            code: {reason}
          </p>
        ) : null}
        <Link
          href="/"
          className="inline-block text-sm underline underline-offset-4 hover:text-white"
        >
          → return to the bunker
        </Link>
      </div>
    </main>
  );
}
