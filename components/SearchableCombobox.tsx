import React, { useEffect, useMemo, useRef, useState } from "react";

export type ComboboxOption = {
  key: string;
  value: string;
  label?: string;
  description?: string;
};

interface SearchableComboboxProps {
  value: string;
  onChange: (nextValue: string) => void;
  onSelect?: (option: ComboboxOption) => void;
  allOptions: ComboboxOption[];
  filteredOptions: ComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}

const SearchableCombobox: React.FC<SearchableComboboxProps> = ({
  value,
  onChange,
  onSelect,
  allOptions,
  filteredOptions,
  placeholder = "Nhập để lọc",
  emptyText = "Không tìm thấy kết quả phù hợp.",
  disabled = false,
  className = "",
  inputClassName = "",
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [browseMode, setBrowseMode] = useState(true);
  const [activeIndex, setActiveIndex] = useState(-1);

  const visibleOptions = useMemo(() => {
    const source = browseMode ? allOptions : filteredOptions;
    const dedupe = new Set<string>();
    const next: ComboboxOption[] = [];

    for (const option of source) {
      const key = `${option.key}|${option.value}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);
      next.push(option);
    }

    return next;
  }, [allOptions, browseMode, filteredOptions]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setBrowseMode(true);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setActiveIndex(-1);
      return;
    }

    if (!visibleOptions.length) {
      setActiveIndex(-1);
      return;
    }

    setActiveIndex((prev) => {
      if (prev < 0) return 0;
      if (prev >= visibleOptions.length) return visibleOptions.length - 1;
      return prev;
    });
  }, [isOpen, visibleOptions]);

  const handleSelect = (option: ComboboxOption) => {
    onChange(option.value);
    onSelect?.(option);
    setIsOpen(false);
    setBrowseMode(true);
    setActiveIndex(-1);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const openBrowseMenu = () => {
    if (disabled) return;
    setBrowseMode(true);
    setIsOpen(true);
  };

  const selectedValue = value.trim().toLowerCase();

  return (
    <div ref={containerRef} className={`relative ${className}`.trim()}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          disabled={disabled}
          autoComplete="off"
          onFocus={() => {
            openBrowseMenu();
            window.setTimeout(() => inputRef.current?.select(), 0);
          }}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(nextValue);
            setBrowseMode(false);
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (disabled) return;

            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((prev) => {
                if (!visibleOptions.length) return -1;
                return prev < visibleOptions.length - 1 ? prev + 1 : 0;
              });
              return;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((prev) => {
                if (!visibleOptions.length) return -1;
                return prev > 0 ? prev - 1 : visibleOptions.length - 1;
              });
              return;
            }

            if (event.key === "Enter") {
              if (isOpen && activeIndex >= 0 && visibleOptions[activeIndex]) {
                event.preventDefault();
                handleSelect(visibleOptions[activeIndex]);
              }
              return;
            }

            if (event.key === "Escape") {
              setIsOpen(false);
              setBrowseMode(true);
              setActiveIndex(-1);
            }
          }}
          placeholder={placeholder}
          className={`h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 pr-12 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${inputClassName}`.trim()}
        />

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onMouseDown={(event) => {
            event.preventDefault();
            if (isOpen) {
              setIsOpen(false);
              setBrowseMode(true);
              setActiveIndex(-1);
              return;
            }
            openBrowseMenu();
            inputRef.current?.focus();
          }}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-600 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300"
          aria-label="Mở danh sách"
          title="Mở danh sách"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-5 w-5 transition ${isOpen ? "rotate-180" : ""}`.trim()}
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 011.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0l-4.25-4.51a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {visibleOptions.length ? (
            <div className="max-h-72 overflow-y-auto p-1.5">
              {visibleOptions.map((option, index) => {
                const isSelected = option.value.trim().toLowerCase() === selectedValue;
                const isActive = index === activeIndex;

                return (
                  <button
                    key={`${option.key}-${option.value}`}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      handleSelect(option);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      isActive || isSelected
                        ? "bg-amber-50 text-amber-900"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{option.label || option.value}</div>
                      {option.description ? (
                        <div className="mt-0.5 truncate text-xs text-slate-500">
                          {option.description}
                        </div>
                      ) : null}
                    </div>
                    {isSelected ? (
                      <span className="shrink-0 text-amber-700">✓</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-slate-500">{emptyText}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableCombobox;
