"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/grok_app__components_ui__button";
import { Input } from "@/components/ui/grok_app__components_ui__input";
import { PhoneInput } from "@/components/ui/phone-input";
import { ROUTES } from "@/lib/grok_app__lib__routes";
import { storage } from "@/lib/storage";
import { upsertUser } from "./grok_app__app_phone__actions";

export default function PhonePage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await upsertUser(phone.trim(), name.trim());
      storage.setUser(phone.trim(), name.trim());
      router.push(ROUTES.home);
    } finally {
      setLoading(false);
    }
  }

  const isValid = phone.trim() && name.trim();

  return (
    <main className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-6 px-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Set up your profile
          </h1>
          <p className="text-sm text-muted-foreground">
            Tell us a bit about yourself to get started.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-72">
          <Input
            type="text"
            placeholder="Your name"
            className="rounded-md"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
          <PhoneInput value={phone} onChange={setPhone} />
          <Button
            type="submit"
            className="w-full"
            disabled={!isValid || loading}
          >
            {loading ? "Saving..." : "Continue"}
          </Button>
        </form>
      </div>
    </main>
  );
}
