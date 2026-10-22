// Configuracion central de modulos de la plataforma.
// Agregar un modulo nuevo = agregar un objeto aqui. El launcher (home) y
// la navegacion se construyen a partir de esta lista.
//
// Preparado para agrupar por areas de la empresa mas adelante: cada modulo
// tiene un campo "area". Hoy todos van en "general"; cuando se quiera, se
// agrupan las tarjetas por area sin tocar la logica.

export type AppModule = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: string; // emoji simple por ahora; luego puede ser un componente
  adminOnly: boolean;
  area: string;
};

// Modulos reales de la plataforma. Metricas y Tipos de reporte NO son modulos:
// pertenecen al modulo de Reportes y se acceden desde dentro de el.
export const MODULES: AppModule[] = [
  {
    id: "reportes",
    label: "Reportes",
    description:
      "Reporta actos y condiciones inseguras, con metricas y tipos de reporte.",
    href: "/reportes",
    icon: "📋",
    adminOnly: false,
    area: "SST",
  },
  {
    id: "capacitaciones",
    label: "Capacitaciones",
    description:
      "Monta capacitaciones reutilizables y gestiona convocatorias y asistencia.",
    href: "/capacitaciones",
    icon: "🎓",
    adminOnly: true,
    area: "SST",
  },
  {
    id: "usuarios",
    label: "Usuarios",
    description: "Crea usuarios, asigna roles y restablece contrasenas.",
    href: "/admin",
    icon: "👥",
    adminOnly: true,
    area: "Administracion",
  },
];

// Devuelve los modulos visibles segun el rol, agrupados por area (en orden).
export function getVisibleModulesByArea(isAdmin: boolean) {
  const visible = MODULES.filter((m) => isAdmin || !m.adminOnly);
  const areas: { area: string; modules: AppModule[] }[] = [];
  for (const m of visible) {
    let group = areas.find((a) => a.area === m.area);
    if (!group) {
      group = { area: m.area, modules: [] };
      areas.push(group);
    }
    group.modules.push(m);
  }
  return areas;
}
