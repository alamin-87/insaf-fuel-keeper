import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { customerService } from "@/services/customer.service";
import { productService } from "@/services/product.service";
import { salesService } from "@/services/sales.service";
import { deliveryService } from "@/services/delivery.service";
import { deliverySchema } from "@/utils/validators";
import { genOrderNo } from "@/utils/helpers";
import type { LineItem } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/common/PageHeader";

export function ChallanForm({ salesOrderId: initialSoId }: { salesOrderId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: customerService.list });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: productService.list });
  const { data: sales = [] } = useQuery({ queryKey: ["sales"], queryFn: salesService.list });

  const openOrders = sales.filter((s) => s.status === "confirmed" || s.status === "invoiced");

  const [salesOrderId, setSalesOrderId] = useState(initialSoId || "");
  const [customerId, setCustomerId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);

  useEffect(() => {
    if (!salesOrderId) return;
    const so = sales.find((s) => s.id === salesOrderId);
    if (!so) return;
    setCustomerId(so.customerId);
    setItems(so.items.map((it) => ({ ...it })));
  }, [salesOrderId, sales]);

  const addItem = () => {
    const p = products[0];
    if (!p) return;
    setItems([...items, { productId: p.id, productName: p.name, quantity: 1, price: p.price, taxRate: p.taxRate }]);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = deliverySchema.safeParse({
        customerId,
        salesOrderId: salesOrderId || undefined,
        driverName,
        vehicleNo,
        items,
      });
      if (!parsed.success) throw new Error(parsed.error.errors[0]?.message || "Invalid form");
      const c = customers.find((x) => x.id === customerId);
      if (!c) throw new Error("Select customer");
      return deliveryService.create({
        challanNo: genOrderNo("DC"),
        customerId,
        customerName: c.name,
        salesOrderId: salesOrderId || undefined,
        driverName,
        vehicleNo,
        items,
        status: "pending",
        date: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      toast.success("Challan created");
      navigate({ to: "/deliveries" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="New Delivery Challan" />
      <Card><CardContent className="pt-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Sales Order (optional)</Label>
            <Select
              value={salesOrderId || "__none"}
              onValueChange={(v) => {
                if (v === "__none") {
                  setSalesOrderId("");
                  return;
                }
                setSalesOrderId(v);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Link sales order" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No linked order</SelectItem>
                {openOrders.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.orderNo} · {s.customerName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId} disabled={!!salesOrderId}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Driver Name</Label>
            <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Vehicle No</Label>
            <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="DHAKA-METRO-GA-12-3456" />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Items</h3>
            <Button size="sm" variant="outline" onClick={addItem} disabled={!!salesOrderId}>
              <Plus className="mr-1 h-3 w-3" /> Add
            </Button>
          </div>
          <div className="overflow-hidden rounded-md border">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Product</TableHead><TableHead className="w-24 text-right">Qty</TableHead><TableHead className="w-10" />
              </TableRow></TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">No items.</TableCell></TableRow>
                )}
                {items.map((it, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Select
                        value={it.productId}
                        disabled={!!salesOrderId}
                        onValueChange={(v) => {
                          const p = products.find((x) => x.id === v);
                          if (p) setItems(items.map((x, i) => i === idx ? { ...x, productId: p.id, productName: p.name, price: p.price, taxRate: p.taxRate } : x));
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={it.quantity}
                        disabled={!!salesOrderId}
                        onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))}
                        className="text-right"
                      />
                    </TableCell>
                    <TableCell>
                      {!salesOrderId && (
                        <Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => navigate({ to: "/deliveries" })}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>Create Challan</Button>
        </div>
      </CardContent></Card>
    </div>
  );
}
