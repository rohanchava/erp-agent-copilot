import { fetchReorderRecommendations } from "@/lib/api";
import { ReorderPanel } from "@/components/ReorderPanel";

export default async function ReordersPage() {
  const recommendations = await fetchReorderRecommendations();
  return <ReorderPanel recommendations={recommendations} />;
}
