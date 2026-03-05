import { SkuDetailPanel } from "@/components/SkuDetailPanel";

export default async function SkuDetailPage({ params }: { params: Promise<{ sku_id: string }> }) {
  const { sku_id } = await params;
  return <SkuDetailPanel skuId={sku_id.toUpperCase()} />;
}
