import React, { useEffect, useState, useRef } from "react";
import { ChevronDown, ChevronUp, Search, User, Globe } from "lucide-react";
import { getEntityId } from "../../utils/entityId";
import {
  getPatientPickerOptionById,
  getPatientPickerOptions,
} from "../../services/patientDirectory";
import { hasEnterpriseAccess } from "../../utils/clinicAccess";
import { getStoredUserObject } from "../../utils/authStorage";
import Input from "./Input";

export default function PatientPicker({
  value = "",
  onChange,
  label = "Patient",
  placeholder = "Choose a patient...",
  disabled = false,
  initialOption = null,
  required = false,
  allowClear = false,
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState(initialOption);
  const dropdownRef = useRef(null);

  const storedUser = getStoredUserObject() || {};
  const isEnterprise = hasEnterpriseAccess(storedUser?.clinic);
  const [globalSearch, setGlobalSearch] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (initialOption && getEntityId(initialOption) === value) {
      setSelectedOption(initialOption);
    }
  }, [initialOption, value]);

  useEffect(() => {
    let cancelled = false;

    if (!value) {
      setSelectedOption(null);
      return undefined;
    }

    if (selectedOption && getEntityId(selectedOption) === value) {
      return undefined;
    }

    const loadSelectedOption = async () => {
      try {
        const patient = await getPatientPickerOptionById(value);
        if (!cancelled) {
          setSelectedOption(patient);
        }
      } catch {
        if (!cancelled) {
          setSelectedOption(null);
        }
      }
    };

    loadSelectedOption();

    return () => {
      cancelled = true;
    };
  }, [selectedOption, value]);

  useEffect(() => {
    if (!isOpen || disabled) return undefined;

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        const results = await getPatientPickerOptions({
          search: query,
          limit: 20,
          global: globalSearch || undefined,
        });
        if (!cancelled) {
          setOptions(results);
        }
      } catch {
        if (!cancelled) {
          setOptions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 700);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [disabled, isOpen, query, globalSearch]);

  const handleSelect = (option) => {
    setSelectedOption(option);
    setIsOpen(false);
    setQuery("");
    onChange?.(getEntityId(option) || "");
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-slate-700">
          {label}
          {required ? " *" : ""}
        </label>
      )}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen((current) => !current)}
          disabled={disabled}
          className="flex h-[46px] w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-left text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
        >
          <div className="flex min-w-0 items-center gap-3">
            <User size={18} className="shrink-0 text-slate-400" />
            <span className={selectedOption ? "text-slate-900" : "text-slate-400"}>
              {selectedOption
                ? `${selectedOption.name}${selectedOption.cardNumber ? ` (${selectedOption.cardNumber})` : ""}`
                : placeholder}
            </span>
          </div>
          {isOpen ? (
            <ChevronUp size={18} className="shrink-0 text-slate-400" />
          ) : (
            <ChevronDown size={18} className="shrink-0 text-slate-400" />
          )}
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 p-2">
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search patient name or card..."
                icon={Search}
                className="h-10 text-sm"
              />
              {isEnterprise && (
                <div className="mt-2 flex items-center justify-between px-1">
                  <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                    <Globe size={12} /> Search entire clinic?
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGlobalSearch(s => !s);
                    }}
                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded transition-colors ${globalSearch ? "bg-primary-100 text-primary-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                  >
                    {globalSearch ? "ON" : "OFF"}
                  </button>
                </div>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {allowClear && value && (
                <button
                  type="button"
                  onClick={() => handleSelect({ id: "", name: "", cardNumber: "" })}
                  className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-slate-500 transition-colors hover:bg-slate-50"
                >
                  Clear selection
                </button>
              )}
              {loading ? (
                <p className="p-4 text-center text-sm italic text-slate-500">
                  Loading patients...
                </p>
              ) : options.length === 0 ? (
                <p className="p-4 text-center text-sm italic text-slate-500">
                  No patients matched.
                </p>
              ) : (
                options.map((option) => {
                  const optionId = getEntityId(option);
                  const isSelected = optionId === value;

                  return (
                    <button
                      key={optionId}
                      type="button"
                      onClick={() => handleSelect(option)}
                      className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "border-l-2 border-primary-500 bg-primary-50 pl-4"
                          : "hover:bg-slate-50 pl-4"
                      }`}
                    >
                      <span className="block text-sm font-semibold text-slate-900">
                        {option.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {[option.cardNumber, option.phone].filter(Boolean).join(" | ") || "No extra details"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
