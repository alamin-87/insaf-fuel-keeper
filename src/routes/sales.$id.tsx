import { createFileRoute } from "@tanstack/react-router";
import { InvoiceView } from "@/components/sales/InvoiceView";

export const Route = createFileRoute("/sales/$id")({
  component: SalesDetail,
});
function SalesDetail() {
  const { id } = Route.useParams();
  return <InvoiceView id={id} />;
}
