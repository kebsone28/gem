// Gallery component for Word documents
import { Table, TableRow, TableCell, Paragraph, AlignmentType, ImageRun, TextRun } from 'docx';
import { WidthType } from 'docx';
import { BORDERS } from '../theme/borders';
import { MARGINS, SPACING } from '../theme/spacing';
import { COLORS } from '../theme/colors';
import { FONT_SIZES } from '../theme/typography';
import { fetchImageCached } from '../utils/imageLoader';

export interface GalleryImage {
  url: string;
  label: string;
  notes?: string[];
}

export interface GalleryOptions {
  images: GalleryImage[];
  columns?: number; // Number of columns (default: 2)
  width?: number; // Percentage width (default: 100)
  backgroundColor?: string;
  borderColor?: string;
}

/**
 * Creates a gallery of images with labels
 * Returns a Table element that renders as an image gallery in Word
 */
export const createGallery = async (options: GalleryOptions) => {
  const {
    images,
    columns = 2,
    width = 100,
    backgroundColor = COLORS.BG_CARD,
    borderColor = '#E0F2FE',
  } = options;

  const imageBuffers = await Promise.all(images.map((img) => fetchImageCached(img.url)));
  const rows: TableRow[] = [];

  for (let i = 0; i < images.length; i += columns) {
    const cells: TableCell[] = [];
    
    for (let j = 0; j < columns; j++) {
      const idx = i + j;
      const img = images[idx];
      const buf = imageBuffers[idx];
      
      if (img) {
        const cellChildren: any[] = [];
        
        if (buf) {
          cellChildren.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: SPACING.MEDIUM, after: SPACING.MEDIUM },
              children: [
                new ImageRun({
                  data: buf,
                  transformation: { width: 200, height: 150 },
                  type: 'png',
                } as any),
              ],
            })
          );
        }
        
        cellChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: SPACING.SMALL, after: SPACING.MEDIUM },
            children: [
              new TextRun({
                text: img.label.toUpperCase(),
                bold: true,
                size: FONT_SIZES.CARD_BODY,
                color: COLORS.SUCCESS,
              }),
            ],
          })
        );
        
        if (img.notes && img.notes.length > 0) {
          img.notes.forEach((note) => {
            cellChildren.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: SPACING.XS, after: SPACING.XS },
                children: [
                  new TextRun({
                    text: note,
                    size: FONT_SIZES.SMALL,
                    color: COLORS.GRAY,
                  }),
                ],
              })
            );
          });
        }
        
        cells.push(
          new TableCell({
            shading: { fill: backgroundColor },
            borders: BORDERS.CARD,
            children: cellChildren,
            margins: MARGINS.CARD,
          })
        );
      } else {
        cells.push(
          new TableCell({
            borders: BORDERS.NONE,
            children: [],
          })
        );
      }
    }
    
    rows.push(new TableRow({ children: cells }));
  }

  return new Table({
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: BORDERS.NONE,
    rows,
  });
};
