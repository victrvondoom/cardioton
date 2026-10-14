const KEYS = {
  phone: "user_phone",
  name: "user_name",
  voice: "user_voice",
  companionName: "user_companion_name",
} as const;

export const storage = {
  getPhone: () => localStorage.getItem(KEYS.phone) ?? "",
  getName: () => localStorage.getItem(KEYS.name) ?? "",
  getVoice: () => localStorage.getItem(KEYS.voice) ?? "ara",
  setVoice: (voice: string) => localStorage.setItem(KEYS.voice, voice),
  getCompanionName: () => localStorage.getItem(KEYS.companionName) ?? "Cora",
  setCompanionName: (name: string) =>
    localStorage.setItem(KEYS.companionName, name),
  setUser: (phone: string, name: string) => {
    localStorage.setItem(KEYS.phone, phone);
    localStorage.setItem(KEYS.name, name);
  },
  clear: () => {
    localStorage.removeItem(KEYS.phone);
    localStorage.removeItem(KEYS.name);
  },
};
