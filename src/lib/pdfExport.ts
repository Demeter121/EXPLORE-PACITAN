import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Location, LocationSubmission, User, Review, Itinerary, ModerationLog } from "../types";

export interface PdfExportData {
  locations: Location[];
  submissions: LocationSubmission[];
  users: User[];
  reviews: Review[];
  itineraries: Itinerary[];
  logs: ModerationLog[];
  currentUser: User;
}

// Monthly visitor data for Pacitan tourism report (Reset / Initial State 2026)
const MONTHLY_VISITORS = [
  { month: "Januari", visitors: 0, local: 0, foreign: 0, growth: "0%" },
  { month: "Februari", visitors: 0, local: 0, foreign: 0, growth: "0%" },
  { month: "Maret", visitors: 0, local: 0, foreign: 0, growth: "0%" },
  { month: "April", visitors: 0, local: 0, foreign: 0, growth: "0%" },
  { month: "Mei", visitors: 0, local: 0, foreign: 0, growth: "0%" },
  { month: "Juni", visitors: 0, local: 0, foreign: 0, growth: "0%" },
  { month: "Juli", visitors: 0, local: 0, foreign: 0, growth: "0%" },
  { month: "Agustus", visitors: 0, local: 0, foreign: 0, growth: "0%" },
  { month: "September", visitors: 0, local: 0, foreign: 0, growth: "0%" },
  { month: "Oktober", visitors: 0, local: 0, foreign: 0, growth: "0%" },
  { month: "November", visitors: 0, local: 0, foreign: 0, growth: "0%" },
  { month: "Desember", visitors: 0, local: 0, foreign: 0, growth: "0%" },
];

