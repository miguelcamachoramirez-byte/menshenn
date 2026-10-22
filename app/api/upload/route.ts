import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin, SUPABASE_BUCKET } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const DOC_TYPES = ["application/pdf"];
const MAX_IMAGE = 5 * 1024 * 1024; // 5 MB
const MAX_DOC = 20 * 1024 * 1024; // 20 MB

// POST /api/upload -> sube un archivo (imagen o PDF) a Supabase y devuelve su URL
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No se recibio ningun archivo." },
        { status: 400 }
      );
    }

    const isImage = IMAGE_TYPES.includes(file.type);
    const isDoc = DOC_TYPES.includes(file.type);

    if (!isImage && !isDoc) {
      return NextResponse.json(
        { error: "Formato no permitido. Usa una imagen (JPG/PNG/WEBP/GIF) o un PDF." },
        { status: 400 }
      );
    }

    const limit = isImage ? MAX_IMAGE : MAX_DOC;
    if (file.size > limit) {
      return NextResponse.json(
        {
          error: isImage
            ? "La imagen supera el limite de 5 MB."
            : "El PDF supera el limite de 20 MB.",
        },
        { status: 400 }
      );
    }

    const ext = (file.name.split(".").pop() || (isImage ? "jpg" : "pdf"))
      .toLowerCase();
    const path = `${session.userId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;

    const bytes = Buffer.from(await file.arrayBuffer());

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(path, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("Error al subir a Supabase:", error.message);
      return NextResponse.json(
        { error: "No se pudo subir el archivo." },
        { status: 500 }
      );
    }

    const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);

    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    console.error("Error en upload:", error);
    return NextResponse.json(
      { error: "No se pudo subir el archivo." },
      { status: 500 }
    );
  }
}
