import nodemailer from 'nodemailer';

// Konfigurasi transporter SMTP Hostinger yang sudah ada
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true, // true untuk port 465 (SSL), false untuk 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// 1. Fungsi lama (Tetap dipertahankan untuk fitur konsultasi pakar)
export async function sendConsultationEmails({
  expertEmail,
  expertName,
  userEmail,
  userName,
  ticketId,
  topik,
  pertanyaan,
}: {
  expertEmail: string;
  expertName: string;
  userEmail: string;
  userName: string;
  ticketId: string;
  topik: string;
  pertanyaan: string;
}) {
  try {
    const subjectExpert = `📩 [Pertanyaan Konsultasi Baru #${ticketId}] dari ${userName}`;
    const htmlExpert = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h2 style="color: #1e3a8a; margin-top: 0;">Halo ${expertName} 👋</h2>
        <p>Anda menerima pertanyaan konsultasi baru melalui <strong>Platform Riset AHP Avitech</strong>.</p>
        <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 16px 0;"/>
        <p><strong>ID Tiket:</strong> #${ticketId}</p>
        <p><strong>Nama Pemohon:</strong> ${userName} (${userEmail})</p>
        <p><strong>Topik Penelitian:</strong> ${topik}</p>
        <p><strong>Isi Pertanyaan:</strong></p>
        <blockquote style="background: #f8fafc; border-left: 4px solid #1e3a8a; padding: 12px; margin: 0; font-style: italic;">
          ${pertanyaan}
        </blockquote>
        <br/>
        <p>Silakan login ke Dashboard Anda untuk membalas konsultasi ini.</p>
        <p>Salam,<br/><strong>Tim Admin Platform AHP Avitech</strong></p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Admin AHP Avitech" <${process.env.SMTP_USER}>`,
      to: expertEmail,
      subject: subjectExpert,
      html: htmlExpert,
      replyTo: userEmail,
    });

    const subjectUser = `✅ [Bukti Pengajuan Tiket #${ticketId}] Berhasil Dikirim ke ${expertName}`;
    const htmlUser = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h2 style="color: #15803d; margin-top: 0;">Halo ${userName} 👋</h2>
        <p>Tiket konsultasi Anda telah <strong>berhasil dikirimkan</strong> kepada Pakar tujuan.</p>
        <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 16px 0;"/>
        <p><strong>ID Tiket:</strong> #${ticketId}</p>
        <p><strong>Pakar Tujuan:</strong> ${expertName}</p>
        <p><strong>Topik:</strong> ${topik}</p>
        <p>Tiket Anda saat ini berstatus <strong>Diteruskan ke Expert</strong>. Anda bisa memantau status atau balasan dari pakar langsung di halaman Dashboard Ruang Kerja Anda.</p>
        <br/>
        <p>Salam,<br/><strong>Tim Admin Platform AHP Avitech</strong></p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Admin AHP Avitech" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject: subjectUser,
      html: htmlUser,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Gagal mengirim email via SMTP Hostinger:", error);
    return { success: false, error: error.message };
  }
}

// 🟢 2. FUNGSI BARU: Verifikasi & Aktivasi Email Pendaftaran Akun
export async function sendVerificationEmail(email: string, nama: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const verificationLink = `${baseUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

  const mailOptions = {
    from: `"AHP Avitech" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Verifikasi & Aktivasi Akun Anda - AHP Avitech',
    html: `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Verifikasi Akun</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 10px;">
          <tr>
            <td align="center">
              <table width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px;" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h2 style="font-size: 20px; color: #0f172a; margin-top: 0; font-weight: 700;">Konfirmasi Email Akun AHP</h2>
                    <p style="font-size: 14px; color: #475569; line-height: 1.6;">
                      Halo <strong>${nama}</strong>,
                    </p>
                    <p style="font-size: 14px; color: #475569; line-height: 1.6;">
                      Terima kasih telah mendaftar di sistem AHP Avitech. Silakan klik tombol di bawah ini untuk mengaktifkan akun dan memverifikasi email aktif Anda:
                    </p>

                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
                      <tr>
                        <td align="center">
                          <a href="${verificationLink}" target="_blank" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;">
                            Aktivasi &amp; Verifikasi Akun
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="font-size: 12.5px; color: #64748b; line-height: 1.5;">
                      Tautan ini berlaku selama <strong>24 jam</strong>. Jika tombol tidak bisa diklik, salin tautan berikut ke peramban:
                    </p>
                    <p style="font-size: 12px; word-break: break-all; background-color: #f1f5f9; padding: 10px; border-radius: 6px; color: #2563eb;">
                      ${verificationLink}
                    </p>

                    <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 16px 0;" />
                    <p style="font-size: 11px; color: #94a3b8; margin: 0;">
                      Jika Anda tidak pernah mendaftar di platform AHP Avitech, abaikan email ini.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  return await transporter.sendMail(mailOptions);
}