import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-4xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Fooxchange</h1>
      <p className="mt-4 text-muted-foreground">
        Local dev safe mode is active. Core app routes are available while heavy homepage modules are isolated.
      </p>
      <div className="mt-8 flex gap-4">
        <Link href="/recipes" className="rounded-full bg-orange-500 px-6 py-3 font-medium text-white">
          Open Recipes
        </Link>
        <Link href="/camera-check" className="rounded-full border px-6 py-3 font-medium">
          Open Camera Check
        </Link>
      </div>
    </main>
  );
}
