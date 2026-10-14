Memento is a daily AI phone call for dementia patients. It feels like a friend checking in, but invisibly runs clinical cognitive assessments in the background, compares results to the patient's own baseline, and alerts families only when something actually changes.

## How it works

1. **Daily call** — A server-side Next.js route resolves the patient profile, recalls memories from past calls (via Supermemory), and mints a short-lived xAI ephemeral token. The browser connects directly to the xAI Realtime API using that token, so neither API key ever reaches the client.
2. **The conversation** — Grok Voice (`grok-voice-think-fast-1.1`) plays the companion "Cora." A private agenda driver feeds her hidden cues that steer the conversation through clinically-required beats (fluency, story recall, naming, orientation, mood) without the patient ever knowing they're being assessed.
3. **Post-call pipeline** — After the call, the transcript runs through two passes: deterministic linguistic analysis (lexical diversity, repetition, stop-word fraction) and an xAI judgment pass that extracts scored KPIs (recall accuracy, orientation score, safety flags, etc.). Results are stored as a single row in Neon Postgres.
4. **Memory** — Key things the patient shared are written back to Supermemory so the next call feels continuous — Cora "remembers" what they told her before.
5. **Family dashboard** — A Next.js dashboard surfaces KPI trends over time with an AI chat interface (also backed by xAI) so families can ask plain-English questions about their loved one's recent calls.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deployment

Live at: [grok-app-sf.vercel.app](https://grok-app-sf.vercel.app)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
