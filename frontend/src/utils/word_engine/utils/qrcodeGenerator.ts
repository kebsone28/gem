import QRCode from 'qrcode';

/**
 * Encode une URL en QR Code et retourne un ArrayBuffer PNG
 * en utilisant l'API canvas native du navigateur.
 */
export const generateQRCodeBuffer = async (text: string): Promise<ArrayBuffer | null> => {
  if (!text) return null;

  try {

    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;

    await QRCode.toCanvas(canvas, text, {
      margin: 1,
      width: 200,
      color: { dark: '#1e1b4b', light: '#ffffff' },
    });

    return await new Promise<ArrayBuffer | null>((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        blob
          .arrayBuffer()
          .then(resolve)
          .catch(() => resolve(null));
      }, 'image/png');
    });
  } catch (err) {
    console.warn('QR Code non disponible, document généré sans QR Code.', err);
    return null;
  }
};
