import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || null;
  const position = process.env.ADMIN_POSITION?.trim() || null;

  if (!email || !password) {
    throw new Error(
      "Faltan ADMIN_EMAIL o ADMIN_PASSWORD en el archivo .env"
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Idempotente: crea el admin si no existe, o actualiza su contrasena/rol si ya existe
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "admin", name, position, mustChangePassword: false },
    create: {
      email,
      passwordHash,
      role: "admin",
      name,
      position,
      mustChangePassword: false,
    },
  });

  console.log(`Admin listo: ${user.email} (rol: ${user.role})`);
}

main()
  .catch((e) => {
    console.error("Error al crear el admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
