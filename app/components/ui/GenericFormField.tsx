import React from "react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export interface GenericFormFieldProps {
  control: any; // Replace with proper react-hook-form Control type if desired
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  error?: string | React.ReactNode;
  /**
   * The component to render.
   * Defaults to Input.
   */
  component?: React.ElementType;
  /**
   * Additional className for the input element.
   */
  className?: string;
  /**
   * For components that require a rows prop (e.g., Textarea)
   */
  rows?: number;
  autoComplete?: string;
  /**
   * Children to be passed to the component (for example, <option> elements for a select)
   */
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
      render={({ field }) => (
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
              className={className}
              {...(rows ? { rows } : {})}
            >
              {children}
            </Component>
          </FormControl>
          <FormMessage>{error}</FormMessage>
        </FormItem>
      )}
    />
  );
};

export default GenericFormField;
