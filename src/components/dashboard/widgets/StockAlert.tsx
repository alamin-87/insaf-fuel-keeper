import { useQuery } from "@tanstack/react-query";
import { productService } from "@/services/product.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export function StockAlerts() {
  const { data = [] } = useQuery({ queryKey: ["stock-alerts"], queryFn: productService.stockAlerts });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Stock Alerts
        </CardTitle>
        <Badge variant="secondary">{data.length}</Badge>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">All stock levels healthy.</p>
        ) : (
          <ul className="space-y-2">
            {data.map((a) => (
              <li key={a.productId} className="flex items-center justify-between rounded-md border p-2">
                <div>
                  <p className="text-sm font-medium">{a.productName}</p>
                  <p className="text-xs text-muted-foreground">Reorder at {a.reorderLevel}</p>
                </div>
                <Badge variant={a.stock === 0 ? "destructive" : "outline"}>{a.stock} in stock</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
