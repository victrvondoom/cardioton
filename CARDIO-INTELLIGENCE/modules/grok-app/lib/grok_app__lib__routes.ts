export const ROUTES = {
  home: "/",
  landing: "/landing",
  agent: "/agent",
  dashboard: "/dashboard",
  personalization: "/personalization",
  caretaker: "/caretaker",
  transcripts: "/transcripts",
  phone: "/phone",
  call: (id: string) => `/call/${id}`,
} as const;
