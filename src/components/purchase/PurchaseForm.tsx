import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { supplierService } from "@/services/supplier.service";
import { productService } from "@/services/product.service";
import { purchaseService } from "@/services/purchase.service";
import { cylinderService } from "@/services/cylinder.service";
import { computeTotals, genOrderNo } from "@/utils/helpers";
import { formatCurrency } from "@/utils/formatters";
import { purchaseOrderSchema } from "@/utils/validators";
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
import { useT } from "@/i18n";

export function PurchaseForm({ id }: { id?: string }) {
  const t = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const editing = Boolean(id);
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: supplierService.list });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: productService.list });
  const { data: cylinders = [] } = useQuery({ queryKey: ["cylinders"], queryFn: cylinderService.list });
  const { data: existing, isLoading } = useQuery({
    queryKey: ["purchases", id],
    queryFn: () => purchaseService.get(id!),
    enabled: editing,
  });

  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<(LineItem & { cylinderSerials?: string })[]>([]);
  const [hydrated, setHydrated] = useState(!editing);

  useEffect(() => {
    if (!existing) return;
    setSupplierId(existing.supplierId);
    setNotes(existing.notes ?? "");
    setItems(existing.items.map(it => {
      const cids = it.cylinderIds || [];
      const serials = cylinders.filter(c => cids.includes(c.id)).map(c => c.serialNumber).join(", ");
      return { ...it, cylinderSerials: serials };
    }));
    setHydrated(true);
  }, [existing]);

  const addItem = () => {
    const p = products[0];
    if (!p) return;
    setItems([...items, {
      productId: p.id, productName: p.name, quantity: 1,
      price: p.cost ?? p.price, taxRate: p.taxRate,
    }]);
  };

  const update = (idx: number, patch: Partial<LineItem & { cylinderSerials?: string }>) => {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const totals = computeTotals(items);

  const mutation = useMutation({
    mutationFn: async () => {
      const finalItems = items.map((it) => {
        let cylinderIds: string[] = [];
        if (it.cylinderSerials) {
          const serials = it.cylinderSerials.split(",").map(s => s.trim()).filter(Boolean);
          cylinderIds = serials.map(s => {
            const found = cylinders.find(c => c.serialNumber === s);
            if (!found) throw new Error(`Cylinder not found: ${s}`);
            if (found.productId !== it.productId) throw new Error(`Cylinder ${s} does not match product ${it.productName}`);
            return found.id;
          });
        }
        return { ...it, cylinderIds };
      });

      const parsed = purchaseOrderSchema.safeParse({ supplierId, notes, items: finalItems });
      if (!parsed.success) throw new Error(parsed.error.errors[0]?.message || "Invalid form");
      const supplier = suppliers.find((s) => s.id === supplierId);
      if (!supplier) throw new Error(t("common.select"));

      if (editing && existing) {
        if (existing.status !== "draft" && existing.status !== "ordered") {
          throw new Error(t("purchases.cannotEdit"));
        }
        return purchaseService.update(id!, {
          supplierId,
          supplierName: supplier.name,
          items: finalItems,
          subtotal: totals.subtotal,
          tax: totals.tax,
          total: totals.total,
          notes,
        });
      }

      return purchaseService.create({
        orderNo: genOrderNo("PO"),
        supplierId, supplierName: supplier.name,
        date: new Date().toISOString(),
        items: finalItems, subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
        paid: 0, status: "ordered", notes,
      });
    },
    onSuccess: (po) => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["purchases", po.id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(editing ? t("purchases.updated") : t("purchases.created"));
      navigate({ to: "/purchases/$id", params: { id: po.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (editing && isLoading) return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (editing && !existing) return <div className="p-6 text-sm text-destructive">{t("purchases.notFound")}</div>;
  if (editing && existing && existing.status !== "draft" && existing.status !== "ordered") {
    return <div className="p-6 text-sm text-destructive">{t("purchases.cannotEdit")}</div>;
  }
  if (!hydrated) return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div>
      <PageHeader title={editing ? t("purchases.editTitle") : t("purchases.newTitle")} backTo={editing ? { to: "/purchases/$id", params: { id: id! } } : "/purchases"} />
      <Card><CardContent className="pt-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("common.supplier")}</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.notes")}</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t("sales.item")}</h3>
            <Button size="sm" variant="outline" onClick={addItem}><Plus className="mr-1 h-3 w-3" /> {t("common.addItem")}</Button>
          </div>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("common.product")}</TableHead>
                <TableHead>Cylinder Serials</TableHead>
                <TableHead className="w-24 text-right">{t("common.quantity")}</TableHead>
                <TableHead className="w-32 text-right">{t("purchases.cost")}</TableHead><TableHead className="w-24 text-right">{t("products.taxPct")}</TableHead>
                <TableHead className="w-32 text-right">{t("common.lineTotal")}</TableHead><TableHead className="w-10" />
              </TableRow></TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">{t("common.noItems")}</TableCell></TableRow>
                )}
                {items.map((it, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Select value={it.productId} onValueChange={(v) => {
                        const p = products.find((x) => x.id === v);
                        if (p) update(idx, { productId: p.id, productName: p.name, price: p.cost ?? p.price, taxRate: p.taxRate });
                      }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input placeholder="e.g. INS-001" value={it.cylinderSerials || ""} onChange={(e) => update(idx, { cylinderSerials: e.target.value })} /></TableCell>
                    <TableCell><Input type="number" className="text-right" value={it.quantity} onChange={(e) => update(idx, { quantity: Number(e.target.value) })} /></TableCell>
                    <TableCell><Input type="number" className="text-right" value={it.price} onChange={(e) => update(idx, { price: Number(e.target.value) })} /></TableCell>
                    <TableCell><Input type="number" className="text-right" value={it.taxRate} onChange={(e) => update(idx, { taxRate: Number(e.target.value) })} /></TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(it.price * it.quantity * (1 + it.taxRate / 100))}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex justify-end text-sm">
            <div className="w-56 space-y-1">
              <div className="flex justify-between"><span>{t("common.subtotal")}</span><span>{formatCurrency(totals.subtotal)}</span></div>
              <div className="flex justify-between"><span>{t("common.tax")}</span><span>{formatCurrency(totals.tax)}</span></div>
              <div className="flex justify-between border-t pt-1 font-semibold"><span>{t("common.total")}</span><span>{formatCurrency(totals.total)}</span></div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/purchases" })}>{t("common.cancel")}</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {editing ? t("common.save") : t("purchases.create")}
          </Button>
        </div>
      </CardContent></Card>
    </div>
  );
}
