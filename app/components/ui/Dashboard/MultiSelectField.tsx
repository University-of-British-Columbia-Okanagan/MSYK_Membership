// components/ui/MultiSelectField.tsx
import React from "react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface MultiSelectOption {
  id: number;
  name: string;
}

interface MultiSelectFieldProps<
  T extends MultiSelectOption = MultiSelectOption
> {
  control: any;
  name: string;
  label: string;
  options: T[];
  selectedItems: number[];
  onSelect: (id: number) => void;
  onRemove: (id: number) => void;
  error?: string | React.ReactNode;
  filterFn?: (item: T) => boolean;
  placeholder?: string;
  helperText?: string;
}

const MultiSelectField = <T extends MultiSelectOption>({
  control,
  name,
  label,
  options,
  selectedItems,
  onSelect,
  onRemove,
  error,
  filterFn,
  placeholder = "Select options...",
  helperText,
}: MultiSelectFieldProps<T>) => {
  const sortedSelected = [...selectedItems].sort((a, b) => a - b);
  const filteredOptions = options.filter(
    (opt) => !selectedItems.includes(opt.id) && (!filterFn || filterFn(opt))
  );

  return (
    <FormField
      control={control}
      name={name}
      render={() => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div>
              <div className="flex flex-wrap gap-2 mb-2">
                {sortedSelected.map((id) => {
                  const item = options.find((o) => o.id === id);
                  return item ? (
                    <Badge key={id} variant="secondary" className="py-1 px-2">
                      {item.name}
                      <button
                        type="button"
                        onClick={() => onRemove(id)}
                        className="ml-2 text-xs"
                      >
                        ×
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
              <Select
                onValueChange={(value) => onSelect(Number(value))}
                value=""
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                  {filteredOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id.toString()}>
                      {opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </FormControl>
          <FormMessage>{error}</FormMessage>
          {helperText && (
            <div className="text-xs text-gray-500 mt-1">{helperText}</div>
          )}
        </FormItem>
      )}
    />
  );
};

export default MultiSelectField;
