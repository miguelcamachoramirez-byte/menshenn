"use client";

import { useEffect, useRef, useState } from "react";

export type Option = {
  value: string;
  label: string;
  sub?: string | null;
};

type Props = {
  options: Option[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
};

export default function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Selecciona...",
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cierra al hacer clic fuera
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  }

  const selectedOptions = options.filter((o) => selected.includes(o.value));

  return (
    <div className="ms" ref={ref}>
      <button
        type="button"
        className="ms-control"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="ms-tags">
          {selectedOptions.length === 0 ? (
            <span className="ms-placeholder">{placeholder}</span>
          ) : (
            selectedOptions.map((o) => (
              <span key={o.value} className="ms-tag">
                {o.label}
                <span
                  className="ms-tag-x"
                  role="button"
                  aria-label={`Quitar ${o.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(o.value);
                  }}
                >
                  ×
                </span>
              </span>
            ))
          )}
        </div>
        <span className={`ms-arrow ${open ? "open" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="ms-menu">
          {options.length === 0 ? (
            <div className="ms-empty">No hay opciones.</div>
          ) : (
            options.map((o) => {
              const checked = selected.includes(o.value);
              return (
                <label key={o.value} className="ms-item">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(o.value)}
                  />
                  <span>
                    {o.label}
                    {o.sub ? <span className="ms-sub"> · {o.sub}</span> : null}
                  </span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
