import { CartItem } from "@/context/CartContext";

export function generateQuotePdf(
  items: CartItem[],
  financials: {
    subtotal: number;
    gstAmount: number;
    totalAmount: number;
  },
  customerInfo?: {
    companyName?: string;
    contactName?: string;
    email?: string;
    mobile?: string;
    address?: string;
    gstin?: string;
  }
) {
  if (typeof window === "undefined" || items.length === 0) return;

  const quoteNumber = `QT-${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
  const quoteDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const printWindow = window.open("", "_blank", "width=900,height=800");
  if (!printWindow) {
    alert("Please allow popups to download your official PDF quote.");
    return;
  }

  const itemsHtml = items
    .map((item, idx) => {
      // Build exhaustive specification string from all table info
      const specList: string[] = [];
      if (item.specifications) {
        Object.entries(item.specifications).forEach(([k, v]) => {
          if (v && k !== "ShortDescription" && k !== "Tag") {
            specList.push(`<strong>${k}:</strong> ${v}`);
          }
        });
      }

      const specsFormatted = specList.length > 0 
        ? `<div style="font-size: 10px; color: #475569; margin-top: 3px; line-height: 1.4;">${specList.join(" &bull; ")}</div>` 
        : "";

      const lineTotal = item.unitPrice * item.quantity;

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 10px 8px; text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="padding: 10px 8px; font-family: monospace; font-weight: 700; color: #024ae5;">
            ${item.sku}
          </td>
          <td style="padding: 10px 8px;">
            <div style="font-weight: 700; color: #0f172a; font-size: 12px;">${item.title}</div>
            ${specsFormatted}
          </td>
          <td style="padding: 10px 8px; text-align: center; font-weight: 700; color: #0f172a;">${item.quantity}</td>
          <td style="padding: 10px 8px; text-align: right; font-family: monospace; font-weight: 600; color: #334155;">
            ₹${item.unitPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </td>
          <td style="padding: 10px 8px; text-align: right; font-family: monospace; font-weight: 700; color: #0f172a;">
            ₹${lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </td>
        </tr>
      `;
    })
    .join("");

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Official Price Quotation - ${quoteNumber}</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        body {
          background-color: #ffffff;
          color: #0f172a;
          padding: 32px 40px;
          line-height: 1.5;
        }
        .header-table {
          width: 100%;
          border-bottom: 2px solid #024ae5;
          padding-bottom: 20px;
          margin-bottom: 24px;
        }
        .brand-title {
          font-size: 22px;
          font-weight: 900;
          color: #024ae5;
          letter-spacing: -0.5px;
        }
        .brand-sub {
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .meta-box {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 14px 18px;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
        }
        .items-table th {
          background-color: #0f172a;
          color: #ffffff;
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 700;
          padding: 10px 8px;
          letter-spacing: 0.5px;
        }
        .totals-table {
          width: 340px;
          margin-left: auto;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        .totals-table td {
          padding: 6px 10px;
          font-size: 11px;
        }
        .terms-box {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 14px 18px;
          font-size: 10px;
          color: #475569;
          margin-bottom: 30px;
        }
        .footer-sign {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
        }
        @media print {
          body {
            padding: 15mm;
          }
          .no-print {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="background: #024ae5; color: #fff; padding: 12px 20px; border-radius: 6px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 12px; font-weight: 600;">Click print or save as PDF to download this official quotation.</span>
        <button onclick="window.print()" style="background: #fff; color: #024ae5; border: 0; padding: 6px 16px; border-radius: 4px; font-weight: 700; cursor: pointer; font-size: 12px;">
          Save / Print as PDF
        </button>
      </div>

      <!-- Corporate Header -->
      <table class="header-table">
        <tr>
          <td style="vertical-align: top;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
              <img src="/assets/sojar-logo.webp" alt="Sojar Indusy" style="height: 38px; width: 38px; object-fit: contain;" />
              <div>
                <div class="brand-title">SOJAR INDUSY</div>
                <div class="brand-sub">Industrial Precision Tooling & CNC Fasteners</div>
              </div>
            </div>
            <div style="font-size: 10px; color: #64748b; margin-top: 6px; line-height: 1.4;">
              Plot No. W-48, MIDC Bhosari Industrial Estate, Pune, Maharashtra - 411026<br/>
              <strong>GSTIN:</strong> 27AASCS8920K1ZX &bull; <strong>Email:</strong> sales@sojarindusy.com<br/>
              <strong>Engineering Hotline:</strong> +91 (020) 2712-8940 / +91 98207 01219
            </div>
          </td>
          <td style="vertical-align: top; text-align: right;">
            <div style="font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
              Commercial Price Quotation
            </div>
            <div style="font-size: 12px; font-family: monospace; font-weight: 700; color: #024ae5; margin-top: 2px;">
              ${quoteNumber}
            </div>
            <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
              <strong>Date:</strong> ${quoteDate}<br/>
              <strong>Valid Until:</strong> ${validUntil} (30 Days)
            </div>
          </td>
        </tr>
      </table>

      <!-- Client & Dispatch Info -->
      <div class="meta-box">
        <div>
          <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 2px;">
            Quotation Prepared For
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #0f172a;">
            ${customerInfo?.companyName || "Valued Enterprise Client"}
          </div>
          <div style="font-size: 10px; color: #475569; margin-top: 2px;">
            <strong>Attn:</strong> ${customerInfo?.contactName || "Procurement & Tooling Engineering Team"}<br/>
            ${customerInfo?.email ? `<strong>Email:</strong> ${customerInfo.email} &bull; ` : ""}
            ${customerInfo?.mobile ? `<strong>Tel:</strong> ${customerInfo.mobile}` : ""}
            ${customerInfo?.gstin ? `<br/><strong>Client GSTIN:</strong> ${customerInfo.gstin}` : ""}
          </div>
        </div>

        <div style="text-align: right;">
          <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 2px;">
            Manufacturing & Dispatch Facility
          </div>
          <div style="font-size: 11px; font-weight: 700; color: #0f172a;">
            Sojar Indusy Plant 1 (Bhosari MIDC)
          </div>
          <div style="font-size: 10px; color: #475569; margin-top: 2px;">
            <strong>Dispatch Mode:</strong> Direct Plant Logistics<br/>
            <strong>Payment Terms:</strong> 100% Against Dispatch / Commercial Credit<br/>
            <strong>Material QC:</strong> Laser Micrometer Inspected
          </div>
        </div>
      </div>

      <!-- Itemized Quotation Table -->
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">#</th>
            <th style="width: 140px; text-align: left;">SKU Code</th>
            <th style="text-align: left;">Tooling Description & Specifications</th>
            <th style="width: 60px; text-align: center;">Qty</th>
            <th style="width: 100px; text-align: right;">Unit Rate (₹)</th>
            <th style="width: 110px; text-align: right;">Taxable Value (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <!-- Financial Totals -->
      <table class="totals-table">
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="color: #64748b; font-weight: 600;">Taxable Subtotal</td>
          <td style="text-align: right; font-family: monospace; font-weight: 700; color: #0f172a;">
            ₹${financials.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="color: #64748b; font-weight: 600;">Standard CGST + SGST (18%)</td>
          <td style="text-align: right; font-family: monospace; font-weight: 700; color: #0f172a;">
            ₹${financials.gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </td>
        </tr>
        <tr style="background-color: #f1f5f9;">
          <td style="font-size: 13px; font-weight: 800; color: #024ae5;">Total Commercial Value</td>
          <td style="text-align: right; font-family: monospace; font-size: 14px; font-weight: 800; color: #024ae5;">
            ₹${financials.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </td>
        </tr>
      </table>

      <!-- Commercial Terms & Bank Info -->
      <div class="terms-box">
        <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px; text-transform: uppercase; font-size: 10px;">
          Commercial Terms & Conditions:
        </div>
        <ol style="padding-left: 14px; line-height: 1.6;">
          <li><strong>Validity:</strong> This quotation is strictly valid for 30 calendar days from the date of issuance.</li>
          <li><strong>Tolerances & Quality:</strong> Tooling dimensions adhere to DIN 6527L / ISO tolerance standards. Mill test certificates provided upon request.</li>
          <li><strong>Delivery:</strong> Standard items dispatched within 24–48 hours; custom CNC tooling within 3–5 business days.</li>
          <li><strong>Payment Remittance (NEFT/RTGS):</strong> A/C Name: <strong>SOJAR INDUSY LLP</strong> &bull; Bank: HDFC Bank Ltd &bull; A/C No: 50200084920194 &bull; IFSC: HDFC0001812 &bull; Branch: Bhosari MIDC, Pune.</li>
        </ol>
      </div>

      <!-- Signatures -->
      <div class="footer-sign">
        <div style="font-size: 10px; color: #64748b;">
          This is a computer-generated commercial price quotation.<br/>
          For bulk quantity revisions or custom drawing tenders, contact <strong>rfq@sojarindusy.com</strong>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 11px; font-weight: 700; color: #0f172a;">For SOJAR INDUSY</div>
          <div style="height: 40px;"></div>
          <div style="font-size: 10px; font-weight: 600; color: #475569; border-top: 1px dashed #cbd5e1; padding-top: 4px; width: 180px;">
            Authorized Commercial Signatory
          </div>
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
