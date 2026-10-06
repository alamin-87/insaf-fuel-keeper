import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { supplierService } from "@/services/supplier.service";
import { productService } from "@/services/product.service";
import { purchaseService } from "@/services/purchase.service";
import { computeTotals, genOrderNo, lineAmount, paymentStatus } from "@/utils/helpers";
import { formatCurrency } from "@/utils/formatters";
import { purchaseOrderSchema } from "@/utils/validators";
import type { LineItem } from "@/types";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useT } from "@/i18n";

export function PurchaseForm({ id }: { id?: string }) {
  const t = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const editing = Boolean(id);
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: supplierService.list,
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: productService.list,
  });
  const { data: existing, isLoading } = useQuery({
    queryKey: ["purchases", id],
    queryFn: () => purchaseService.get(id!),
    enabled: editing,
  });

  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [hydrated, setHydrated] = useState(!editing);

  useEffect(() => {
    if (!existing) {
      if (products.length > 0 && items.length === 0) {
        const p = products[0];
        setItems([
          {
            productId: p.id,
            productName: p.name,
            quantity: 1,
            price: p.cost ?? p.price,
            taxRate: 0,
          },
        ]);
      }
      return;
    }
    setSupplierId(existing.supplierId);
    setNotes(existing.notes ?? "");
    setItems(existing.items.map((it) => ({ ...it })));
    setHydrated(true);
  }, [existing, products]);

  const addItem = () => {
    const p = products[0];
    if (!p) return;
    setItems((prev) => [
      ...prev,
      {
        productId: p.id,
        productName: p.name,
        quantity: 1,
        price: p.cost ?? p.price,
        taxRate: 0,
      },
    ]);
  };

  const update = (idx: number, patch: Partial<LineItem>) => {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const totals = computeTotals(items);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = purchaseOrderSchema.safeParse({ supplierId, notes, items });
      if (!parsed.success) throw new Error(parsed.error.errors[0]?.message || "Invalid form");
      const supplier = suppliers.find((s) => s.id === supplierId);
      if (!supplier) throw new Error(t("common.select"));

      if (editing && existing) {
        if (existing.status === "cancelled") {
          throw new Error(t("purchases.cannotEdit"));
        }
        if (totals.total + 0.009 < (existing.paid || 0)) {
          throw new Error(t("purchases.totalBelowPaid"));
        }
        return purchaseService.update(id!, {
          supplierId,
          supplierName: supplier.name,
          items: items.map((it) => ({ ...it, taxRate: 0 })),
          subtotal: totals.subtotal,
          tax: 0,
          total: totals.total,
          notes,
        });
      }

      return purchaseService.create({
        orderNo: genOrderNo("PO"),
        supplierId,
        supplierName: supplier.name,
        date: new Date().toISOString(),
        items: items.map((it) => ({ ...it, taxRate: 0 })),
        subtotal: totals.subtotal,
        tax: 0,
        total: totals.total,
        paid: 0,
        status: "ordered",
        notes,
      });
    },
    onSuccess: (po) => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["purchases", po.id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["vouchers"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      toast.success(editing ? t("purchases.updated") : t("purchases.created"));
      navigate({ to: "/purchases/$id", params: { id: po.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (editing && isLoading)
    return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (editing && !existing)
    return <div className="p-6 text-sm text-destructive">{t("purchases.notFound")}</div>;
  if (editing && existing && existing.status === "cancelled") {
    return <div className="p-6 text-sm text-destructive">{t("purchases.cannotEdit")}</div>;
  }
  if (!hydrated)
    return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div>
      <PageHeader
        title={editing ? t("purchases.editTitle") : t("purchases.newTitle")}
        backTo={editing ? { to: "/purchases/$id", params: { id: id! } } : "/purchases"}
      />
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("common.supplier")}</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("common.select")} />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
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
              <Button type="button" size="sm" variant="outline" onClick={addItem}>
                <Plus className="mr-1 h-3 w-3" /> {t("common.addItem")}
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.product")}</TableHead>
                    <TableHead className="w-24 text-right">{t("common.quantity")}</TableHead>
                    <TableHead className="w-32 text-right">{t("purchases.cost")}</TableHead>
                    <TableHead className="w-32 text-right">{t("common.lineTotal")}</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        {t("common.noItems")}
                      </TableCell>
                    </TableRow>
                  )}
                  {items.map((it, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Select
                          value={it.productId}
                          onValueChange={(v) => {
                            const p = products.find((x) => x.id === v);
                            if (p)
                              update(idx, {
                                productId: p.id,
                                productName: p.name,
                                price: p.cost ?? p.price,
                                taxRate: 0,
                              });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="text-right"
                          value={it.quantity}
                          onChange={(e) => update(idx, { quantity: Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="text-right"
                          value={it.price}
                          onChange={(e) => update(idx, { price: Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(lineAmount(it))}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setItems(items.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 flex justify-end text-sm">
              <div className="w-56 space-y-1">
                <div className="flex justify-between">
                  <span>{t("common.subtotal")}</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-semibold">
                  <span>{t("common.total")}</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
                {editing && existing && (
                  <>
                    <div className="flex justify-between">
                      <span>{t("common.paid")}</span>
                      <span>{formatCurrency(existing.paid)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>{t("common.due")}</span>
                      <span>{formatCurrency(Math.max(0, totals.total - existing.paid))}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t("sales.paymentStatus")}</span>
                      <span>
                        {paymentStatus(totals.total, existing.paid) === "unpaid"
                          ? t("purchases.unpaid")
                          : t(`sales.${paymentStatus(totals.total, existing.paid)}`)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/purchases" })}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {editing ? t("common.save") : t("purchases.create")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
