"use client";

import { Bot, CheckIcon, Coffee, Heart, Sparkles, User } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/grok_app__components_ui__button";
import { Input } from "@/components/ui/grok_app__components_ui__input";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/grok_app__components_ui__select";
import {
  GROK_VOICES,
  type GrokVoice,
  type StoredProfile,
  VOICE_META,
} from "@/lib/db/profile-schema";

const VOICE_GRADIENTS: Record<GrokVoice, string> = {
  eve: "from-orange-400 to-pink-500",
  ara: "from-rose-400 to-purple-500",
  rex: "from-blue-400 to-cyan-500",
  sal: "from-teal-400 to-green-500",
  leo: "from-violet-500 to-indigo-600",
};

import { storage } from "@/lib/storage";

const DEFAULT_PROFILE: StoredProfile = {
  age: undefined,
  companionName: "Cora",
  voice: "ara",
  routine: { wakeTime: "", breakfastHabit: "", medication: "" },
  careCircle: { caregiver: "", clinician: "" },
  interests: [""],
};

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[280px_1fr] gap-12 px-8 py-4">
      <div>
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">{title}</h2>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-sm font-medium text-muted-foreground"
    >
      {children}
    </label>
  );
}

export default function PersonalizationPage() {
  const [name, setName] = useState("");
  const [profile, setProfile] = useState<StoredProfile>(DEFAULT_PROFILE);
  const [interestKeys, setInterestKeys] = useState(["initial"]);

  useEffect(() => {
    const stored = storage.getVoice();
    const voice = (GROK_VOICES as readonly string[]).includes(stored)
      ? (stored as GrokVoice)
      : "ara";
    setProfile((p) => ({
      ...p,
      voice,
      companionName: storage.getCompanionName(),
    }));
  }, []);

  function setRoutine(
    field: keyof NonNullable<StoredProfile["routine"]>,
    value: string,
  ) {
    setProfile((p) => ({
      ...p,
      routine: {
        wakeTime: p.routine?.wakeTime ?? "",
        breakfastHabit: p.routine?.breakfastHabit ?? "",
        medication: p.routine?.medication ?? "",
        [field]: value,
      },
    }));
  }

  function setCareCircle(
    field: keyof NonNullable<StoredProfile["careCircle"]>,
    value: string,
  ) {
    setProfile((p) => ({
      ...p,
      careCircle: { caregiver: "", ...p.careCircle, [field]: value },
    }));
  }

  function setInterest(index: number, value: string) {
    setProfile((p) => {
      const interests = [...(p.interests ?? [""])];
      interests[index] = value;
      return { ...p, interests };
    });
  }

  function addInterest() {
    setInterestKeys((keys) => [...keys, crypto.randomUUID()]);
    setProfile((p) => ({ ...p, interests: [...(p.interests ?? []), ""] }));
  }

  function removeInterest(index: number) {
    setInterestKeys((keys) => keys.filter((_, i) => i !== index));
    setProfile((p) => {
      const interests = (p.interests ?? [""]).filter((_, i) => i !== index);
      return { ...p, interests: interests.length ? interests : [""] };
    });
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b px-8 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Personalization
          </h1>
          <p className="text-sm text-muted-foreground">
            Set up the companion for the person who will be taking the calls.
          </p>
        </div>
        <Button disabled>Save changes</Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="divide-y">
          <Section
            icon={User}
            title="About them"
            description="Basic details the companion will use to address them during calls."
          >
            <div className="flex gap-4">
              <div className="flex-1">
                <FieldLabel htmlFor="preferred-name">Preferred name</FieldLabel>
                <Input
                  id="preferred-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What should Cora call them?"
                />
              </div>
              <div>
                <FieldLabel htmlFor="patient-age">Age</FieldLabel>
                <Input
                  id="patient-age"
                  type="number"
                  min={0}
                  max={120}
                  value={profile.age ?? ""}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      age: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                  placeholder="—"
                  className="w-24"
                />
              </div>
            </div>
          </Section>

          <Section
            icon={Bot}
            title="The companion"
            description="Choose how the AI companion sounds and what name it uses during calls."
          >
            <div className="space-y-6">
              <div className="max-w-xs">
                <FieldLabel htmlFor="companion-name">
                  Companion's name
                </FieldLabel>
                <Input
                  id="companion-name"
                  value={profile.companionName ?? "Cora"}
                  onChange={(e) => {
                    storage.setCompanionName(e.target.value);
                    setProfile((p) => ({
                      ...p,
                      companionName: e.target.value,
                    }));
                  }}
                  placeholder="Cora"
                />
              </div>

              <div className="max-w-xs">
                <FieldLabel htmlFor="companion-voice">Voice</FieldLabel>
                <Select
                  value={profile.voice ?? "ara"}
                  onValueChange={(v) => {
                    storage.setVoice(v);
                    setProfile((p) => ({ ...p, voice: v as GrokVoice }));
                  }}
                >
                  <SelectTrigger id="companion-voice">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`size-4 shrink-0 rounded-full bg-gradient-to-br ${VOICE_GRADIENTS[profile.voice ?? "ara"]}`}
                      />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {GROK_VOICES.map((v) => {
                      const meta = VOICE_META[v];
                      return (
                        <SelectPrimitive.Item
                          key={v}
                          value={v}
                          className="relative flex w-full cursor-default items-center gap-2.5 rounded-2xl py-2 pr-8 pl-3 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                        >
                          <span
                            className={`size-4 shrink-0 self-start mt-0.5 rounded-full bg-gradient-to-br ${VOICE_GRADIENTS[v]}`}
                          />
                          <div className="flex flex-col">
                            <SelectPrimitive.ItemText>
                              <span className="font-medium">{meta.label}</span>
                            </SelectPrimitive.ItemText>
                            <span className="text-muted-foreground text-sm">
                              {meta.description}
                            </span>
                          </div>
                          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                            <SelectPrimitive.ItemIndicator>
                              <CheckIcon className="size-4" />
                            </SelectPrimitive.ItemIndicator>
                          </span>
                        </SelectPrimitive.Item>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Section>

          <Section
            icon={Coffee}
            title="Morning routine"
            description="Their usual morning habits. The companion uses these as natural conversation anchors during the call."
          >
            <div className="space-y-4">
              <div>
                <FieldLabel htmlFor="wake-time">Wake time</FieldLabel>
                <Input
                  id="wake-time"
                  value={profile.routine?.wakeTime ?? ""}
                  onChange={(e) => setRoutine("wakeTime", e.target.value)}
                  placeholder="e.g. around 7 in the morning"
                />
              </div>
              <div>
                <FieldLabel htmlFor="breakfast-habit">
                  Breakfast habit
                </FieldLabel>
                <Input
                  id="breakfast-habit"
                  value={profile.routine?.breakfastHabit ?? ""}
                  onChange={(e) => setRoutine("breakfastHabit", e.target.value)}
                  placeholder="e.g. tea and toast"
                />
              </div>
              <div>
                <FieldLabel htmlFor="morning-medication">
                  Morning medication
                </FieldLabel>
                <Input
                  id="morning-medication"
                  value={profile.routine?.medication ?? ""}
                  onChange={(e) => setRoutine("medication", e.target.value)}
                  placeholder="e.g. blue pill after breakfast"
                />
              </div>
            </div>
          </Section>

          <Section
            icon={Heart}
            title="Support circle"
            description="People the companion can mention during calls — so they feel connected to the people around them."
          >
            <div className="space-y-4">
              <div>
                <FieldLabel htmlFor="caregiver-name">Caregiver</FieldLabel>
                <Input
                  id="caregiver-name"
                  value={profile.careCircle?.caregiver ?? ""}
                  onChange={(e) => setCareCircle("caregiver", e.target.value)}
                  placeholder="e.g. daughter Sarah"
                />
              </div>
              <div>
                <FieldLabel htmlFor="doctor-name">Doctor</FieldLabel>
                <Input
                  id="doctor-name"
                  value={profile.careCircle?.clinician ?? ""}
                  onChange={(e) => setCareCircle("clinician", e.target.value)}
                  placeholder="e.g. Dr. Lee"
                />
              </div>
            </div>
          </Section>

          <Section
            icon={Sparkles}
            title="What they enjoy"
            description="Topics the companion will bring up to make calls feel personal and familiar."
          >
            <div className="flex flex-wrap gap-2">
              {(profile.interests ?? [""]).map((interest, i) => (
                <div key={interestKeys[i]} className="flex items-center gap-1">
                  <Input
                    value={interest}
                    onChange={(e) => setInterest(i, e.target.value)}
                    placeholder="e.g. gardening…"
                    className="w-44"
                  />
                  {(profile.interests ?? [""]).length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      type="button"
                      onClick={() => removeInterest(i)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={addInterest}
                className="self-center"
              >
                + Add
              </Button>
            </div>
          </Section>
        </div>
      </div>
    </main>
  );
}
