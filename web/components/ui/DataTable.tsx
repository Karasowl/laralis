import * as React from "react";
import { cn } from "@/lib/utils";

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
  emptyMessage?: string;
  loading?: boolean;
}

function getValue<T>(item: T, key: keyof T | string): any {
  if (typeof key === 'string' && key.includes('.')) {
    return key.split('.').reduce((obj: any, k) => obj?.[k], item);
  }
  return item[key as keyof T];
}

const DataTable = <T,>({
  className,
  data,
  columns,
  emptyMessage = "No data available",
  loading = false,
  ...props
}: DataTableProps<T>) => {
  if (loading) {
    return (
      <div className={cn("rounded-md border", className)} {...props}>
        <div className="p-8 text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded w-32 mx-auto mb-2"></div>
            <div className="h-3 bg-muted rounded w-24 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={cn("rounded-md border", className)} {...props}>
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-md border", className)} {...props}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={cn(
                    "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
                    column.className
                  )}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
              >
                {columns.map((column, colIndex) => {
                  const value = getValue(item, column.key);
                  return (
                    <td
                      key={colIndex}
                      className={cn(
                        "p-4 align-middle [&:has([role=checkbox])]:pr-0",
                        column.className
                      )}
                    >
                      {column.render
                        ? column.render(item, item, rowIndex)
                        : String(value ?? "")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

DataTable.displayName = "DataTable";

export { DataTable };