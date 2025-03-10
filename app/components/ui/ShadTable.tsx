// /components/ui/shad-table.tsx
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ColumnDefinition<T> {
  /** The column header text */
  header: string;
  /** Function to render each cell in this column. Receives the row item. */
  render: (row: T) => React.ReactNode;
}

interface ShadTableProps<T> {
  /** The column definitions (header + how to render each row's cell) */
  columns: ColumnDefinition<T>[];
  /** The array of data items to display in rows */
  data: T[];
  /** Optional message to display if `data` is empty */
  emptyMessage?: string;
  /** Optional CSS classes for the table wrapper */
  className?: string;
}

export function ShadTable<T>({
  columns,
  data,
  emptyMessage = "No data found",
  className = "",
}: ShadTableProps<T>) {
  return (
    <Table className={`w-full mb-8 ${className}`}>
      <TableHeader>
        <TableRow>
          {columns.map((col, index) => (
            <TableHead key={index}>{col.header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-center text-gray-500">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          data.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {columns.map((col, colIndex) => (
                <TableCell key={colIndex}>
                  {col.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
