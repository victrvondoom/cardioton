"use client";

import {
  CircleDotDashed,
  LayoutDashboard,
  MessageCircleIcon,
  PhoneCallIcon,
  ScrollText,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDashboardChat } from "@/components/dashboard-chat-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/grok_app__components_ui__button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/grok_app__components_ui__tabs";
import { ROUTES } from "@/lib/grok_app__lib__routes";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { open, toggle } = useDashboardChat();

  if (pathname === ROUTES.landing || pathname === ROUTES.phone) {
    return null;
  }

  const startCall = () => {
    router.push(ROUTES.call(crypto.randomUUID()));
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur">
      <div className="flex h-14 items-center px-4">
        <Link
          href={ROUTES.landing}
          className="flex items-center gap-1.5 font-semibold tracking-tight"
        >
          <CircleDotDashed
            className="size-5"
            style={{ animation: "memento-spin 10s ease-in-out infinite" }}
          />
          Memento
        </Link>
        <div className="absolute left-1/2 -translate-x-1/2 hidden sm:block">
          <Tabs value={pathname}>
            <TabsList>
              <TabsTrigger value={ROUTES.dashboard} asChild>
                <Link
                  href={ROUTES.dashboard}
                  className="flex items-center gap-1.5"
                >
                  <LayoutDashboard className="size-3.5" />
                  Dashboard
                </Link>
              </TabsTrigger>
              <TabsTrigger value={ROUTES.personalization} asChild>
                <Link
                  href={ROUTES.personalization}
                  className="flex items-center gap-1.5"
                >
                  <SlidersHorizontal className="size-3.5" />
                  Personalization
                </Link>
              </TabsTrigger>
              <TabsTrigger value={ROUTES.caretaker} asChild>
                <Link
                  href={ROUTES.caretaker}
                  className="flex items-center gap-1.5"
                >
                  <UserRound className="size-3.5" />
                  Caretaker
                </Link>
              </TabsTrigger>
              <TabsTrigger value={ROUTES.transcripts} asChild>
                <Link
                  href={ROUTES.transcripts}
                  className="flex items-center gap-1.5"
                >
                  <ScrollText className="size-3.5" />
                  Call History
                </Link>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            onClick={startCall}
            size="sm"
            variant="default"
            className="gap-1.5"
          >
            <PhoneCallIcon className="size-3.5" />
            Call
          </Button>
          {pathname === ROUTES.dashboard && (
            <Button
              onClick={toggle}
              size="sm"
              variant={open ? "secondary" : "outline"}
              className="gap-1.5"
            >
              <MessageCircleIcon className="size-3.5" />
              Ask
            </Button>
          )}
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
