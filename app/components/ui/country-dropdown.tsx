import { useCallback, useMemo, useState, useEffect } from "react";
import { ChevronDown, Check, Globe } from "lucide-react";
import { CircleFlag } from "react-circle-flags";
import { countries } from "country-data-list";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

interface CountryData {
  alpha2: string;
  alpha3: string;
  name: string;
  emoji?: string;
  status?: string;
}

export interface CountryOption {
  alpha2: string;
  alpha3: string;
  name: string;
  emoji?: string;
}

const STRIPE_SUPPORTED_ALPHA2 = new Set([
  "AE",
  "AT",
  "AU",
  "BE",
  "BG",
  "BR",
  "CA",
  "CH",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GB",
  "GR",
  "HK",
  "HR",
  "HU",
  "IE",
  "IN",
  "IT",
  "JP",
  "LT",
  "LU",
  "LV",
  "MY",
  "MT",
  "MX",
  "NL",
  "NO",
  "NZ",
  "PH",
  "PL",
  "PT",
  "RO",
  "SE",
  "SG",
  "SI",
  "SK",
  "TH",
  "US",
]);

const allCountries: CountryData[] = Array.isArray(countries?.all)
  ? (countries.all as CountryData[])
  : [];

const COUNTRY_OPTIONS: CountryOption[] = allCountries
  .filter(
    (country) =>
      STRIPE_SUPPORTED_ALPHA2.has(country.alpha2) &&
      country.status !== "deleted"
  )
  .map((country) => ({
    alpha2: country.alpha2,
    alpha3: country.alpha3,
    name: country.name,
    emoji: country.emoji,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

interface CountryDropdownProps {
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  placeholder?: string;
  onChange?: (value: string, option: CountryOption) => void;
  error?: string;
}

export function CountryDropdown({
  value,
  defaultValue,
  disabled,
  placeholder = "Select a country",
  onChange,
  error,
}: CountryDropdownProps) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");

  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  const selectedValue = value ?? internalValue;

  const selectedCountry = useMemo(
    () =>
      COUNTRY_OPTIONS.find(
        (country) => country.alpha2.toLowerCase() === selectedValue?.toLowerCase()
      ) ?? null,
    [selectedValue]
  );

  const handleSelect = useCallback(
    (country: CountryOption) => {
      if (!value) {
        setInternalValue(country.alpha2);
      }
      onChange?.(country.alpha2, country);
      setOpen(false);
    },
    [onChange, value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={Boolean(error)}
          className={cn(
            "flex h-10 w-full items-center justify-between px-3 text-left font-normal",
            error
              ? "border-red-300 text-red-900 focus-visible:ring-red-500"
              : "border-gray-300 text-gray-900"
          )}
        >
          {selectedCountry ? (
            <span className="flex w-full items-center gap-2 truncate text-left text-sm">
              <CircleFlag
                countryCode={selectedCountry.alpha2.toLowerCase()}
                height={18}
                style={{ width: "18px", height: "18px" }}
              />
              <span className="truncate">{selectedCountry.name}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2 text-sm text-gray-500">
              <Globe className="h-4 w-4" />
              {placeholder}
            </span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 text-gray-500" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="min-w-[var(--radix-popper-anchor-width,16rem)] p-0">
        <Command>
          <CommandInput placeholder="Search country..." />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {COUNTRY_OPTIONS.map((country) => (
                <CommandItem
                  key={country.alpha2}
                  value={country.name}
                  onSelect={() => handleSelect(country)}
                  >
                    <div className="flex w-full items-center gap-2 text-sm">
                      <CircleFlag
                        countryCode={country.alpha2.toLowerCase()}
                        height={18}
                        style={{ width: "18px", height: "18px" }}
                      />
                      <span className="truncate">{country.name}</span>
                    </div>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        selectedCountry?.alpha2 === country.alpha2
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

