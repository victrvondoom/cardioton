import { CircleDotDashed } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/grok_app__components_ui__button";
import { ROUTES } from "@/lib/grok_app__lib__routes";

function MementoLogo() {
  return (
    <div className="flex items-center gap-1.5 font-semibold tracking-tight text-white">
      <CircleDotDashed
        className="size-5"
        style={{ animation: "memento-spin 10s ease-in-out infinite" }}
      />
      Memento
    </div>
  );
}

function Corner({ className }: { className?: string }) {
  return <div className={className} aria-hidden="true" />;
}

export default function LandingPage() {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black text-white [--landing-gutter:clamp(1.875rem,5vw,3.5rem)]">
      <Image
        src="/backgrounds/background.png"
        alt=""
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />

      <div
        className="landing-frame relative z-10 grid h-full w-full"
        style={{
          gridTemplateColumns:
            "var(--landing-gutter) minmax(0, 1fr) var(--landing-gutter)",
          gridTemplateRows: "auto 1fr auto",
        }}
      >
        <Corner className="h-[var(--landing-gutter)] border-r border-b border-white/8" />
        <header className="flex h-[var(--landing-gutter)] items-center justify-center sm:justify-start border-b border-white/8 px-8 sm:px-10">
          <MementoLogo />
        </header>
        <Corner className="h-[var(--landing-gutter)] border-b border-l border-white/8" />

        <div className="border-r border-white/8" aria-hidden="true" />
        <main className="relative flex flex-col items-center justify-center px-6 py-8 sm:px-10">
          <div className="flex max-w-2xl flex-col items-center gap-6 text-center">
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              Daily check-ins that notice the changes families fear missing.
            </h1>
            <p className="max-w-lg text-balance text-sm leading-relaxed text-white/70 sm:text-base">
              A warm morning call that learns your personal baseline — so you,
              your family, and your doctor stay ahead of changes, not behind
              them.
            </p>
            <Button asChild size="lg" className="mt-2 min-w-44">
              <Link href={ROUTES.phone}>Get started</Link>
            </Button>
          </div>
        </main>
        <div className="border-l border-white/8" aria-hidden="true" />

        <Corner className="h-[var(--landing-gutter)] border-r border-t border-white/8" />
        <footer
          className="h-[var(--landing-gutter)] border-t border-white/8"
          aria-hidden="true"
        />
        <Corner className="h-[var(--landing-gutter)] border-l border-t border-white/8" />
      </div>
    </div>
  );
}
