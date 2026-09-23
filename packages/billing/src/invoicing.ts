import PDFDocument from 'pdfkit';
import { Decimal } from 'decimal.js';
import { logger } from '@threadsight/core/logging';

export interface InvoiceData {
  invoiceNumber: string;
  bookingNumber: string;
  issuedAt: Date;
  dueDate: Date;
  customer: {
    name: string;
    email: string;
    address?: { street: string; city: string; state: string; zip: string; country: string };
  };
  vehicle: {
    make: string;
    model: string;
    licensePlate: string;
  };
  rentalPeriod: { start: Date; end: Date; days: number };
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: Decimal;
    totalPrice: Decimal;
    type: 'RENTAL' | 'EXTRA' | 'DEPOSIT' | 'FEE' | 'TAX' | 'DISCOUNT' | 'REFUND';
  }>;
  subtotal: Decimal;
  taxAmount: Decimal;
  totalAmount: Decimal;
  paidAmount: Decimal;
  status: string;
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc, data);
    drawCustomerInfo(doc, data);
    drawVehicleInfo(doc, data);
    drawLineItems(doc, data);
    drawTotals(doc, data);
    drawFooter(doc);

    doc.end();
  });
}

function drawHeader(doc: PDFKit.PDFDocument, data: InvoiceData) {
  doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', 50, 50, { align: 'right' });
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica').text(`Invoice #: ${data.invoiceNumber}`, { align: 'right' });
  doc.text(`Booking #: ${data.bookingNumber}`, { align: 'right' });
  doc.text(`Date: ${data.issuedAt.toLocaleDateString()}`, { align: 'right' });
  doc.text(`Due: ${data.dueDate.toLocaleDateString()}`, { align: 'right' });
  doc.text(`Status: ${data.status}`, { align: 'right' });
  doc.moveDown(1);
  doc.strokeColor('#e0e0e0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);
}

function drawCustomerInfo(doc: PDFKit.PDFDocument, data: InvoiceData) {
  doc.fontSize(12).font('Helvetica-Bold').text('Bill To:', 50, doc.y);
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica');
  doc.text(data.customer.name);
  doc.text(data.customer.email);
  if (data.customer.address) {
    const a = data.customer.address;
    doc.text(`${a.street}, ${a.city}, ${a.state} ${a.zip}, ${a.country}`);
  }
  doc.moveDown(1);
}

function drawVehicleInfo(doc: PDFKit.PDFDocument, data: InvoiceData) {
  doc.fontSize(12).font('Helvetica-Bold').text('Rental Details:', 50, doc.y);
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Vehicle: ${data.vehicle.make} ${data.vehicle.model} (${data.vehicle.licensePlate})`);
  doc.text(`Period: ${data.rentalPeriod.start.toLocaleDateString()} - ${data.rentalPeriod.end.toLocaleDateString()} (${data.rentalPeriod.days} days)`);
  doc.moveDown(1);
  doc.strokeColor('#e0e0e0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);
}

function drawLineItems(doc: PDFKit.PDFDocument, data: InvoiceData) {
  const tableTop = doc.y;
  const col1 = 50;
  const col2 = 300;
  const col3 = 400;
  const col4 = 470;

  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Description', col1, tableTop);
  doc.text('Qty', col2, tableTop);
  doc.text('Unit Price', col3, tableTop);
  doc.text('Total', col4, tableTop);

  doc.moveDown(0.5);
  doc.strokeColor('#e0e0e0').lineWidth(0.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.3);

  doc.font('Helvetica');
  let y = doc.y;

  for (const item of data.lineItems) {
    doc.text(item.description, col1, y, { width: 240 });
    doc.text(item.quantity.toString(), col2, y);
    doc.text(formatCurrency(item.unitPrice), col3, y);
    doc.text(formatCurrency(item.totalPrice), col4, y);
    y += 20;
    doc.y = y;
  }

  doc.moveDown(0.5);
  doc.strokeColor('#e0e0e0').lineWidth(0.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);
}

function drawTotals(doc: PDFKit.PDFDocument, data: InvoiceData) {
  const rightCol = 400;
  doc.fontSize(10);
  doc.font('Helvetica').text('Subtotal:', rightCol, doc.y);
  doc.font('Helvetica').text(formatCurrency(data.subtotal), 470, doc.y);
  doc.moveDown(0.3);
  doc.font('Helvetica').text('Tax:', rightCol, doc.y);
  doc.font('Helvetica').text(formatCurrency(data.taxAmount), 470, doc.y);
  doc.moveDown(0.3);
  if (data.paidAmount.gt(0)) {
    doc.font('Helvetica').text('Paid:', rightCol, doc.y);
    doc.font('Helvetica').text(formatCurrency(data.paidAmount), 470, doc.y);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').text('Balance Due:', rightCol, doc.y);
    doc.font('Helvetica-Bold').text(formatCurrency(data.totalAmount.minus(data.paidAmount)), 470, doc.y);
  } else {
    doc.font('Helvetica-Bold').text('Total:', rightCol, doc.y);
    doc.font('Helvetica-Bold').text(formatCurrency(data.totalAmount), 470, doc.y);
  }
}

function drawFooter(doc: PDFKit.PDFDocument) {
  doc.moveDown(2);
  doc.fontSize(8).font('Helvetica').fillColor('#888');
  doc.text('Thank you for your business!', 50, doc.y, { align: 'center', width: 495 });
  doc.text('ThreadSight Inspection Report', { align: 'center', width: 495 });
}

function formatCurrency(amount: Decimal): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount.toNumber());
}