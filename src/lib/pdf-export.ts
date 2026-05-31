import jsPDF from "jspdf";

type LotForExport = {
  id: number;
  de_contrato: string;
  lot_number: string;
  karat?: string;
  peso_lote?: string;
  valor?: number;
  winning_bid_value?: number;
  sg_uf?: string;
  co_leilao?: string;
};

function formatPrice(price: number | null | undefined): string {
  if (!price) return "R$ --";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(price);
}

export async function exportWatchlistToPDF(items: LotForExport[], stats?: { median?: number; min?: number; max?: number; count?: number }) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Colors as individual RGB values (jsPDF spread typing is strict)
  const primaryR = 88, primaryG = 101, primaryB = 242;
  const textR = 30, textG = 30, textB = 35;
  const mutedR = 100, mutedG = 100, mutedB = 110;
  const borderR = 60, borderG = 62, borderB = 68;

  // Header
  doc.setFillColor(primaryR, primaryG, primaryB);
  doc.rect(0, 0, pageWidth, 32, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("RadarJóias", 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Relatório de Watchlist", pageWidth - 14, 14, { align: "right" });
  doc.text(new Date().toLocaleDateString("pt-BR"), pageWidth - 14, 21, { align: "right" });

  let y = 45;

  // Summary stats
  if (stats && stats.count) {
    doc.setFillColor(245, 245, 250);
    doc.roundedRect(14, y - 5, pageWidth - 28, 22, 3, 3, "F");

    doc.setTextColor(mutedR, mutedG, mutedB);
    doc.setFontSize(8);
    doc.text("MEDIANA", 20, y + 2);
    doc.setTextColor(textR, textG, textB);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(formatPrice(stats.median), 20, y + 11);

    doc.setTextColor(mutedR, mutedG, mutedB);
    doc.setFontSize(8);
    doc.text("MÍN", 75, y + 2);
    doc.setTextColor(textR, textG, textB);
    doc.setFontSize(11);
    doc.text(formatPrice(stats.min), 75, y + 11);

    doc.setTextColor(mutedR, mutedG, mutedB);
    doc.setFontSize(8);
    doc.text("MÁX", 115, y + 2);
    doc.setTextColor(textR, textG, textB);
    doc.setFontSize(11);
    doc.text(formatPrice(stats.max), 115, y + 11);

    doc.setTextColor(mutedR, mutedG, mutedB);
    doc.setFontSize(8);
    doc.text("AMOSTRAS", 150, y + 2);
    doc.setTextColor(textR, textG, textB);
    doc.setFontSize(11);
    doc.text(`${Number(stats.count).toLocaleString("pt-BR")}`, 150, y + 11);

    y += 30;
  }

  // Table header
  doc.setFillColor(245, 245, 250);
  doc.rect(14, y, pageWidth - 28, 10, "F");

  doc.setTextColor(mutedR, mutedG, mutedB);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("LOTE", 18, y + 7);
  doc.text("DESCRIÇÃO", 42, y + 7);
  doc.text("PESO", 115, y + 7);
  doc.text("KARAT", 138, y + 7);
  doc.text("ESTADO", 158, y + 7);
  doc.text("LANCE INICIAL", 172, y + 7);

  y += 14;

  doc.setDrawColor(borderR, borderG, borderB);
  doc.setLineWidth(0.2);
  doc.line(14, y - 4, pageWidth - 14, y - 4);

  // Table rows
  doc.setFont("helvetica", "normal");
  items.forEach((item, idx) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    // Alternating row background
    if (idx % 2 === 0) {
      doc.setFillColor(252, 252, 254);
      doc.rect(14, y - 6, pageWidth - 28, 14, "F");
    }

    doc.setTextColor(textR, textG, textB);
    doc.setFontSize(8);

    // Lot number
    doc.setFont("helvetica", "bold");
    doc.text(`#${item.lot_number || item.id}`, 18, y + 2);
    doc.setFont("helvetica", "normal");

    // Description
    const desc = (item.de_contrato || "Joia").substring(0, 40);
    doc.text(desc, 42, y + 2);

    // Weight
    doc.setTextColor(mutedR, mutedG, mutedB);
    doc.text(item.peso_lote || "—", 115, y + 2);

    // Karat
    doc.text(item.karat || "—", 138, y + 2);

    // State
    doc.text(item.sg_uf || "—", 158, y + 2);

    // Price
    doc.setTextColor(textR, textG, textB);
    doc.setFont("helvetica", "bold");
    doc.text(formatPrice(item.valor), 172, y + 2);
    doc.setFont("helvetica", "normal");

    y += 14;
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(mutedR, mutedG, mutedB);
    doc.setFontSize(7);
    doc.text(
      `RadarJóias — Relatório de Watchlist — Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
    doc.text(
      "Dados meramente informativos. Não constitui orientação de investimento.",
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 5,
      { align: "center" }
    );
  }

  doc.save("radar-joias-watchlist.pdf");
}