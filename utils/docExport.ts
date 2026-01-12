
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType, 
  ShadingType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  TableWidthUnit,
  ImageRun
} from 'docx';
import saveAs from 'file-saver';

/**
 * Utility to convert hex colors or basic color names to hex for docx
 */
const getHexColor = (color: string | null): string | undefined => {
  if (!color) return undefined;
  if (color.startsWith('#')) return color.replace('#', '');
  if (color.startsWith('rgb')) {
    const parts = color.match(/\d+/g);
    if (parts && parts.length >= 3) {
      return parts.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('').toUpperCase();
    }
  }
  // Simple mapping for common app colors
  const map: Record<string, string> = {
    'blue': '3B82F6',
    'red': 'EF4444',
    'green': '10B981',
    'gray': '71717A'
  };
  return map[color.toLowerCase()];
};

/**
 * Helper to convert base64 string to Uint8Array for the docx library
 */
const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const exportToDocx = async (htmlContent: string, title: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const body = doc.body;

  const children: any[] = [];

  // Helper to parse nodes recursively
  const parseNode = (node: Node, options: any = {}): any[] => {
    const results: any[] = [];

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim() || text === ' ') {
        return [new TextRun({
          text: text,
          bold: options.bold,
          italics: options.italics,
          color: options.color,
          font: options.font || "Arial",
          size: options.size || 22, // ~11pt
          shading: options.shading,
        })];
      }
      return [];
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tag = element.tagName.toLowerCase();
      const style = element.style;

      // Handle Images
      if (tag === 'img') {
        const src = element.getAttribute('src');
        if (src && src.startsWith('data:image')) {
          try {
            const base64Data = src.split(',')[1];
            const imageBuffer = base64ToUint8Array(base64Data);
            return [new ImageRun({
              data: imageBuffer,
              transformation: {
                width: 600,
                height: 337, // Default 16:9 ratio
              },
            })];
          } catch (e) {
            console.error("Failed to process image for docx export", e);
            return [new TextRun({ text: "[Image]", color: "71717A" })];
          }
        }
        return [];
      }

      const newOptions = { ...options };
      if (tag === 'strong' || tag === 'b') newOptions.bold = true;
      if (tag === 'em' || tag === 'i') newOptions.italics = true;
      if (style.color) newOptions.color = getHexColor(style.color);
      if (style.fontWeight === 'bold' || style.fontWeight === '700') newOptions.bold = true;

      // Special handling for code
      if (tag === 'code' || tag === 'pre') {
        newOptions.font = "Courier New";
        newOptions.shading = {
          type: ShadingType.CLEAR,
          color: "auto",
          fill: "F3F4F6",
        };
      }

      // Handle Tables
      if (tag === 'table') {
        const rows: TableRow[] = [];
        const trs = element.querySelectorAll('tr');
        
        trs.forEach(tr => {
          const cells: TableCell[] = [];
          tr.querySelectorAll('td, th').forEach(td => {
            const cellElement = td as HTMLElement;
            const cellChildren: any[] = [];
            cellElement.childNodes.forEach(child => {
              cellChildren.push(...parseNode(child, newOptions));
            });

            cells.push(new TableCell({
              children: cellChildren.length > 0 ? cellChildren : [new Paragraph("")],
              shading: cellElement.tagName.toLowerCase() === 'th' ? { fill: "F9FAFB", type: ShadingType.CLEAR, color: "auto" } : undefined,
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
              },
              verticalAlign: AlignmentType.CENTER,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            }));
          });
          if (cells.length > 0) {
            rows.push(new TableRow({ children: cells }));
          }
        });

        if (rows.length > 0) {
          return [new Table({
            rows: rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
            margins: { top: 200, bottom: 200 },
          })];
        }
      }

      // Block-level elements
      if (['p', 'h1', 'h2', 'h3', 'h4', 'li', 'div'].includes(tag)) {
        if (tag === 'div' && !style.border && !style.backgroundColor && !style.padding && !style.borderLeft) {
            element.childNodes.forEach(child => {
                results.push(...parseNode(child, newOptions));
            });
            return results;
        }

        let heading: any = undefined;
        let color = newOptions.color;
        
        if (tag === 'h1') { heading = HeadingLevel.HEADING_1; color = color || '1D4ED8'; } 
        if (tag === 'h2') { heading = HeadingLevel.HEADING_2; color = color || '111827'; }
        if (tag === 'h3') { heading = HeadingLevel.HEADING_3; color = color || '374151'; }

        let numbering: any = undefined;
        if (tag === 'li') {
          const parent = element.parentElement?.tagName.toLowerCase();
          numbering = {
            reference: parent === 'ol' ? "main-numbering" : "main-bullets",
            level: 0,
          };
        }

        const runs: any[] = [];
        element.childNodes.forEach(child => {
          runs.push(...parseNode(child, { ...newOptions, color }));
        });

        const hasLeftBorder = style.borderLeft || style.borderLeftWidth;
        const leftBorderColor = getHexColor(style.borderLeftColor) || '3B82F6';

        return [new Paragraph({
          children: runs,
          heading: heading,
          numbering: numbering,
          alignment: style.textAlign === 'center' ? AlignmentType.CENTER : undefined,
          spacing: { before: 180, after: 180 },
          shading: style.backgroundColor ? { fill: getHexColor(style.backgroundColor)!, type: ShadingType.CLEAR, color: "auto" } : undefined,
          border: hasLeftBorder ? {
            left: { style: BorderStyle.SINGLE, size: 24, color: leftBorderColor, space: 10 },
          } : undefined,
        })];
      }

      element.childNodes.forEach(child => {
        results.push(...parseNode(child, newOptions));
      });
    }

    return results;
  };

  body.childNodes.forEach(node => {
    children.push(...parseNode(node));
  });

  const docx = new Document({
    numbering: {
      config: [
        {
          reference: "main-numbering",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.START,
            },
          ],
        },
        {
          reference: "main-bullets",
          levels: [
            {
              level: 0,
              format: "bullet",
              text: "\u2022",
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [{
      properties: {
        page: {
            margin: {
                top: 1440,
                right: 1440,
                bottom: 1440,
                left: 1440,
            }
        }
      },
      children: children,
    }],
  });

  const blob = await Packer.toBlob(docx);
  saveAs(blob, `${title.replace(/\s+/g, '_')}.docx`);
};
