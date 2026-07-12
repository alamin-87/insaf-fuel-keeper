import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { productService } from "@/services/product.service";
import { inventoryService } from "@/services/inventory.service";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/utils/formatters";
import type { Product, StockMovement } from "@/types";
import { useT } from "@/i18n";

export function InventoryPage() {
  const t = useT();
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: productService.list });
  const { data: movements = [] } = useQuery({ queryKey: ["stockMovements"], queryFn: inventoryService.listMovements });

  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [type, setType] = useState<"in" | "out" | "adjust">("in");
  const [notes, setNotes] = useState("");

  const adjust = useMutation({
    mutationFn: () => inventoryService.adjust(productId, Number(qty), type, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["stockMovements"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(t("inventory.updated"));
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("inventory.title")}
        description={t("inventory.desc")}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="space-y-3 pt-6">
            <h3 className="font-semibold">{t("inventory.adjust")}</h3>
            <div className="space-y-1.5">
              <Label>{t("common.product")}</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.stock})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.type")}</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">{t("inventory.stockIn")}</SelectItem>
                  <SelectItem value="out">{t("inventory.stockOut")}</SelectItem>
                  <SelectItem value="adjust">{t("inventory.setAbsolute")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.quantity")}</Label>
              <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.notes")}</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button className="w-full" disabled={!productId || adjust.isPending} onClick={() => adjust.mutate()}>
              {t("inventory.apply")}
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <DataTable<Product>
            rows={products}
            searchKeys={["name", "code"]}
            dateKey="createdAt"
            columns={[
              { key: "code", header: t("products.code"), sortable: true, sortValue: (r) => r.code, render: (r) => <span className="font-mono text-xs">{r.code}</span> },
              { key: "name", header: t("common.product"), sortable: true, sortValue: (r) => r.name, render: (r) => r.name },
              { key: "stock", header: t("products.stock"), sortable: true, sortValue: (r) => r.stock, render: (r) => (
                <Badge variant={r.stock <= r.reorderLevel ? "destructive" : "outline"}>{r.stock}</Badge>
              ), className: "text-right" },
              { key: "reorder", header: t("products.reorder"), sortable: true, sortValue: (r) => r.reorderLevel, render: (r) => r.reorderLevel, className: "text-right" },
            ]}
          />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("inventory.movements")}</h3>
        <DataTable<StockMovement>
          rows={movements}
          searchKeys={["productName", "notes"]}
          dateKey="date"
          columns={[
            { key: "date", header: t("inventory.when"), sortable: true, sortValue: (r) => r.date, render: (r) => formatDateTime(r.date) },
            { key: "product", header: t("common.product"), sortable: true, sortValue: (r) => r.productName, render: (r) => r.productName },
            { key: "type", header: t("common.type"), sortable: true, sortValue: (r) => r.type, render: (r) => <Badge variant="outline">{r.type}</Badge> },
            { key: "qty", header: t("common.quantity"), sortable: true, sortValue: (r) => r.quantity, render: (r) => r.quantity, className: "text-right" },
            { key: "bal", header: t("inventory.balance"), sortable: true, sortValue: (r) => r.balanceAfter, render: (r) => r.balanceAfter, className: "text-right" },
            { key: "notes", header: t("common.notes"), render: (r) => r.notes ?? "—" },
          ]}
        />
      </div>
    </div>
  );
}
