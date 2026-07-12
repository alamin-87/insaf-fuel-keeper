import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { customerService } from "@/services/customer.service";
import { productService } from "@/services/product.service";
import { salesService } from "@/services/sales.service";
import { computeTotals, genOrderNo } from "@/utils/helpers";
import { formatCurrency } from "@/utils/formatters";
import { salesOrderSchema } from "@/utils/validators";
import type { LineItem } from "@/types";
import { PageHeader } from "@/components/common/PageHeader";
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

export function SalesOrderForm({ mode = "order" }: { mode?: "order" | "quotation" }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: customerService.list });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: productService.list });

  const [customerId, setCustomerId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);

  const addItem = () => {
    const p = products[0];
    if (!p) return;
    setItems([...items, { productId: p.id, productName: p.name, quantity: 1, price: p.price, taxRate: p.taxRate }]);
  };

  const update = (idx: number, patch: Partial<LineItem>) => {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const totals = computeTotals(items);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = salesOrderSchema.safeParse({ customerId, notes, items });
      if (!parsed.success) throw new Error(parsed.error.errors[0]?.message || "Invalid form");
      const customer = customers.find((c) => c.id === customerId);
      if (!customer) throw new Error("Select a customer");
      return salesService.create({
        orderNo: genOrderNo(mode === "quotation" ? "QT" : "SO"),
        customerId, customerName: customer.name,
        date: new Date().toISOString(),
        items, subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
        paid: 0, status: mode === "quotation" ? "draft" : "confirmed", notes,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(mode === "quotation" ? "Quotation saved" : "Sales order created");
      navigate({ to: "/sales" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title={mode === "quotation" ? "New Quotation" : "New Sales Order"} />
      <Card><CardContent className="pt-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Line Items</h3>
            <Button size="sm" variant="outline" onClick={addItem}><Plus className="mr-1 h-3 w-3" /> Add Item</Button>
          </div>
          <div className="overflow-hidden rounded-md border">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Product</TableHead><TableHead className="w-24 text-right">Qty</TableHead>
                <TableHead className="w-32 text-right">Price</TableHead><TableHead className="w-24 text-right">Tax %</TableHead>
                <TableHead className="w-32 text-right">Line Total</TableHead><TableHead className="w-10" />
              </TableRow></TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No items yet.</TableCell></TableRow>
                )}
                {items.map((it, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Select value={it.productId} onValueChange={(v) => {
                        const p = products.find((x) => x.id === v);
                        if (p) update(idx, { productId: p.id, productName: p.name, price: p.price, taxRate: p.taxRate });
                      }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input type="number" min={1} value={it.quantity} onChange={(e) => update(idx, { quantity: Number(e.target.value) })} className="text-right" /></TableCell>
                    <TableCell><Input type="number" step="0.01" value={it.price} onChange={(e) => update(idx, { price: Number(e.target.value) })} className="text-right" /></TableCell>
                    <TableCell><Input type="number" step="0.01" value={it.taxRate} onChange={(e) => update(idx, { taxRate: Number(e.target.value) })} className="text-right" /></TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(it.price * it.quantity * (1 + it.taxRate / 100))}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </div>
        </div>


        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(totals.tax)}</span></div>
            <div className="flex justify-between border-t pt-1 text-base font-semibold">
              <span>Total</span><span>{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => navigate({ to: "/sales" })}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mode === "quotation" ? "Save Quotation" : "Create Order"}
          </Button>
        </div>
      </CardContent></Card>
    </div>
  );
}
