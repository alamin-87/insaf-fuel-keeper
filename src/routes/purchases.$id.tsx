import { createFileRoute } from "@tanstack/react-router";
import { PurchaseView } from "@/components/purchase/PurchaseView";

export const Route = createFileRoute("/purchases/$id")({
  head: () => ({ meta: [{ title: "Purchase Order · Insaf Gas Corp" }] }),
  component: PurchaseDetail,
});

function PurchaseDetail() {
  const { id } = Route.useParams();
  return <PurchaseView id={id} />;
}
