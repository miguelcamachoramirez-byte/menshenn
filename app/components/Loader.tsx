export default function Loader({ text = "Cargando..." }: { text?: string }) {
  return (
    <div className="loader-wrap">
      <div className="spinner" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
