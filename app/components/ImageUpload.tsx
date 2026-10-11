"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";

type Props = {
  // Imagen ya guardada (URL) al editar un reporte existente
  existingUrl?: string | null;
  // Archivo seleccionado (aun sin subir)
  file: File | null;
  onSelect: (file: File | null) => void;
};

export default function ImageUpload({ existingUrl, file, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Genera una previsualizacion local del archivo seleccionado
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(f: File | undefined | null) {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("El archivo debe ser una imagen.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("La imagen supera el limite de 5 MB.");
      return;
    }
    onSelect(f);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    pick(e.dataTransfer.files?.[0]);
  }

  // Lo que se muestra: la preview del archivo nuevo o la imagen existente
  const shown = preview || existingUrl || null;

  return (
    <div className="image-upload">
      {shown ? (
        <div className="image-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown} alt="Imagen del reporte" />
          <button
            type="button"
            className="btn btn-danger image-remove"
            onClick={() => {
              onSelect(null);
              setPreview(null);
            }}
          >
            Quitar
          </button>
        </div>
      ) : (
        <div
          className={`dropzone ${dragOver ? "dragover" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
        >
          <span className="dropzone-icon" aria-hidden="true">
            🖼
          </span>
          <span>
            Arrastra una imagen aqui o <strong>haz clic</strong> para
            seleccionar
          </span>
          <span className="dropzone-hint">
            JPG, PNG, WEBP o GIF (max 5 MB)
          </span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {error && <span className="image-error">{error}</span>}
    </div>
  );
}
