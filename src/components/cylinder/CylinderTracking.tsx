import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cylinderService } from "@/services/cylinder.service";
import { customerService } from "@/services/customer.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/common/PageHeader";
import { formatDateTime } from "@/utils/formatters";
import type { CylinderMovementType } from "@/types";

const types: CylinderMovementType[] = ["received", "issued", "returned", "refilled", "transferred", "damaged"];

export function CylinderTracking({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data: cylinder, isLoading, isFetched } = useQuery({
    queryKey: ["cylinders", id],
    queryFn: () => cylinderService.get(id),
  });
  const { data: movements = [] } = useQuery({
    queryKey: ["cylinders", id, "movements"],
    queryFn: () => cylinderService.getMovements(id),
    enabled: !!cylinder,
  });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: customerService.list });

  const [type, setType] = useState<CylinderMovementType>("issued");
  const [toLocation, setToLocation] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");

  const addMv = useMutation({
    mutationFn: () => {
      if (type === "issued" && !customerId) throw new Error("Select a customer for issued cylinders");
      return cylinderService.addMovement({
        cylinderId: id, type, fromLocation: cylinder?.location, toLocation: toLocation || undefined,
        customerId: customerId || undefined, notes, by: "Operator",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cylinders"] });
      qc.invalidateQueries({ queryKey: ["cylinders", id] });
      qc.invalidateQueries({ queryKey: ["cylinders", id, "movements"] });
      toast.success("Movement recorded");
      setToLocation(""); setCustomerId(""); setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (isFetched && !cylinder) return <div className="p-6 text-sm text-destructive">Cylinder not found.</div>;
  if (!cylinder) return null;

  return (
    <div>
      <PageHeader
        title={`Cylinder ${cylinder.serialNumber}`}
        description={`Capacity ${cylinder.capacity} · Currently at ${cylinder.location}`}
        actions={<Badge>{cylinder.status}</Badge>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Movement History</CardTitle></CardHeader>
          <CardContent>
            {movements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No movements yet.</p>
            ) : (
              <ol className="space-y-3">
                {movements.map((m) => (
                  <li key={m.id} className="flex gap-3 border-l-2 border-primary/40 pl-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{m.type}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDateTime(m.timestamp)}</span>
                      </div>
                      <p className="mt-1 text-sm">
                        {m.fromLocation && <span>From <b>{m.fromLocation}</b></span>}
                        {m.toLocation && <span> → <b>{m.toLocation}</b></span>}
                      </p>
                      {m.notes && <p className="text-xs text-muted-foreground">{m.notes}</p>}
                      <p className="text-xs text-muted-foreground">By {m.by}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Record Movement</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as CylinderMovementType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To Location</Label>
              <Input value={toLocation} onChange={(e) => setToLocation(e.target.value)} placeholder="Warehouse / Customer / Plant" />
            </div>
            <div className="space-y-1.5">
              <Label>Customer (if applicable)</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button className="w-full" onClick={() => addMv.mutate()} disabled={addMv.isPending}>Add Movement</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
