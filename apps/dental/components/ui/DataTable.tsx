import * as React from "react";
import { cn } from "@/lib/utils";
import { Search, ChevronUp, ChevronDown, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (value: any, item: T, index: number) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  /** Hide column on tablet (768px-1024px) - use for less important columns */
  hideOnTablet?: boolean;
  /** Hide column on mobile (<768px) - handled via mobileColumns prop instead */
  hideOnMobile?: boolean;
  /** Minimum width for this column (e.g., '120px', '10rem') */
  minWidth?: string;
  /** Keep an important column visible while the desktop table scrolls horizontally */
  sticky?: 'left' | 'right';
}

export interface DataTableProps<T> extends React.HTMLAttributes<HTMLDivElement> {
  data: T[];
  columns: Column<T>[];
  mobileColumns?: Column<T>[]; // optional set for small screens
  emptyMessage?: string;
  loading?: boolean;
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  // Local search by key if provided (supports dot notation)
  searchKey?: string;
  emptyState?: {
    icon?: React.ComponentType<{ className?: string }>;
    title?: string;
    description?: string;
  };
  // Show count badge with total records
  showCount?: boolean;
  countLabel?: string; // e.g., "patients", "treatments"
  /** Maximum records mounted per page. Keeps large lists responsive. */
  pageSize?: number;
  /** Controlled pagination for lists already paginated by the server. */
  serverPagination?: {
    pageIndex: number;
    pageCount: number;
    totalCount: number;
    onPageChange: (pageIndex: number) => void;
  };
}

function getValue<T>(item: T, key: keyof T | string): any {
  if (typeof key === 'string' && key.includes('.')) {
    return key.split('.').reduce((obj: any, k) => obj?.[k], item);
  }
  return item[key as keyof T];
}

