import { useMemo, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { EMPTY_DATE_RANGE, filterByDateRange, type DateRange } from "@/lib/date-range";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null | undefined;
}

type SortDir = "asc" | "desc";

type DateKey<T> = keyof T | ((row: T) => string | number | Date | null | undefined);

export function DataTable<T extends { id: string }>({
  rows, columns, searchKeys, onRowClick, empty, dateKey, dateRange, onDateRangeChange,
}: {
  rows: T[];
  columns: Column<T>[];
  searchKeys?: (keyof T)[];
  onRowClick?: (row: T) => void;
  empty?: string;
  /** Enable date filter toolbar. Pass field name or extractor. */
  dateKey?: DateKey<T>;
  /** Controlled date range (optional — uncontrolled if omitted). */
  dateRange?: DateRange;
  onDateRangeChange?: (next: DateRange) => void;
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [internalRange, setInternalRange] = useState<DateRange>(EMPTY_DATE_RANGE);
  const emptyLabel = empty ?? t("common.noRecords");

  const range = dateRange ?? internalRange;
  const setRange = onDateRangeChange ?? setInternalRange;

  const getDate = (row: T) => {
    if (!dateKey) return undefined;
    if (typeof dateKey === "function") return dateKey(row);
    return row[dateKey] as string | number | Date | null | undefined;
  };

  const filtered = useMemo(() => {
    const dated = dateKey ? filterByDateRange(rows, range, getDate) : rows;

    const base = q && searchKeys
      ? dated.filter((r) =>
          searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q.toLowerCase())),
        )
      : dated;

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
  }, [rows, q, searchKeys, sortKey, sortDir, columns, dateKey, range]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const showToolbar = Boolean(searchKeys) || Boolean(dateKey);

  return (
    <Card className="overflow-hidden p-0">
      {showToolbar && (
        <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          {searchKeys ? (
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("common.search")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8"
              />
            </div>
          ) : (
            <div />
          )}
          {dateKey && (
            <DateRangeFilter value={range} onChange={setRange} compact />
          )}
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
                  {emptyLabel}
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