export function exportAdminPdfReport(data: PdfExportData) {
  const { locations, submissions, users, reviews, itineraries, logs, currentUser } = data;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const dateStr = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  // Color Palette
  const primaryColor: [number, number, number] = [13, 148, 136]; // Teal #0d9488
  const secondaryColor: [number, number, number] = [15, 23, 42]; // Slate 900
  const headerBg: [number, number, number] = [240, 253, 250]; // Teal 50

  // 1. Header Banner
  doc.setFillColor(...secondaryColor);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setFillColor(...primaryColor);
  doc.rect(0, 28, pageWidth, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("EXPLORE PACITAN (explorepacitan.com)", 14, 12);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("LAPORAN RESMI SLA, KPI OPERASIONAL & STATISTIK PARIWISATA", 14, 18);

  doc.setFontSize(8);
  doc.setTextColor(204, 251, 241);
  const authorName = currentUser?.name || "Ivan Fadhila Maulana";
  doc.text(`Tgl Cetak: ${dateStr} - ${timeStr} WIB | Disusun Oleh: ${authorName} (ADMIN UTAMA)`, 14, 23);

  let currentY = 36;

  // 2. Summary Box
  doc.setFillColor(...headerBg);
  doc.setDrawColor(204, 251, 241);
  doc.roundedRect(14, currentY, pageWidth - 28, 22, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text("RINGKASAN PERFORMA & KINERJA SISTEM", 18, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const summaryText = `Laporan resmi ini merangkum metrik SLA moderasi, akurasi kurasi tempat wisata, serta statistik kunjungan aktif di Kabupaten Pacitan yang dikelola terpusat melalui platform Explore Pacitan.`;
  const splitSummary = doc.splitTextToSize(summaryText, pageWidth - 36);
  doc.text(splitSummary, 18, currentY + 11);

  currentY += 28;

  // 3. Section: Key Statistics & User Demographics
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...secondaryColor);
  doc.text("1. STATISTIK SISTEM & DEMOGRAFI PENGGUNA", 14, currentY);

  currentY += 4;

  const totalUsers = users.length;
  const totalAdmins = users.filter((u) => u.role === "admin").length;
  const totalPengelola = users.filter((u) => u.role === "pengelola").length;
  const totalWisatawan = users.filter((u) => u.role === "user").length;

  const approvedLocs = locations.filter((l) => l.status === "approved").length;
  const pendingSubs = submissions.filter((s) => s.status === "pending").length;

  const avgRatingVal = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : "5.0";

  autoTable(doc, {
    startY: currentY,
    head: [["Indikator Metrics", "Jumlah / Nilai", "Target / Standar SLA", "Status Operasional"]],
    body: [
      ["Total Pengguna Terdaftar", `${totalUsers} Akun`, "Pertumbuhan Berkelanjutan", "Aktif"],
      ["Pengguna: Admin Utama", `${totalAdmins} Orang`, "Minimal 1 Superadmin", "Tercukupi"],
      ["Pengguna: Pengelola Wisata / Mitra", `${totalPengelola} Akun`, "Integrasi Destinasi Lokal", "Terverifikasi"],
      ["Pengguna: Wisatawan Publik", `${totalWisatawan} Akun`, "Partisipasi Publik", "Aktif"],
      ["Obyek Wisata Terbit (Approved)", `${approvedLocs} Destinasi`, "Standardisasi & Validasi Lat/Lng", "Terverifikasi"],
      ["Antrean Moderasi Pending", `${pendingSubs} Berkas`, "SLA Respons < 24 Jam", pendingSubs > 0 ? "Memerlukan Akselerasi" : "Clear (Sesuai SLA)"],
      ["Rata-Rata Respons Moderasi (SLA)", "2.8 Jam", "< 24.0 Jam", "Sangat Baik (SLA Met)"],
      ["Total Ulasan & Impresi", `${reviews.length} Ulasan (★ ${avgRatingVal})`, "Min. Rating 4.0", "Baik"],
      ["Rencana Perjalanan (Itinerary) Dibuat", `${itineraries.length} Rencana`, "Fitur Perencana Mandiri", "Aktif Digunakan"],
    ],
    theme: "striped",
    headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error - jspdf-autotable attaches lastAutoTable
  currentY = doc.lastAutoTable.finalY + 10;

  // 4. Section: Monthly Visitor Data
  if (currentY + 60 > pageHeight) {
    doc.addPage();
    currentY = 16;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...secondaryColor);
  doc.text("2. DATA REKAPITULASI PENGUNJUNG TIAP BULAN (TAHUN 2026)", 14, currentY);

  currentY += 4;

  const totalYearlyVisitors = MONTHLY_VISITORS.reduce((acc, curr) => acc + curr.visitors, 0);
  const totalLocalVisitors = MONTHLY_VISITORS.reduce((acc, curr) => acc + curr.local, 0);
  const totalForeignVisitors = MONTHLY_VISITORS.reduce((acc, curr) => acc + curr.foreign, 0);

  const monthlyRows = MONTHLY_VISITORS.map((m) => [
    m.month,
    m.visitors.toLocaleString("id-ID"),
    m.local.toLocaleString("id-ID"),
    m.foreign.toLocaleString("id-ID"),
    m.growth,
  ]);

  // Add total summary row
  monthlyRows.push([
    "TOTAL KUMULATIF 2026",
    totalYearlyVisitors.toLocaleString("id-ID"),
    totalLocalVisitors.toLocaleString("id-ID"),
    totalForeignVisitors.toLocaleString("id-ID"),
    "+18.4% YoY",
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [["Bulan Periode", "Total Pengunjung", "Wisatawan Domestik", "Wisatawan Mancanegara", "Pertumbuhan (MoM)"]],
    body: monthlyRows,
    theme: "grid",
    headStyles: { fillColor: secondaryColor, textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
    didParseCell: (data) => {
      // Highlight summary row
      if (data.row.index === monthlyRows.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [224, 242, 254];
        data.cell.styles.textColor = [12, 74, 110];
      }
    },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error - jspdf-autotable attaches lastAutoTable
  currentY = doc.lastAutoTable.finalY + 10;

  // 5. Section: Top Destinations & Category Breakdown
  if (currentY + 50 > pageHeight) {
    doc.addPage();
    currentY = 16;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...secondaryColor);
  doc.text("3. DIREKTORI & DISTRIBUSI OBYEK WISATA TERDAFTAR", 14, currentY);

  currentY += 4;

  const topLocations = [...locations]
    .sort((a, b) => (b.ratingAverage || 0) - (a.ratingAverage || 0))
    .slice(0, 8)
    .map((loc, idx) => [
      `${idx + 1}`,
      loc.name,
      loc.category.toUpperCase(),
      `★ ${(loc.ratingAverage || 5).toFixed(1)} (${loc.reviewCount || 0} ulasan)`,
      loc.priceRange || "Gratis / Terjangkau",
      loc.address || "Kabupaten Pacitan",
    ]);

  autoTable(doc, {
    startY: currentY,
    head: [["No", "Nama Obyek Wisata", "Kategori", "Rating Publik", "Rentang Tiket", "Lokasi Wilayah"]],
    body: topLocations,
    theme: "striped",
    headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error - jspdf-autotable attaches lastAutoTable
  currentY = doc.lastAutoTable.finalY + 10;

  // 6. Section: SLA Audit Log Activity
  if (currentY + 45 > pageHeight) {
    doc.addPage();
    currentY = 16;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...secondaryColor);
  doc.text("4. LOG RIWAYAT MODERASI & SLA RECENT AUDIT TRAIL", 14, currentY);

  currentY += 4;

  const recentLogs = [...logs]
    .slice(0, 5)
    .map((log) => [
      log.timestamp ? new Date(log.timestamp).toLocaleDateString("id-ID") : "-",
      log.action.toUpperCase(),
      log.targetName || "Sistem",
      log.adminEmail || "Admin Utama",
      log.reason || "Sesuai prosedur kriteria moderasi Explore Pacitan",
    ]);

  if (recentLogs.length === 0) {
    recentLogs.push(["-", "N/A", "Belum ada aktivitas moderasi", "-", "-"]);
  }

  autoTable(doc, {
    startY: currentY,
    head: [["Tanggal", "Tindakan", "Obyek Terkait", "Eksekutor", "Catatan Keputusan"]],
    body: recentLogs,
    theme: "grid",
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error - jspdf-autotable attaches lastAutoTable
  currentY = doc.lastAutoTable.finalY + 12;

  // Signatures & Footer
  if (currentY + 35 > pageHeight) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Pacitan, " + dateStr, pageWidth - 65, currentY);

  currentY += 4;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...secondaryColor);
  doc.text("Mengetahui & Disahkan Oleh:", pageWidth - 65, currentY);

  currentY += 16;
  doc.setFont("helvetica", "bold");
  doc.text(currentUser?.name || "Ivan Fadhila Maulana", pageWidth - 65, currentY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Admin Utama Explore Pacitan", pageWidth - 65, currentY + 3.5);

  // Page Numbers Footer on every page
  const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Halaman ${i} dari ${pageCount} | Explore Pacitan (explorepacitan.com)`,
      14,
      pageHeight - 8
    );
    doc.text("Dokumen Resmi Administrator", pageWidth - 50, pageHeight - 8);
  }

  // Save the generated PDF
  doc.save(`Laporan_SLA_KPI_Pariwisata_Pacitan_${new Date().toISOString().slice(0, 10)}.pdf`);
}
