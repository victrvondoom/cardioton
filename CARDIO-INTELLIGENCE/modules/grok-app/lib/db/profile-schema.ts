export const GROK_VOICES = ["eve", "ara", "rex", "sal", "leo"] as const;
export type GrokVoice = (typeof GROK_VOICES)[number];

export const VOICE_META: Record<
  GrokVoice,
  { label: string; gender: string; description: string }
> = {
  eve: { label: "Eve", gender: "Female", description: "Energetic, upbeat" },
  ara: { label: "Ara", gender: "Female", description: "Warm, friendly" },
  rex: { label: "Rex", gender: "Male", description: "Confident, clear" },
  sal: { label: "Sal", gender: "Neutral", description: "Smooth, balanced" },
  leo: { label: "Leo", gender: "Male", description: "Authoritative, strong" },
};

export type StoredProfile = {
  age?: number;
  companionName?: string;
  voice?: GrokVoice;
  routine?: {
    wakeTime: string;
    breakfastHabit: string;
    medication: string;
  };
  careCircle?: {
    caregiver: string;
    clinician?: string;
  };
  interests?: string[];
};
