import { AnomalyPanel } from "@/components/AnomalyPanel";
import { fetchAnomalies } from "@/lib/api";

export default async function AnomaliesPage() {
  const anomalies = await fetchAnomalies(30, 5);
  return <AnomalyPanel anomalies={anomalies} />;
}
