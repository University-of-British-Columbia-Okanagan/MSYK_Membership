import React from "react";
import type { ComponentType, SVGProps } from "react";

interface RadioOption {
  value: string;
  label: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}

interface DateTypeRadioGroupProps {
  /**
   * The array of radio options to render.
   * For example:
   * [
   *   { value: "custom", label: "Manage dates" },
   *   { value: "weekly", label: "Append weekly dates" },
   *   { value: "monthly", label: "Append monthly dates" },
   * ]
   */
  options: RadioOption[];
  /**
   * The currently selected value, e.g. "custom", "weekly", or "monthly".
   */
  selectedValue: string;
  /**
   * Handler that updates the selected value.
   */
  onChange: (value: string) => void;
  /**
   * The name attribute for the group of radio buttons (optional).
   */
  name?: string;

  className?: string;

  itemClassName?: string;
}

/**
 * A reusable radio group that displays each option in `options`.
 * Adding new options (e.g. "yearly") is as simple as appending
 * another item to the array you pass in.
 */
const DateTypeRadioGroup: React.FC<DateTypeRadioGroupProps> = ({
  options,
  selectedValue,
  onChange,
  name = "dateType",
}) => {
  return (
    <div className="flex flex-col items-start space-y-4 w-full">
      {/* Radio Buttons for date selection type */}
      <div className="flex flex-col items-start gap-4">
        {options.map((option) => (
          <label key={option.value} className="flex items-center space-x-2">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selectedValue === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="text-sm">{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default DateTypeRadioGroup;
