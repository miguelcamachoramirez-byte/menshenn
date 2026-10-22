// Etiquetas visibles de los roles. El valor interno ("user"/"admin") no cambia;
// esto es solo lo que se le muestra a la persona.

export function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case "admin":
      return "Administrador";
    case "user":
      return "Colaborador";
    default:
      return role || "Colaborador";
  }
}
