"use client";

import * as React from "react";
import { cn } from "@/lib/grok_app__lib__utils";

interface PhoneInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function PhoneInput({
  value = "",
  onChange,
  placeholder = "(555) 000-0000",
  className,
}: PhoneInputProps) {
  const [local, setLocal] = React.useState(value);

  function handleLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLocal(e.target.value);
    onChange?.(`+1${e.target.value}`);
  }

  return (
    <div
      className={cn(
        "flex h-9 w-full overflow-hidden rounded-md border border-transparent bg-input/50 transition-[color,box-shadow,background-color] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
        className
      )}
    >
      <span className="flex items-center pl-3 pr-1 text-sm text-muted-foreground select-none">
        🇺🇸 +1
      </span>
      <input
        type="tel"
        placeholder={placeholder}
        value={local}
        onChange={handleLocalChange}
        autoComplete="tel-national"
        className="min-w-0 flex-1 bg-transparent py-1 pr-3 text-base outline-none placeholder:text-muted-foreground md:text-sm"
      />
    </div>
  );
}
