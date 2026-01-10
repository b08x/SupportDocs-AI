import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType, 
  ShadingType
} from 'docx';
import saveAs from 'file-saver';

export const exportToDocx = async (htmlContent: string, title: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const body = doc.body;

  const children: any[] = [];

  // Title at the top
  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  const parseNode = (node: Node, options: any = {}): any[] => {
    const results: any[] = [];

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim() || text === ' ') {
        return [new TextRun({
          text: text,
          bold: options.bold,
          italics: options.italics,
          font: options.font || "Calibri",
          size: options.size || 24, // 12pt
          shading: options.shading,
        })];
      }
      return [];
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tag = element.tagName.toLowerCase();

      // Inline styles
      const newOptions = { ...options };
      if (tag === 'strong' || tag === 'b') newOptions.bold = true;
      if (tag === 'em' || tag === 'i') newOptions.italics = true;
      if (tag === 'code') {
        newOptions.font = "Courier New";
        newOptions.shading = {
          type: ShadingType.CLEAR,
          color: "auto",
          fill: "F3F4F6",
        };
      }

      // Block-level elements
      if (['p', 'h1', 'h2', 'h3', 'h4', 'li', 'pre'].includes(tag)) {
        let heading: any = undefined;
        if (tag === 'h1') heading = HeadingLevel.HEADING_1;
        if (tag === 'h2') heading = HeadingLevel.HEADING_2;
        if (tag === 'h3') heading = HeadingLevel.HEADING_3;

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
          runs.push(...parseNode(child, newOptions));
        });

        return [new Paragraph({
          children: runs,
          heading: heading,
          numbering: numbering,
          spacing: { before: 120, after: 120 },
        })];
      }

      // Containers (div, section, ul, ol)
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
      properties: {},
      children: children,
    }],
  });

  const blob = await Packer.toBlob(docx);
  // Using default export as the library is packed as a single function in most ESM CDNs
  if (typeof saveAs === 'function') {
    saveAs(blob, `${title.replace(/\s+/g, '_')}.docx`);
  } else if ((saveAs as any).saveAs) {
    (saveAs as any).saveAs(blob, `${title.replace(/\s+/g, '_')}.docx`);
  }
};