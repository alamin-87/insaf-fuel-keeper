import type { LineItem, PurchaseOrder, PurchaseStatus } from "@/types";

const FULLY_RECEIVED: PurchaseStatus[] = ["received", "billed", "paid"];

export function lineOrderedQty(item: Pick<LineItem, "quantity">) {
  return Math.max(0, Number(item.quantity) || 0);
}

/** Backward compatible: historical full GRNs have no receivedQty. */
export function lineReceivedQty(item: LineItem, po: Pick<PurchaseOrder, "status">) {
  if (item.receivedQty != null && Number.isFinite(Number(item.receivedQty))) {
    return Math.max(0, Number(item.receivedQty));
  }
  if (FULLY_RECEIVED.includes(po.status)) return lineOrderedQty(item);
  if (item.cylinderIds?.length) return item.cylinderIds.length;
  return 0;
}

export function lineRemainingQty(item: LineItem, po: Pick<PurchaseOrder, "status">) {
  return Math.max(0, lineOrderedQty(item) - lineReceivedQty(item, po));
}

export function poIsFullyReceived(items: LineItem[], po: Pick<PurchaseOrder, "status">) {
  return items.length > 0 && items.every((it) => lineRemainingQty(it, po) <= 0);
}

export function poHasAnyReceived(items: LineItem[], po: Pick<PurchaseOrder, "status">) {
  return items.some((it) => lineReceivedQty(it, po) > 0);
}

export function nextPurchaseStatus(items: LineItem[], po: Pick<PurchaseOrder, "status" | "paid" | "total">): PurchaseStatus {
  if (po.status === "cancelled" || po.status === "paid") return po.status;
  const fully = poIsFullyReceived(items, { status: "ordered" });
  if (fully) {
    if ((po.paid || 0) + 0.009 >= (po.total || 0) && (po.total || 0) > 0) return "paid";
    if (po.status === "billed") return "billed";
    return "received";
  }
  if (poHasAnyReceived(items, { status: "ordered" })) return "partial";
  return po.status === "draft" ? "draft" : "ordered";
}
