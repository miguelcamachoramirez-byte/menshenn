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

  const [working, setWorking] = useState(false);

  // Comprime y redimensiona la imagen en el navegador antes de subirla.
  // Reduce mucho el peso (ej. 3 MB -> ~300 KB), ahorrando almacenamiento.
  async function compressImage(f: File): Promise<File> {
    // Los GIF no se comprimen (se perderia la animacion)
    if (f.type === "image/gif") return f;

    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

    const MAX = 1600; // lado maximo en px
    let { width, height } = img;
    if (width > MAX || height > MAX) {
      if (width >= height) {
        height = Math.round((height * MAX) / width);
        width = MAX;
      } else {
        width = Math.round((width * MAX) / height);
        height = MAX;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return f;
    ctx.drawImage(img, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8)
    );
    if (!blob) return f;

    // Si por algun motivo quedo mas pesada que el original, usa el original
    if (blob.size >= f.size) return f;

    const name = f.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  }

  async function pick(f: File | undefined | null) {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("El archivo debe ser una imagen.");
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      setError("La imagen es demasiado grande (max 15 MB).");
      return;
    }
    try {
      setWorking(true);
      const compressed = await compressImage(f);
      onSelect(compressed);
    } catch {
      // Si la compresion falla, usa el original
      onSelect(f);
    } finally {
      setWorking(false);
    }
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
          {working ? (
            <span>Procesando imagen...</span>
          ) : (
            <>
              <span className="dropzone-icon" aria-hidden="true">
                🖼
              </span>
              <span>
                Arrastra una imagen aqui o <strong>haz clic</strong> para
                seleccionar
              </span>
              <span className="dropzone-hint">
                Se optimiza automaticamente (JPG, PNG, WEBP o GIF)
              </span>
            </>
          )}
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
