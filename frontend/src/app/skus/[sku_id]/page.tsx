import { SkuDetailPanel } from "@/components/SkuDetailPanel";

export default function SkuDetailPage({ params }: { params: { sku_id: string } }) {
  return <SkuDetailPanel skuId={params.sku_id.toUpperCase()} />;
}
