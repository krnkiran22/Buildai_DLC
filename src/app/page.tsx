import { OperationsDashboard } from "@/components/operations-dashboard";
import { getBackendHealth, getOperationsSnapshot } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [snapshot, health] = await Promise.all([
    getOperationsSnapshot(),
    getBackendHealth(),
  ]);

  return <OperationsDashboard snapshot={snapshot} health={health} />;
}
