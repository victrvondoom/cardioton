import Dashboard from "@/components/safetyconnect__src_components__Dashboard";
import { globalStats, pharmacyLocations } from "@/lib/safetyconnect__src_lib__queries";

// Live dashboard reads ClickHouse at request time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [stats, locations] = await Promise.all([
    globalStats(),
    pharmacyLocations(),
  ]);

  return (
    <main className="min-h-screen bg-slate-50">
      <Dashboard stats={stats} locations={locations} />
    </main>
  );
}
