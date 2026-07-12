import { useMemo, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null | undefined;
}

type SortDir = "asc" | "desc";

export function DataTable<T extends { id: string }>({
  rows, columns, searchKeys, onRowClick, empty = "No records found.",
}: {
  rows: T[];
  columns: Column<T>[];
  searchKeys?: (keyof T)[];
  onRowClick?: (row: T) => void;
  empty?: string;
}) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    const base = q && searchKeys
      ? rows.filter((r) =>
          searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q.toLowerCase())),
        )
      : rows;

    if (!sortKey) return base;
    const col = columns.find((c) => c.key === sortKey && c.sortable);
    if (!col) return base;

    const getVal = (row: T) => {
      if (col.sortValue) return col.sortValue(row);
      const raw = (row as Record<string, unknown>)[col.key];
      return raw as string | number | null | undefined;
    };

    return [...base].sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, q, searchKeys, sortKey, sortDir, columns]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <Card className="overflow-hidden p-0">
      {searchKeys && (
        <div className="border-b p-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {columns.map((c) => (
                <TableHead key={c.key} className={c.className}>
                  {c.sortable ? (
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1 font-medium hover:text-foreground",
                        sortKey === c.key ? "text-foreground" : "text-muted-foreground",
                      )}
                      onClick={() => toggleSort(c.key)}
                    >
                      {c.header}
                      {sortKey === c.key ? (
                        sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-12 text-center text-sm text-muted-foreground">
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow
                  key={row.id}
                  className={onRowClick ? "cursor-pointer" : ""}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((c) => (
                    <TableCell key={c.key} className={c.className}>{c.render(row)}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
