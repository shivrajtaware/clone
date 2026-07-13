const QRCode = require('qrcode');

const BARCODE_PREFIX = 'MCPT:';
const LEGACY_BARCODE_PREFIX = 'MEDICORE:PATIENT:';

function buildPatientBarcodeData(patient) {
  return `${BARCODE_PREFIX}${patient.id}`;
}

function parsePatientBarcode(barcodeData) {
  const value = String(barcodeData || '').trim();
  if (!value) throw new Error('Invalid barcode data format');

  if (value.startsWith(BARCODE_PREFIX)) {
    return { patientId: value.slice(BARCODE_PREFIX.length), timestamp: new Date().toISOString() };
  }

  if (value.startsWith(LEGACY_BARCODE_PREFIX)) {
    return { patientId: value.slice(LEGACY_BARCODE_PREFIX.length), timestamp: new Date().toISOString() };
  }

  const parts = value.split('|');
  if (parts[0]) return { uhid: parts[0], name: parts[1], timestamp: new Date().toISOString() };

  throw new Error('Invalid barcode data format');
}

/**
 * Generate a barcode containing patient EMR data
 * The barcode will encode the patient's UHID and key EMR information
 */
async function generatePatientBarcode(patient) {
  try {
    const barcodeData = buildPatientBarcodeData(patient);
    
    let barcodeImage;

    try {
      const JsBarcode = require('jsbarcode');
      const { createCanvas } = require('canvas');
      const canvas = createCanvas(760, 150);

      JsBarcode(canvas, barcodeData, {
        format: 'CODE128',
        width: 1.6,
        height: 80,
        displayValue: true,
        fontSize: 14,
        margin: 16,
      });

      barcodeImage = canvas.toDataURL('image/png');
    } catch (barcodeError) {
      barcodeImage = await QRCode.toDataURL(barcodeData, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 240,
      });
    }
    
    return {
      barcodeData,
      barcodeImage,
    };
  } catch (error) {
    console.error('Barcode generation error:', error);
    throw new Error('Failed to generate barcode: ' + error.message);
  }
}

module.exports = {
  buildPatientBarcodeData,
  generatePatientBarcode,
  parsePatientBarcode,
};
