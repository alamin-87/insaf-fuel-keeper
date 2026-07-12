import { createFileRoute } from "@tanstack/react-router";
import { CylinderTracking } from "@/components/cylinder/CylinderTracking";

export const Route = createFileRoute("/cylinders/$id")({
  component: CylinderDetail,
});
function CylinderDetail() {
  const { id } = Route.useParams();
  return <CylinderTracking id={id} />;
}
