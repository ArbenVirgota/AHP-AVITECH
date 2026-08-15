import nodemailer from 'nodemailer';

// Konfigurasi transporter SMTP Hostinger
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true, // true untuk port 465 (SSL), false untuk 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendConsultationEmails({
  expertEmail,
  expertName,
  userEmail,
  userName,
  ticketId,
  topik,
  pertanyaan,
}) {
  try {
    // 1. Kirim Email Notifikasi ke Expert (Pakar)
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
      replyTo: userEmail, // Memungkinkan pakar langsung membalas ke email pemohon
    });

    // 2. Kirim Email Bukti Pengajuan ke User (Pemohon)
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
  } catch (error) {
    console.error("Gagal mengirim email via SMTP Hostinger:", error);
    return { success: false, error: error.message };
  }
}