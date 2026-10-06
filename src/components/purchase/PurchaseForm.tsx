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
import type { LineItem, Product } from "@/types";
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

function getProductType(p: { productType?: string; category?: string; uom?: string }): "gas" | "cylinder" | "product" {
  const uom = String(p.uom || "").toLowerCase();
  if (uom === "cyl") return "cylinder";
  if (uom === "pcs") return "product";
  if (p.productType === "gas" || p.productType === "cylinder" || p.productType === "product") {
    return p.productType;
  }
  if (uom === "kg" || uom === "ltr") return "gas";
  if (p.category === "LPG" || p.category === "Industrial" || p.category === "Medical") {
    return "cylinder";
  }
  return "gas";
}

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
            itemType: getProductType(p),
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
    setItems(
      existing.items.map((it) => {
        const p = products.find((x) => x.id === it.productId);
        return {
          ...it,
          itemType: it.itemType || (p ? getProductType(p) : "gas"),
        };
      }),
    );
    setHydrated(true);
  }, [existing, products]);

  const addItem = () => {
    const p = products[0];
    if (!p) return;
    const pType = getProductType(p);
    setItems((prev) => [
      ...prev,
      {
        productId: p.id,
        productName: p.name,
        itemType: pType,
        quantity: 1,
        price: p.cost ?? p.price,
        taxRate: 0,
      },
    ]);
  };

  const update = (idx: number, patch: Partial<LineItem>) => {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const setLineType = (idx: number, type: "gas" | "cylinder" | "product") => {
    const matchingProducts = products.filter((p) => getProductType(p) === type);
    const current = products.find((p) => p.id === items[idx]?.productId);
    if (current && getProductType(current) === type) {
      update(idx, { itemType: type });
      return;
    }
    const nextProduct = matchingProducts[0];
    if (nextProduct) {
      update(idx, {
        itemType: type,
        productId: nextProduct.id,
        productName: nextProduct.name,
        price: nextProduct.cost ?? nextProduct.price,
      });
    } else {
      update(idx, { itemType: type, productId: "", productName: "", price: 0 });
    }
  };

  const onSelectProduct = (idx: number, productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const pType = getProductType(p);
    update(idx, {
      productId: p.id,
      productName: p.name,
      itemType: pType,
      price: p.cost ?? p.price,
    });
  };

  const totals = computeTotals(items);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!supplierId) throw new Error("Select a supplier");
      if (items.length === 0) throw new Error(t("common.noItems"));

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.productId || !it.productName) {
          throw new Error(`Item ${i + 1}: Please select a product`);
        }
        if (!it.itemType) {
          throw new Error(`Item ${i + 1}: Please select a type`);
        }
        const prod = products.find((p) => p.id === it.productId);
        if (prod && getProductType(prod) !== it.itemType) {
          throw new Error(`Item ${i + 1}: Product does not belong to selected type`);
        }
        if (!Number.isFinite(it.quantity) || it.quantity <= 0) {
          throw new Error(`Item ${i + 1}: Quantity must be greater than 0`);
        }
        if (!Number.isFinite(it.price) || it.price < 0) {
          throw new Error(`Item ${i + 1}: Cost cannot be negative`);
        }
      }

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
                    <TableHead className="w-36">{t("common.type")}</TableHead>
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
                        colSpan={6}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        {t("common.noItems")}
                      </TableCell>
                    </TableRow>
                  )}
                  {items.map((it, idx) => {
                    const selectedProduct = products.find((x) => x.id === it.productId);
                    const rowType =
                      it.itemType || (selectedProduct ? getProductType(selectedProduct) : "gas");
                    const filteredProducts = products.filter(
                      (p) => getProductType(p) === rowType,
                    );

                    return (
                      <TableRow key={idx}>
                        <TableCell className="min-w-[12rem]">
                          <Select
                            value={it.productId}
                            onValueChange={(v) => onSelectProduct(idx, v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t("common.select")} />
                            </SelectTrigger>
                            <SelectContent>
                              {filteredProducts.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="w-36">
                          <Select
                            value={rowType}
                            onValueChange={(v) =>
                              setLineType(idx, v as "gas" | "cylinder" | "product")
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gas">Gas</SelectItem>
                              <SelectItem value="cylinder">Cylinder</SelectItem>
                              <SelectItem value="product">Product</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="text-right"
                            min={1}
                            value={it.quantity}
                            onChange={(e) =>
                              update(idx, { quantity: Number(e.target.value) })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="text-right"
                            min={0}
                            value={it.price}
                            onChange={(e) => update(idx, { price: Number(e.target.value) })}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(lineAmount(it))}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setItems(items.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
