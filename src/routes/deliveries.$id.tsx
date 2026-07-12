import { createFileRoute } from "@tanstack/react-router";
import { DeliveryChallan } from "@/components/delivery/DeliveryChallan";

export const Route = createFileRoute("/deliveries/$id")({
  component: DeliveryDetail,
});
function DeliveryDetail() {
  const { id } = Route.useParams();
  return <DeliveryChallan id={id} />;
}
