import * as React from "react";
import { cn } from "@/lib/utils";
import { Search, ChevronUp, ChevronDown, ArrowUpDown } from "lucide-react";

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (value: any, item: T, index: number) => React.ReactNode;
  className?: string;
  sortable?: boolean;
}

export interface DataTableProps<T> extends React.HTMLAttributes<HTMLDivElement> {
  data: T[];
  columns: Column<T>[];
  mobileColumns?: Column<T>[]; // optional set for small screens
  emptyMessage?: string;
  loading?: boolean;
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  emptyState?: {
    icon?: React.ComponentType<{ className?: string }>;
    title?: string;
    description?: string;
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
  onSearch,
  emptyState,
  ...props
}: DataTableProps<T>) {
  const [searchValue, setSearchValue] = React.useState("");
  const [sortConfig, setSortConfig] = React.useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [hoveredRow, setHoveredRow] = React.useState<number | null>(null);
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    onSearch?.(value);
  };

  const handleSort = (key: string) => {
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

  // Sort data if sortConfig is set
  const sortedData = React.useMemo(() => {
    if (!sortConfig) return data;
    
    return [...data].sort((a, b) => {
      const aVal = getValue(a, sortConfig.key);
      const bVal = getValue(b, sortConfig.key);
      
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);
  
  return (
    <div className="space-y-4">
      {/* Search Bar with animation */}
      {onSearch && (
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <input
            type="text"
            placeholder={searchPlaceholder || "Search..."}
            value={searchValue}
            onChange={handleSearch}
            className="w-full rounded-lg border border-input bg-background px-10 py-2.5 text-sm shadow-sm transition-all duration-200 placeholder:text-muted-foreground hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
          {searchValue && (
            <button
              onClick={() => {
                setSearchValue("");
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
          {/* Mobile cards */}
          <div className="md:hidden divide-y">
            {sortedData.map((item, rowIndex) => {
              const cols = mobileColumns && mobileColumns.length > 0 ? mobileColumns : columns.slice(0, Math.min(2, columns.length));
              return (
                <div key={(item as any).id ?? rowIndex} className="p-4">
                  {cols.map((column, colIndex) => {
                    const value = getValue(item, column.key);
                    return (
                      <div key={colIndex} className={cn("py-1")}> 
                        {column.render ? (
                          <div>{column.render(value, item, rowIndex)}</div>
                        ) : (
                          <div className="text-sm">{String(value ?? "")}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gradient-to-r from-muted/30 to-muted/10">
              {columns.map((column, index) => {
                const isSortable = column.sortable !== false;
                const isSorted = sortConfig?.key === column.key;
                
                return (
                  <th
                    key={index}
                    className={cn(
                      "h-12 px-6 text-left align-middle font-medium text-xs uppercase tracking-wider text-muted-foreground transition-colors",
                      isSortable && "cursor-pointer hover:text-foreground hover:bg-muted/30",
                      column.className
                    )}
                    onClick={() => isSortable && handleSort(column.key as string)}
                  >
                    <div className="flex items-center gap-2">
                      <span>{column.label}</span>
                      {isSortable && (
                        <span className="ml-auto">
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
            {sortedData.map((item, rowIndex) => (
              <tr
                key={item.id || rowIndex}
                className={cn(
                  "border-b transition-all duration-200",
                  "hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent",
                  "group relative",
                  hoveredRow === rowIndex && "bg-muted/30"
                )}
                onMouseEnter={() => setHoveredRow(rowIndex)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {/* Hover indicator */}
                <td className="w-1 p-0 relative">
                  <div 
                    className={cn(
                      "absolute left-0 top-0 bottom-0 w-1 bg-primary transition-all duration-200",
                      hoveredRow === rowIndex ? "opacity-100" : "opacity-0"
                    )} 
                  />
                </td>
                {columns.map((column, colIndex) => {
                  const value = getValue(item, column.key);
                  return (
                    <td
                      key={colIndex}
                      className={cn(
                        "px-6 py-4 align-middle transition-colors",
                        "group-hover:text-foreground",
                        column.className
                      )}
                    >
                      <div className="animate-in fade-in-0 duration-200">
                        {column.render
                          ? column.render(value, item, rowIndex)
                          : String(value ?? "")}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
          </div>
        </div>
      )}
    </div>
  );
}

DataTable.displayName = "DataTable";

export { DataTable };
