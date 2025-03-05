import React from "react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

// Helper: format a Date as "YYYY-MM-DDTHH:mm"
function formatLocalDatetime(dateInput: Date): string {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export interface GenericFormFieldProps {
  control: any; // Replace with your react-hook-form Control type if desired
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  error?: string | React.ReactNode;
  /**
   * The component to render. Defaults to Input.
   */
  component?: React.ElementType;
  className?: string;
  rows?: number;
  autoComplete?: string;
  children?: React.ReactNode;
}

const GenericFormField: React.FC<GenericFormFieldProps> = ({
  control,
  name,
  label,
  placeholder,
  type = "text",
  required = false,
  error,
  component: Component = Input,
  className = "w-full lg:w-[500px]",
  rows,
  autoComplete = "off",
  children,
}) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        let valueToShow = field.value;
        let onChangeHandler = field.onChange;
        if (type === "datetime-local") {
          // If the value is a Date, format it for the input; otherwise, leave as is.
          if (field.value instanceof Date) {
            valueToShow = formatLocalDatetime(field.value);
          }
          // Update: parse the input string into a Date object
          onChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
            field.onChange(new Date(e.target.value));
          };
        }
        return (
          <FormItem>
            <FormLabel htmlFor={name}>
              {label} {required && <span className="text-red-500">*</span>}
            </FormLabel>
            <FormControl>
              <Component
                id={name}
                placeholder={placeholder}
                type={type}
                autoComplete={autoComplete}
                {...field}
                value={valueToShow}
                onChange={onChangeHandler}
                className={className}
                {...(rows ? { rows } : {})}
              >
                {children}
              </Component>
            </FormControl>
            <FormMessage>{error}</FormMessage>
          </FormItem>
        );
      }}
    />
  );
};

export default GenericFormField;