function DataTable<T extends { id?: string | number }>({
  className,
  data,
  columns,
  mobileColumns,
  emptyMessage = "No data available",
  loading = false,
  searchPlaceholder,
  searchKey,
  onSearch,
  emptyState,
  showCount = false,
  countLabel,
  pageSize = 50,
  serverPagination,
  ...props
}: DataTableProps<T>) {
  const [searchValue, setSearchValue] = React.useState("");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [isMobile, setIsMobile] = React.useState(false);
  const [sortConfig, setSortConfig] = React.useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateLayout = () => setIsMobile(mediaQuery.matches);
    updateLayout();
    mediaQuery.addEventListener?.('change', updateLayout);

    return () => mediaQuery.removeEventListener?.('change', updateLayout);
  }, []);
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    setPageIndex(0);
    onSearch?.(value);
  };

  const handleSort = (key: string) => {
    setPageIndex(0);
    setSortConfig(current => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };

  // Local filter when searchKey is provided and no external handler
  const filteredData = React.useMemo(() => {
    const dataArray = Array.isArray(data) ? data : [];
    if (!searchKey || !searchValue) return dataArray;
    const q = String(searchValue).toLowerCase();
    return dataArray.filter((item) => {
      const val = getValue(item, searchKey);
      return String(val ?? "").toLowerCase().includes(q);
    });
  }, [data, searchKey, searchValue]);

  // Sort data if sortConfig is set
  const sortedData = React.useMemo(() => {
    const source = Array.isArray(filteredData) ? filteredData : [];
    if (!sortConfig) return source;
    
    return [...source].sort((a, b) => {
      const aVal = getValue(a, sortConfig.key);
      const bVal = getValue(b, sortConfig.key);
      
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);
  
  // Calculate counts for display
  const isServerPaginated = serverPagination !== undefined;
  const localTotalCount = Array.isArray(data) ? data.length : 0;
  const totalCount = serverPagination?.totalCount ?? localTotalCount;
  const filteredCount = serverPagination?.totalCount ?? sortedData.length;
  const isFiltered = searchValue && filteredCount !== totalCount;
  const safePageSize = Math.max(1, pageSize);
  const pageCount = serverPagination?.pageCount
    ?? Math.max(1, Math.ceil(filteredCount / safePageSize));
  const safePageIndex = Math.min(serverPagination?.pageIndex ?? pageIndex, pageCount - 1);
  const pageStart = safePageIndex * safePageSize;
  const visibleData = React.useMemo(
    () => isServerPaginated ? sortedData : sortedData.slice(pageStart, pageStart + safePageSize),
    [sortedData, pageStart, safePageSize, isServerPaginated]
  );

  React.useEffect(() => {
    if (!isServerPaginated && pageIndex >= pageCount) setPageIndex(pageCount - 1);
  }, [pageCount, pageIndex, isServerPaginated]);

  const changePage = (nextPage: number) => {
    if (serverPagination) {
      serverPagination.onPageChange(nextPage);
    } else {
      setPageIndex(nextPage);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Bar and Count */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Search Bar with animation */}
        {(onSearch || searchKey) && (
          <div className="relative group flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input
              type="text"
              placeholder={searchPlaceholder || "Search..."}
              value={searchValue}
              onChange={onSearch ? handleSearch : (e) => {
                setSearchValue(e.target.value);
                setPageIndex(0);
              }}
              className="w-full rounded-lg border border-input bg-background px-10 py-2.5 text-sm shadow-sm transition-all duration-200 placeholder:text-muted-foreground hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
            />
            {searchValue && (
              <button
                onClick={() => {
                  setSearchValue("");
                  setPageIndex(0);
                  onSearch?.("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Record Count Badge */}
        {showCount && !loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
              {isFiltered ? (
                <>
                  {filteredCount} / {totalCount}
                </>
              ) : (
                totalCount
              )}
            </span>
            {countLabel && <span>{countLabel}</span>}
          </div>
        )}
      </div>

      {/* Table or Empty State with better design */}
      {loading ? (
        <div className={cn("rounded-xl border bg-card shadow-sm", className)} {...props}>
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded-md w-32 mx-auto"></div>
              <div className="h-3 bg-muted rounded-md w-24 mx-auto"></div>
            </div>
          </div>
        </div>
      ) : sortedData.length === 0 ? (
        <div className={cn("rounded-xl border bg-card shadow-sm", className)} {...props}>
          <div className="p-12 text-center">
            {emptyState ? (
              <div className="flex flex-col items-center space-y-3">
                {emptyState.icon && (
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/50 mb-2">
                    <emptyState.icon className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
                {emptyState.title && (
                  <h3 className="font-semibold text-lg text-foreground">{emptyState.title}</h3>
                )}
                {emptyState.description && (
                  <p className="text-sm text-muted-foreground max-w-md">
                    {emptyState.description}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            )}
          </div>
        </div>
      ) : (
        <div className={cn("rounded-xl border bg-card shadow-sm overflow-hidden", className)} {...props}>
          {/* Mount only the active responsive layout. Rendering both doubles large lists. */}
          {isMobile ? (
          <div className="divide-y divide-border">
            {visibleData.map((item, visibleIndex) => {
              const rowIndex = pageStart + visibleIndex;
              const cols = mobileColumns && mobileColumns.length > 0
                ? mobileColumns
                : columns.slice(0, Math.min(4, columns.length));

              // Separate actions from regular columns
              const actionCol = cols.find(c => c.key === 'actions');
              const regularCols = cols.filter(c => c.key !== 'actions');

              return (
                <div
                  key={(item as any).id ?? rowIndex}
                  className="p-4 space-y-3 active:bg-muted/50 transition-colors"
                >
                  {/* Regular fields in a structured layout */}
                  <div className="space-y-2">
                    {regularCols.map((column, colIndex) => {
                      const value = getValue(item, column.key);
                      const isFirstCol = colIndex === 0;

                      return (
                        <div
                          key={colIndex}
                          className={cn(
                            "flex items-start justify-between gap-3",
                            isFirstCol && "pb-2 border-b border-border/50"
                          )}
                        >
                          <span className="text-xs text-muted-foreground flex-shrink-0 uppercase tracking-wide pt-0.5">
                            {column.label}
                          </span>
                          <div className={cn(
                            "text-sm text-right min-w-0 flex-1",
                            isFirstCol && "font-medium"
                          )}>
                            {column.render
                              ? column.render(value, item, rowIndex)
                              : String(value ?? "")}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions row - separated with border */}
                  {actionCol && (
                    <div className="flex justify-end pt-2 border-t border-border/50">
                      {actionCol.render
                        ? actionCol.render(getValue(item, actionCol.key), item, rowIndex)
                        : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          ) : (
          /* Desktop/tablet table - scrollable on smaller screens */
          <div className="hidden md:block overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full min-w-[700px] lg:min-w-0">
              <thead>
                <tr className="border-b bg-gradient-to-r from-muted/30 to-muted/10">
                  {/* Placeholder header cell for hover indicator column to keep alignment */}
                  <th className="w-1 p-0" aria-hidden="true"></th>
                  {columns.map((column, index) => {
                    const isSortable = column.sortable !== false && !isServerPaginated;
                    const isSorted = sortConfig?.key === column.key;

                    return (
                      <th
                        key={index}
                        className={cn(
                          "h-11 px-3 lg:px-5 text-left align-middle font-medium text-xs uppercase tracking-wider text-muted-foreground transition-colors whitespace-nowrap",
                          isSortable && "cursor-pointer hover:text-foreground hover:bg-muted/30",
                          // Hide on tablet (md) but show on large (lg) screens
                          column.hideOnTablet && "hidden lg:table-cell",
                          column.sticky === 'right' && "sticky right-0 z-30 bg-muted shadow-[-8px_0_12px_-12px_hsl(var(--foreground))]",
                          column.sticky === 'left' && "sticky left-0 z-30 bg-muted shadow-[8px_0_12px_-12px_hsl(var(--foreground))]",
                          column.className
                        )}
                        style={column.minWidth ? { minWidth: column.minWidth } : undefined}
                        onClick={() => isSortable && handleSort(column.key as string)}
                      >
                        <div className="inline-flex items-center gap-1">
                          <span>{column.label}</span>
                          {isSortable && column.label && (
                            <span className="inline-flex">
                              {!isSorted ? (
                                <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
                              ) : sortConfig?.direction === 'asc' ? (
                                <ChevronUp className="h-3 w-3 text-primary" />
                              ) : (
                                <ChevronDown className="h-3 w-3 text-primary" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleData.map((item, visibleIndex) => {
                  const rowIndex = pageStart + visibleIndex;
                  return (
                  <tr
                    key={item.id || rowIndex}
                    className={cn(
                      "border-b transition-colors duration-200",
                      "hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent",
                      "group relative"
                    )}
                  >
                    {/* Hover indicator */}
                    <td className="w-1 p-0 relative">
                      <div
                        className={cn(
                          "absolute left-0 top-0 bottom-0 w-1 bg-primary transition-all duration-200",
                          "opacity-0 group-hover:opacity-100"
                        )}
                      />
                    </td>
                    {columns.map((column, colIndex) => {
                      const value = getValue(item, column.key);
                      return (
                        <td
                          key={colIndex}
                          className={cn(
                            "px-3 lg:px-5 py-3 lg:py-4 align-middle transition-colors text-sm",
                            "group-hover:text-foreground",
                            // Hide on tablet (md) but show on large (lg) screens
                            column.hideOnTablet && "hidden lg:table-cell",
                            column.sticky === 'right' && "sticky right-0 z-20 bg-card group-hover:bg-muted shadow-[-8px_0_12px_-12px_hsl(var(--foreground))]",
                            column.sticky === 'left' && "sticky left-0 z-20 bg-card group-hover:bg-muted shadow-[8px_0_12px_-12px_hsl(var(--foreground))]",
                            column.className
                          )}
                          style={column.minWidth ? { minWidth: column.minWidth } : undefined}
                        >
                          <div>
                            {column.render
                              ? column.render(value, item, rowIndex)
                              : String(value ?? "")}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}

          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
              <span>
                {pageStart + 1}-{Math.min(pageStart + safePageSize, filteredCount)} / {filteredCount}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Previous page"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={safePageIndex === 0}
                  onClick={() => changePage(Math.max(0, safePageIndex - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-12 text-center text-foreground">
                  {safePageIndex + 1} / {pageCount}
                </span>
                <button
                  type="button"
                  aria-label="Next page"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={safePageIndex >= pageCount - 1}
                  onClick={() => changePage(Math.min(pageCount - 1, safePageIndex + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

DataTable.displayName = "DataTable";

export { DataTable };
