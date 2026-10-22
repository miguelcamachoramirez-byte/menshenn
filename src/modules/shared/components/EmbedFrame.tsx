"use client";

import { useState } from "react";

type Props = {
  src: string;
  title: string;
  /** Permisos extra para iframes de video (YouTube, Vimeo, etc.) */
  allow?: string;
  allowFullScreen?: boolean;
};

// Iframe con placeholder de carga: mientras el contenido (PDF, presentacion,
// video) termina de cargar, muestra un spinner en vez de un recuadro negro.
export default function EmbedFrame({
  src,
  title,
  allow,
  allowFullScreen,
}: Props) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="embed-frame">
      {!loaded && (
        <div className="embed-loading" aria-hidden="true">
          <div className="spinner" />
          <span>Cargando contenido...</span>
        </div>
      )}
      <iframe
        src={src}
        title={title}
        allow={allow}
        allowFullScreen={allowFullScreen}
        onLoad={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0 }}
      />
    </div>
  );
}
