import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cylinderService } from "@/services/cylinder.service";
import { productService } from "@/services/product.service";
import { isCylinderTrackedLine, pickFifo, cylinderIsEmpty } from "@/lib/cylinder-product";
import { getCylinderTrackingFn } from "@/lib/settings.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Delivery } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/i18n";

export function DeliveryCylinderDialog({
  delivery,
  open,
  onOpenChange,
  onConfirm,
  pending,
}: {
  delivery: Delivery;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (payload: { issuedIdsByItem: string[][]; returnedIds: string[]; lotNumber?: string; expectedReturnAt?: string; asExchange?: boolean }) => void;
  pending?: boolean;
}) {
  const t = useT();
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: productService.list });
  const { data: cylinders = [] } = useQuery({ queryKey: ["cylinders"], queryFn: cylinderService.list });
  const { data: tracking = "serial" } = useQuery({ queryKey: ["cylinderTracking"], queryFn: () => getCylinderTrackingFn() });
  const [issued, setIssued] = useState<string[][]>([]);
  const [returned, setReturned] = useState<string[]>([]);
  const [lotNumber, setLotNumber] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("");

  const cylLines = useMemo(
    () => delivery.items.map((it, index) => ({ it, index, product: products.find((p) => p.id === it.productId) }))
      .filter((row) => isCylinderTrackedLine(row.it, row.product)),
    [delivery.items, products],
  );

  useEffect(() => {
    if (!open) return;
    setIssued(delivery.items.map((it) => [...(it.cylinderIds || [])]));
    setReturned([]);
  }, [open, delivery]);

  const selectedAll = useMemo(() => new Set(issued.flat()), [issued]);
  const empties = cylinders.filter(
    (c) => c.status === "at_customer" && (!c.customerId || c.customerId === delivery.customerId),
  );
  const needQty = cylLines.reduce((a, { it }) => a + it.quantity, 0);
  const issuedCount = tracking === "serial" ? issued.flat().length : needQty;
  const ready = tracking !== "serial" || cylLines.every(({ it, index }) => (issued[index]?.length || 0) === it.quantity);
  const exchangeReady = issuedCount > 0 && issuedCount === returned.length;

  const toggle = (index: number, id: string, qty: number) => {
    setIssued((prev) => {
      const next = prev.map((row) => [...row]);
      const row = next[index] || [];
      if (row.includes(id)) next[index] = row.filter((x) => x !== id);
      else if (row.length < qty) next[index] = [...row, id];
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("deliveries.assignTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>{t("inventory.expectedReturn")}</Label>
            <Input type="date" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} />
          </div>
          {tracking === "lot" && (
            <div className="space-y-1.5">
              <Label>{t("inventory.lotNumber")}</Label>
              <Input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} placeholder="LOT-2026-001" />
            </div>
          )}
          {cylLines.map(({ it, index, product }) => {
            const stock = cylinders.filter(
              (c) => c.productId === it.productId
                && (c.status === "in_stock" || c.status === "in_transit")
                && !cylinderIsEmpty(c)
                && (!selectedAll.has(c.id) || issued[index]?.includes(c.id)),
            );
            const count = issued[index]?.length || 0;
            return (
              <section key={index} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{it.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("deliveries.selectedCount", { selected: count, qty: it.quantity })}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const exclude = new Set(issued.flatMap((ids, i) => (i === index ? [] : ids)));
                      setIssued((prev) => {
                        const next = prev.map((row) => [...row]);
                        next[index] = pickFifo(cylinders, it.productId, it.quantity, exclude);
                        return next;
                      });
                    }}
                  >
                    {t("deliveries.autoPick")}
                  </Button>
                </div>
                {stock.length === 0 ? (
                  <p className="text-xs text-destructive">{t("deliveries.noStock")}</p>
                ) : (
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                    {stock.map((c) => (
                      <li key={c.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={issued[index]?.includes(c.id) || false}
                          onCheckedChange={() => toggle(index, c.id, it.quantity)}
                          disabled={!issued[index]?.includes(c.id) && count >= it.quantity}
                        />
                        <span className="font-mono text-xs">{c.serialNumber}</span>
                        <span className="text-[10px] text-muted-foreground">{c.location}</span>
                        {product?.code && <span className="text-[10px] text-muted-foreground">{product.code}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          <section className="space-y-2 rounded-lg border p-3">
            <p className="font-medium">{t("deliveries.empties")}</p>
            <p className="text-xs text-muted-foreground">{t("deliveries.emptiesHint")}</p>
            {empties.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("common.noRecords")}</p>
            ) : (
              <ul className="max-h-36 space-y-1 overflow-y-auto text-sm">
                {empties.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={returned.includes(c.id)}
                      onCheckedChange={() =>
                        setReturned((prev) => (prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]))
                      }
                    />
                    <span className="font-mono text-xs">{c.serialNumber}</span>
                    <span className="text-[10px] text-muted-foreground">{c.location}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button disabled={!ready || pending || (tracking === "lot" && !lotNumber.trim()) || !expectedReturn} onClick={() => onConfirm({ issuedIdsByItem: issued, returnedIds: returned, lotNumber: lotNumber || undefined, expectedReturnAt: expectedReturn, asExchange: false })}>
            {t("deliveries.confirm")}
          </Button>
          <Button
            variant="outline"
            disabled={!ready || !exchangeReady || pending || (tracking === "lot" && !lotNumber.trim()) || !expectedReturn}
            onClick={() => onConfirm({ issuedIdsByItem: issued, returnedIds: returned, lotNumber: lotNumber || undefined, expectedReturnAt: expectedReturn, asExchange: true })}
          >
            {t("deliveries.exchange")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
