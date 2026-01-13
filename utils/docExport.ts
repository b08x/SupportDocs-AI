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
  const binaryString = window.atob(base64.replace(/\s/g, ''));
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
      const classList = element.classList;

      // Handle Images (US-2: ServiceNow-Compliant DOCX Export)
      // CRITICAL FIX: Return ImageRun (inline) instead of Paragraph (block) 
      // so it can be nested inside parent Paragraphs correctly.
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
                    height: 400, // Fixed height or calculated aspect ratio
                },
            })];
          } catch (e) {
            console.error("Failed to process image for docx export", e);
            return [new TextRun({ text: "[Image Conversion Error]", color: "EF4444" })];
          }
        }
        return [];
      }

      const newOptions = { ...options };
      if (tag === 'strong' || tag === 'b') newOptions.bold = true;
      if (tag === 'em' || tag === 'i') newOptions.italics = true;
      if (style.color) newOptions.color = getHexColor(style.color);
      if (style.fontWeight === 'bold' || style.fontWeight === '700') newOptions.bold = true;

      // Special handling for code (Parity with KB_STYLES)
      if (tag === 'code' || tag === 'pre') {
        newOptions.font = "Courier New";
        if (tag === 'pre') {
          newOptions.color = "E5E7EB"; // Light grey text for dark blocks
        } else {
          newOptions.color = "DB2777"; // Pinkish color for inline code
          newOptions.shading = {
            type: ShadingType.CLEAR,
            color: "auto",
            fill: "F3F4F6",
          };
        }
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
              // Note: parseNode might return Paragraphs if we have nested blocks in cells
              // docx library supports Paragraphs inside TableCells
              const results = parseNode(child, newOptions);
              results.forEach(res => {
                if (res instanceof TextRun || res instanceof ImageRun) {
                    cellChildren.push(new Paragraph({ children: [res] }));
                } else {
                    cellChildren.push(res);
                }
              });
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
      if (['p', 'h1', 'h2', 'h3', 'h4', 'li', 'div', 'pre'].includes(tag)) {
        // Skip wrapper divs that don't have our core style classes
        if (tag === 'div' && 
            !classList.contains('warning') && 
            !classList.contains('metadata') && 
            !classList.contains('lesson-learned') && 
            !style.border && !style.backgroundColor && !style.padding && !style.borderLeft) {
            element.childNodes.forEach(child => {
                results.push(...parseNode(child, newOptions));
            });
            return results;
        }

        let heading: any = undefined;
        let color = newOptions.color;
        let borders: any = undefined;
        let shading: any = style.backgroundColor ? { fill: getHexColor(style.backgroundColor)!, type: ShadingType.CLEAR, color: "auto" } : undefined;
        
        // CSS Class Parity Logic
        if (classList.contains('warning')) {
          shading = { fill: "FEF2F2", type: ShadingType.CLEAR, color: "auto" };
          borders = { left: { style: BorderStyle.SINGLE, size: 32, color: "EF4444", space: 10 } };
        } else if (classList.contains('metadata')) {
          shading = { fill: "EFF6FF", type: ShadingType.CLEAR, color: "auto" };
          borders = { left: { style: BorderStyle.SINGLE, size: 32, color: "3B82F6", space: 10 } };
        } else if (classList.contains('lesson-learned')) {
          shading = { fill: "FFFBEB", type: ShadingType.CLEAR, color: "auto" };
          borders = { left: { style: BorderStyle.SINGLE, size: 40, color: "F59E0B", space: 10 } };
        }

        if (tag === 'pre') {
          shading = { fill: "111827", type: ShadingType.CLEAR, color: "auto" };
        }

        if (tag === 'h1') { 
          heading = HeadingLevel.HEADING_1; 
          color = color || '1D4ED8'; 
          borders = { ...borders, bottom: { style: BorderStyle.SINGLE, size: 12, color: "E5E7EB", space: 10 } };
        } 
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
          const childNodes = parseNode(child, { ...newOptions, color });
          // If a child accidentally returns a Paragraph, we extract its runs (simple flattening)
          childNodes.forEach(cn => {
            if (cn instanceof Paragraph) {
                // Not ideal, but try to avoid nesting paragraphs inside paragraphs
                // which docx library does not support directly in the children array
                console.warn("Nesting Paragraph inside Paragraph is not supported in docx library. Check HTML structure.");
            } else {
                runs.push(cn);
            }
          });
        });

        // Fallback for custom border inline styles if present
        if (!borders && (style.borderLeft || style.borderLeftWidth)) {
          const leftBorderColor = getHexColor(style.borderLeftColor) || '3B82F6';
          borders = {
            left: { style: BorderStyle.SINGLE, size: 24, color: leftBorderColor, space: 10 },
          };
        }

        return [new Paragraph({
          children: runs.length > 0 ? runs : [new TextRun("")],
          heading: heading,
          numbering: numbering,
          alignment: style.textAlign === 'center' ? AlignmentType.CENTER : undefined,
          spacing: { before: 180, after: 180 },
          shading: shading,
          border: borders,
        })];
      }

      element.childNodes.forEach(child => {
        results.push(...parseNode(child, newOptions));
      });
    }

    return results;
  };

  body.childNodes.forEach(node => {
    const nodes = parseNode(node);
    nodes.forEach(n => {
        // Section children MUST be Paragraph or Table. 
        // Wrap inline nodes like TextRun or ImageRun in a Paragraph.
        if (n instanceof TextRun || n instanceof ImageRun) {
            children.push(new Paragraph({ children: [n], spacing: { before: 120, after: 120 } }));
        } else {
            children.push(n);
        }
    });
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
