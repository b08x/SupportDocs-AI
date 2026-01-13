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
  ImageRun,
  PageBreak
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
  const map: Record<string, string> = {
    'blue': '3B82F6',
    'red': 'EF4444',
    'green': '10B981',
    'gray': '71717A'
  };
  return map[color.toLowerCase()];
};

/**
 * Helper to convert base64 string to Uint8Array
 */
const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = window.atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const exportToDocx = async (htmlContent: string, title: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const body = doc.body;
  const children: any[] = [];

  /**
   * Recursive parser that flattens nested block structures into docx-compatible nodes.
   * forceInline: Ensures nested blocks (like <p> inside <li>) are flattened into TextRuns.
   */
  const parseNode = (node: Node, options: any = {}, forceInline: boolean = false): any[] => {
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
          size: options.size || 22,
          shading: options.shading,
        })];
      }
      return [];
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tag = element.tagName.toLowerCase();
      const classList = element.classList;
      const style = element.style;

      // ServiceNow-Compliant Image Export
      if (tag === 'img') {
        const src = element.getAttribute('src');
        if (src && src.startsWith('data:image')) {
          try {
            const base64Data = src.split(',')[1];
            const imageBuffer = base64ToUint8Array(base64Data);
            return [new ImageRun({
              data: imageBuffer,
              transformation: { width: 550, height: 350 },
            })];
          } catch (e) {
            console.error("Image processing error:", e);
            return [new TextRun({ text: "[Image Error]", color: "EF4444" })];
          }
        }
        return [];
      }

      const newOptions = { ...options };
      if (tag === 'strong' || tag === 'b') newOptions.bold = true;
      if (tag === 'em' || tag === 'i') newOptions.italics = true;
      if (style.color) newOptions.color = getHexColor(style.color);

      // Story 4 Fix: Handle <code> tags properly
      if (tag === 'code') {
        newOptions.font = "Courier New";
        // Only apply distinctive inline code styles if not nested in pre
        if (!options.isInsidePre) {
           newOptions.color = "DB2777";
           newOptions.shading = { fill: "F3F4F6", type: ShadingType.CLEAR, color: "auto" };
        }
      }

      // Handle Tables
      if (tag === 'table' && !forceInline) {
        const rows: TableRow[] = [];
        element.querySelectorAll('tr').forEach(tr => {
          const cells: TableCell[] = [];
          tr.querySelectorAll('td, th').forEach(td => {
            const cellChildren: any[] = [];
            td.childNodes.forEach(child => {
              const nodes = parseNode(child, newOptions);
              nodes.forEach(n => {
                if (n instanceof Paragraph || n instanceof Table) cellChildren.push(n);
                else cellChildren.push(new Paragraph({ children: [n] }));
              });
            });
            cells.push(new TableCell({
              children: cellChildren.length > 0 ? cellChildren : [new Paragraph("")],
              shading: td.tagName.toLowerCase() === 'th' ? { fill: "F9FAFB" } : undefined,
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
          if (cells.length > 0) rows.push(new TableRow({ children: cells }));
        });
        return rows.length > 0 ? [new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })] : [];
      }

      // Block-level logic (p, h, li, div, pre, hr)
      if (['p', 'h1', 'h2', 'h3', 'h4', 'li', 'div', 'pre', 'hr'].includes(tag)) {
        // Story 4, AC1 & AC2: Handle Page Break element functionally in DOCX
        if (tag === 'hr' || classList.contains('page-break')) {
            return [new Paragraph({
                children: [new PageBreak()],
                spacing: { before: 0, after: 0 }, // AC3: Clean transition
            })];
        }

        if (forceInline) {
          const innerResults: any[] = [];
          element.childNodes.forEach(child => {
            innerResults.push(...parseNode(child, newOptions, true));
          });
          return innerResults;
        }

        let heading: any = undefined;
        let shading: any = undefined;
        let borders: any = undefined;
        let textColor = newOptions.color;

        // Apply H1 specific styles
        if (tag === 'h1') { 
          heading = HeadingLevel.HEADING_1; 
          borders = { bottom: { style: BorderStyle.SINGLE, size: 12, color: "E5E7EB" } }; 
          textColor = "1D4ED8"; // Blue
          newOptions.bold = true;
          newOptions.size = 36; // 18pt
        }
        
        // Apply H2 specific styles
        if (tag === 'h2') {
          heading = HeadingLevel.HEADING_2;
          textColor = "111827"; // Dark grey
          newOptions.bold = true;
          newOptions.size = 30; // 15pt
        }
        
        // Semantic Styling Mapping from constants.ts
        if (classList.contains('warning')) {
          shading = { fill: "FEF2F2", type: ShadingType.CLEAR, color: "auto" };
          borders = { left: { style: BorderStyle.SINGLE, size: 32, color: "EF4444", space: 10 } };
          textColor = "991B1B";
        } else if (classList.contains('metadata')) {
          shading = { fill: "EFF6FF", type: ShadingType.CLEAR, color: "auto" };
          borders = { left: { style: BorderStyle.SINGLE, size: 32, color: "3B82F6", space: 10 } };
          textColor = "1E40AF";
        } else if (classList.contains('lesson-learned')) {
          shading = { fill: "FFFBEB", type: ShadingType.CLEAR, color: "auto" };
          borders = { left: { style: BorderStyle.SINGLE, size: 40, color: "F59E0B", space: 10 } };
          textColor = "B45309";
        } else if (tag === 'pre') {
          // KB_STYLES match: Dark background, light text
          shading = { fill: "111827", type: ShadingType.CLEAR, color: "auto" };
          newOptions.font = "Courier New";
          newOptions.isInsidePre = true; // Flag for nested code tag logic
          textColor = "E5E7EB";
        }

        let numbering: any = undefined;
        if (tag === 'li') {
          const parentTag = element.parentElement?.tagName.toLowerCase();
          numbering = { reference: parentTag === 'ol' ? "main-numbering" : "main-bullets", level: 0 };
        }

        const runs: any[] = [];
        element.childNodes.forEach(child => {
          runs.push(...parseNode(child, { ...newOptions, color: textColor }, tag === 'li'));
        });

        // Skip non-styled wrapper divs
        if (tag === 'div' && !shading && !borders && classList.length === 0) return runs;

        return [new Paragraph({
          children: runs.length > 0 ? runs : [new TextRun("")],
          heading,
          numbering,
          shading,
          border: borders,
          spacing: { before: tag === 'h1' ? 400 : 180, after: 180 },
        })];
      }

      // Default inline handling
      element.childNodes.forEach(child => {
        results.push(...parseNode(child, newOptions, forceInline));
      });
      return results;
    }
    return results;
  };

  // Convert root nodes
  body.childNodes.forEach(node => {
    const nodes = parseNode(node);
    nodes.forEach(n => {
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
        { reference: "main-numbering", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START }] },
        { reference: "main-bullets", levels: [{ level: 0, format: "bullet", text: "\u2022", alignment: AlignmentType.START }] },
      ],
    },
    sections: [{
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: children,
    }],
  });

  const blob = await Packer.toBlob(docx);
  saveAs(blob, `${title.replace(/\s+/g, '_')}.docx`);
};