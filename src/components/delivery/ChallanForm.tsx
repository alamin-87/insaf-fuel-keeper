import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { customerService } from "@/services/customer.service";
import { productService } from "@/services/product.service";
import { productCategoryService } from "@/services/product-category.service";
import { salesService } from "@/services/sales.service";
import { deliveryService } from "@/services/delivery.service";
import { hrService } from "@/services/hr.service";
import { cylinderService } from "@/services/cylinder.service";
import { inventoryService } from "@/services/inventory.service";
import { buildProductInventory } from "@/lib/cylinder-inventory";
import { isDeliveryStaff } from "@/lib/hr-staff";
import {
  isCylinderProduct,
  lineFromProduct,
  saleItemType,
  type SaleItemType,
} from "@/lib/cylinder-product";
import { deliverySchema } from "@/utils/validators";
import { computeTotals, genOrderNo, lineAmount } from "@/utils/helpers";
import { formatCurrency } from "@/utils/formatters";
import type { LineItem, Product } from "@/types";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PageHeader } from "@/components/common/PageHeader";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

function emptyLine(): LineItem {
  return { productId: "", productName: "", quantity: 1, price: 0, taxRate: 0, itemType: "gas" };
}

export function ChallanForm({
  salesOrderId: initialSoId,
  id,
}: {
  salesOrderId?: string;
  id?: string;
}) {
  const t = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const editing = Boolean(id);
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: customerService.list,
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: productService.list,
  });
  const { data: categoryRows = [] } = useQuery({
    queryKey: ["productCategories"],
    queryFn: productCategoryService.list,
  });
  const { data: sales = [] } = useQuery({ queryKey: ["sales"], queryFn: salesService.list });
  const { data: deliveries = [] } = useQuery({
    queryKey: ["deliveries"],
    queryFn: deliveryService.list,
  });
  const { data: cylinders = [] } = useQuery({
    queryKey: ["cylinders"],
    queryFn: cylinderService.list,
  });
  const { data: movements = [] } = useQuery({
    queryKey: ["stockMovements"],
    queryFn: inventoryService.listMovements,
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: hrService.listEmployees,
  });
  const { data: existing, isLoading } = useQuery({
    queryKey: ["deliveries", id],
    queryFn: () => deliveryService.get(id!),
    enabled: editing,
  });

  const stockRows = useMemo(
    () => buildProductInventory(products, cylinders, sales, deliveries, movements),
    [products, cylinders, sales, deliveries, movements],
  );

  const categoryNames = useMemo(
    () =>
      Array.from(
        new Set([
          "LPG",
          "Industrial",
          "Medical",
          "Other",
          ...categoryRows.map((c) => c.name).filter(Boolean),
          ...products.map((p) => p.category).filter(Boolean),
        ]),
      ),
    [categoryRows, products],
  );

  const openOrders = sales.filter((s) => s.status === "confirmed" || s.status === "invoiced");
  const deliveryStaff = employees.filter(isDeliveryStaff);

  const [salesOrderId, setSalesOrderId] = useState(initialSoId || "");
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderQuery, setOrderQuery] = useState("");
  const [productOpenIdx, setProductOpenIdx] = useState<number | null>(null);
  const [productQuery, setProductQuery] = useState("");

  const [customerId, setCustomerId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyLine()]);
  const [hydrated, setHydrated] = useState(!editing);

  useEffect(() => {
    if (!existing) return;
    setSalesOrderId(existing.salesOrderId || "");
    setCustomerId(existing.customerId);
    setDriverName(existing.driverName);
    setReceiverName(existing.receiverName || "");
    setVehicleNo(existing.vehicleNo);
    setItems(
      existing.items?.length
        ? existing.items.map((it) => ({
            ...it,
            itemType:
              it.itemType ||
              (isCylinderProduct(products.find((p) => p.id === it.productId))
                ? "cylinder"
                : "gas"),
          }))
        : [emptyLine()],
    );
    setHydrated(true);
  }, [existing, products]);

  const onSelectOrder = (soId: string) => {
    if (!soId || soId === "__none") {
      setSalesOrderId("");
      setOrderOpen(false);
      setOrderQuery("");
      return;
    }
    const so = sales.find((s) => s.id === soId);
    if (!so) return;
    setSalesOrderId(so.id);
    setCustomerId(so.customerId);
    if (so.driverName) setDriverName(so.driverName);
    if (so.receiverName) setReceiverName(so.receiverName);

    if (so.items && so.items.length > 0) {
      setItems(
        so.items.map((it) => {
          const p = products.find((x) => x.id === it.productId);
          return {
            productId: it.productId,
            productName: it.productName,
            quantity: it.quantity || 1,
            price: Number(it.price) || 0,
            taxRate: it.taxRate || 0,
            category: it.category || p?.category || "",
            itemType: it.itemType || (isCylinderProduct(p) ? "cylinder" : "gas"),
            sellCylinder: Boolean(it.sellCylinder),
            cylinderIds: it.cylinderIds ? [...it.cylinderIds] : undefined,
          };
        }),
      );
    }
    setOrderOpen(false);
    setOrderQuery("");
  };

  useEffect(() => {
    if (editing || !initialSoId) return;
    onSelectOrder(initialSoId);
  }, [initialSoId, editing]);

  const update = (idx: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const applyProduct = (idx: number, p: Product) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const kind: SaleItemType =
          it.itemType === "product" ? "product" : isCylinderProduct(p) ? "cylinder" : "gas";
        return {
          ...lineFromProduct(p, kind),
          quantity: it.quantity || 1,
          price: it.price > 0 ? it.price : p.price,
        };
      }),
    );
    setProductOpenIdx(null);
    setProductQuery("");
  };

  const setLineKind = (idx: number, kind: SaleItemType) => {
    const it = items[idx];
    if (kind === "product") {
      const p = products.find((x) => x.id === it.productId);
      update(idx, {
        itemType: "product",
        sellCylinder: false,
        price: it.price > 0 ? it.price : (p?.price ?? it.price),
      });
      return;
    }
    const current = products.find((x) => x.id === it.productId);
    const matches = (p: Product) =>
      kind === "cylinder" ? isCylinderProduct(p) : !isCylinderProduct(p);
    if (current && matches(current)) {
      update(idx, { itemType: kind, category: it.category || current.category });
      return;
    }
    const next = products.find(matches);
    if (next) {
      setItems((prev) =>
        prev.map((row, i) =>
          i === idx ? { ...lineFromProduct(next, kind), quantity: row.quantity || 1 } : row,
        ),
      );
      return;
    }
    update(idx, { itemType: kind });
  };

  const addItem = () => {
    setItems((prev) => [...prev, emptyLine()]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : [emptyLine()]));
  };

  const totals = computeTotals(
    items.filter((it) => it.productId && it.productName && Number(it.quantity) > 0),
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const workingItems = items.filter(
        (it) => it.productId && it.productName && Number(it.quantity) > 0,
      );
      if (workingItems.length === 0) throw new Error(t("common.noItems"));

      const parsed = deliverySchema.safeParse({
        customerId,
        salesOrderId: salesOrderId || undefined,
        driverName,
        receiverName: receiverName || undefined,
        vehicleNo,
        items: workingItems,
      });
      if (!parsed.success) throw new Error(parsed.error.errors[0]?.message || "Invalid form");
      const c = customers.find((x) => x.id === customerId);
      if (!c) throw new Error(t("common.select"));

      if (editing && existing) {
        if (existing.status !== "pending") throw new Error(t("deliveries.cannotEdit"));
        return deliveryService.update(id!, {
          customerId,
          customerName: c.name,
          salesOrderId: salesOrderId || undefined,
          driverName,
          receiverName: receiverName || undefined,
          vehicleNo,
          items: workingItems,
        });
      }

      return deliveryService.create({
        challanNo: genOrderNo("DC"),
        customerId,
        customerName: c.name,
        salesOrderId: salesOrderId || undefined,
        driverName,
        receiverName: receiverName || undefined,
        vehicleNo,
        items: workingItems,
        status: "pending",
        date: new Date().toISOString(),
      });
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["deliveries", d.id] });
      toast.success(editing ? t("deliveries.updated") : t("deliveries.created"));
      navigate({ to: "/deliveries/$id", params: { id: d.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (editing && isLoading)
    return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (editing && !existing)
    return <div className="p-6 text-sm text-destructive">{t("deliveries.notFound")}</div>;
  if (editing && existing && existing.status !== "pending") {
    return <div className="p-6 text-sm text-destructive">{t("deliveries.cannotEdit")}</div>;
  }
  if (!hydrated)
    return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;

  const recentDocs = sales
    .filter((s) => s.status === "confirmed" || s.status === "invoiced" || s.status === "paid")
    .slice(0, 8);
  const selectedSo = sales.find((s) => s.id === salesOrderId);
  const prevDeliveries = deliveries.filter(
    (d) => d.salesOrderId && d.salesOrderId === salesOrderId,
  );

  return (
    <div>
      <PageHeader
        title={editing ? t("deliveries.editTitle") : t("deliveries.new")}
        backTo={editing ? { to: "/deliveries/$id", params: { id: id! } } : "/deliveries"}
      />
      {!editing && recentDocs.length > 0 && (
        <Card className="mb-4">
          <CardContent className="pt-6">
            <h3 className="mb-3 text-sm font-semibold">{t("deliveries.recentDocs")}</h3>
            <div className="flex flex-wrap gap-2">
              {recentDocs.map((s) => (
                <Button
                  key={s.id}
                  type="button"
                  size="sm"
                  variant={salesOrderId === s.id ? "default" : "outline"}
                  onClick={() => onSelectOrder(s.id)}
                >
                  {s.orderNo} · {s.customerName}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Searchable Order # */}
            <div className="space-y-1.5">
              <Label>{t("sales.orderNo")}</Label>
              <Popover open={orderOpen} onOpenChange={setOrderOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-full justify-between font-normal"
                  >
                    <span className={cn("truncate", !salesOrderId && "text-muted-foreground")}>
                      {selectedSo
                        ? `${selectedSo.orderNo} · ${selectedSo.customerName}`
                        : "— (None / Direct Challan)"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-2" align="start">
                  <Input
                    autoFocus
                    value={orderQuery}
                    placeholder={t("common.search") || "Search order # or customer..."}
                    onChange={(e) => setOrderQuery(e.target.value)}
                    className="mb-2"
                  />
                  <ul className="max-h-56 overflow-auto">
                    <li>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                          !salesOrderId && "bg-accent font-medium",
                        )}
                        onClick={() => onSelectOrder("__none")}
                      >
                        <span>— ({t("common.all") || "None / Direct Challan"})</span>
                        {!salesOrderId && <Check className="h-4 w-4" />}
                      </button>
                    </li>
                    {openOrders
                      .filter((s) => {
                        const q = orderQuery.trim().toLowerCase();
                        if (!q) return true;
                        return `${s.orderNo} ${s.customerName} ${s.driverName || ""} ${s.status}`
                          .toLowerCase()
                          .includes(q);
                      })
                      .map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            className={cn(
                              "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left hover:bg-accent",
                              salesOrderId === s.id && "bg-accent font-medium",
                            )}
                            onClick={() => onSelectOrder(s.id)}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{s.orderNo}</span>
                              <span className="text-xs text-muted-foreground">{s.customerName}</span>
                            </div>
                            {salesOrderId === s.id && <Check className="h-4 w-4" />}
                          </button>
                        </li>
                      ))}
                  </ul>
                </PopoverContent>
              </Popover>
            </div>

            {/* Customer */}
            <div className="space-y-1.5">
              <Label>{t("common.customer")}</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("common.select")} />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Deliveryman */}
            <div className="space-y-1.5">
              <Label>{t("deliveries.deliveryman")}</Label>
              {deliveryStaff.length > 0 ? (
                <Select value={driverName} onValueChange={setDriverName}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("common.select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryStaff.map((e) => (
                      <SelectItem key={e.id} value={e.name}>
                        {e.name} · {e.designation}
                      </SelectItem>
                    ))}
                    {driverName && !deliveryStaff.some((e) => e.name === driverName) && (
                      <SelectItem value={driverName}>{driverName}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} />
              )}
            </div>

            {/* Vehicle */}
            <div className="space-y-1.5">
              <Label>{t("deliveries.vehicle")}</Label>
              <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} />
            </div>

            {/* Receiver */}
            <div className="space-y-1.5">
              <Label>{t("deliveries.receiver")}</Label>
              <Input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
            </div>
          </div>

          {selectedSo && (
            <p className="text-xs text-muted-foreground">
              {t("sales.invoice")} {selectedSo.orderNo}
              {selectedSo.receiverName
                ? ` · ${t("sales.receiver")}: ${selectedSo.receiverName}`
                : ""}
              {prevDeliveries.length > 0
                ? ` · ${t("deliveries.prevDelivery")}: ${prevDeliveries.map((d) => d.challanNo).join(", ")}`
                : ""}
            </p>
          )}

          {/* Editable Item Section matching Screenshot 2 */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t("sales.item")}</h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addItem}
                className="h-8 gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t("common.addItem")}</span>
              </Button>
            </div>
            <div className="overflow-hidden rounded-md border">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">SL</TableHead>
                      <TableHead className="min-w-[11rem]">{t("common.product")}</TableHead>
                      <TableHead className="w-36">{t("common.category")}</TableHead>
                      <TableHead className="w-36">{t("common.type")}</TableHead>
                      <TableHead className="w-24 text-right">{t("common.quantity")}</TableHead>
                      <TableHead className="w-36 min-w-[9.5rem] text-right">{t("common.price")}</TableHead>
                      <TableHead className="w-32 text-right">{t("common.subtotal")}</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="py-8 text-center text-sm text-muted-foreground"
                        >
                          {t("common.noItems")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((it, idx) => {
                        const p = products.find((x) => x.id === it.productId);
                        const kind = saleItemType(it, p);
                        const lineCategory = it.category || p?.category || "";
                        const subtotal = (Number(it.quantity) || 0) * (Number(it.price) || 0);

                        return (
                          <TableRow key={idx}>
                            <TableCell className="tabular-nums text-muted-foreground text-xs">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="min-w-[11rem]">
                              <Popover
                                open={productOpenIdx === idx}
                                onOpenChange={(open) => {
                                  setProductOpenIdx(open ? idx : null);
                                  setProductQuery(open ? it.productName || "" : "");
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-9 w-full justify-start font-normal"
                                  >
                                    <span
                                      className={cn(
                                        "truncate",
                                        !it.productName && "text-muted-foreground",
                                      )}
                                    >
                                      {it.productName || t("common.select")}
                                    </span>
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-2" align="start">
                                  <Input
                                    autoFocus
                                    value={productQuery}
                                    placeholder={t("common.select")}
                                    onChange={(e) => setProductQuery(e.target.value)}
                                    className="mb-2"
                                  />
                                  <ul className="max-h-56 overflow-auto">
                                    {products
                                      .filter((prod) => {
                                        const q = productQuery.trim().toLowerCase();
                                        if (!q) return true;
                                        return `${prod.name} ${prod.code} ${prod.category}`
                                          .toLowerCase()
                                          .includes(q);
                                      })
                                      .slice(0, 40)
                                      .map((prod) => {
                                        const row = stockRows.find((r) => r.productId === prod.id);
                                        const avail = row?.available ?? prod.stock ?? 0;
                                        return (
                                          <li key={prod.id}>
                                            <button
                                              type="button"
                                              className="flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left hover:bg-accent"
                                              onClick={() => applyProduct(idx, prod)}
                                            >
                                              <span className="font-medium text-sm">{prod.name}</span>
                                              <span className="text-xs text-muted-foreground">
                                                {prod.code} · {avail} {prod.uom}
                                                {avail <= 0 ? ` · ${t("inventory.status.out")}` : ""}
                                              </span>
                                            </button>
                                          </li>
                                        );
                                      })}
                                  </ul>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={lineCategory || "__none"}
                                onValueChange={(v) =>
                                  update(idx, { category: v === "__none" ? "" : v })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t("common.select")} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none">—</SelectItem>
                                  {categoryNames.map((c) => (
                                    <SelectItem key={c} value={c}>
                                      {c}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={kind}
                                onValueChange={(v) => setLineKind(idx, v as SaleItemType)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="gas">{t("products.type.gas")}</SelectItem>
                                  <SelectItem value="cylinder">
                                    {t("products.type.cylinder")}
                                  </SelectItem>
                                  <SelectItem value="product">
                                    {t("products.type.product")}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={1}
                                value={it.quantity}
                                onChange={(e) =>
                                  update(idx, { quantity: Number(e.target.value) })
                                }
                                className="text-right"
                              />
                              {(() => {
                                const row = stockRows.find((r) => r.productId === it.productId);
                                if (!p && !row) return null;
                                const avail =
                                  saleItemType(it, p) === "product"
                                    ? Math.max(0, p?.stock ?? 0)
                                    : (row?.available ?? p?.stock ?? 0);
                                if (it.quantity > avail) {
                                  return (
                                    <p className="mt-1 text-[10px] text-destructive">
                                      {t("sales.stockWarn", { qty: avail })}
                                    </p>
                                  );
                                }
                                return null;
                              })()}
                            </TableCell>
                            <TableCell className="w-36 min-w-[9.5rem]">
                              <Input
                                type="number"
                                step="any"
                                value={it.price === 0 ? "" : it.price}
                                onChange={(e) =>
                                  update(idx, {
                                    price: e.target.value === "" ? 0 : Number(e.target.value),
                                  })
                                }
                                className="w-full text-right"
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {formatCurrency(subtotal)}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeItem(idx)}
                                disabled={items.length <= 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between">
                <span>{t("common.subtotal")}</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 text-base font-semibold">
                <span>{t("common.total")}</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => navigate({ to: "/deliveries" })}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {editing ? t("common.save") : t("common.create")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
