import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Mengambil data pengguna berdasarkan email (pengganti fungsi pencarian Google Sheets)
 */
export async function findUserByEmail(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    return user;
  } catch (error) {
    console.error('Error findUserByEmail:', error);
    return null;
  }
}

/**
 * Menyimpan atau mendaftarkan pengguna baru ke database MySQL Hostinger
 */
export async function createUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role?: string;
  status?: string;
}) {
  try {
    const newUser = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash,
        role: data.role || 'USER',
        status: data.status || 'ACTIVE',
      },
    });
    return newUser;
  } catch (error) {
    console.error('Error createUser:', error);
    throw error;
  }
}

/**
 * Mengambil daftar proyek milik pengguna tertentu
 */
export async function getProjectsByUser(userEmail: string) {
  try {
    // Mencari proyek berdasarkan email fasilitator atau user terkait
    const projects = await prisma.project.findMany({
      where: {
        fasilitatorEmail: userEmail.toLowerCase().trim(),
      },
    });
    return projects;
  } catch (error) {
    console.error('Error getProjectsByUser:', error);
    return [];
  }
}