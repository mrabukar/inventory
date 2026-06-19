import path from "node:path";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

// pdfmake ships as a CommonJS singleton with server-side buffer output.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfMake = require("pdfmake") as {
  setFonts: (fonts: Record<string, Record<string, string>>) => void;
  createPdf: (doc: TDocumentDefinitions) => { getBuffer: () => Promise<Buffer> };
};

let fontsConfigured = false;

function ensurePdfFonts(): void {
  if (fontsConfigured) {
    return;
  }

  const fontDir = path.join(
    path.dirname(require.resolve("pdfmake/package.json")),
    "fonts",
    "Roboto",
  );

  pdfMake.setFonts({
    Roboto: {
      normal: path.join(fontDir, "Roboto-Regular.ttf"),
      bold: path.join(fontDir, "Roboto-Medium.ttf"),
      italics: path.join(fontDir, "Roboto-Italic.ttf"),
      bolditalics: path.join(fontDir, "Roboto-MediumItalic.ttf"),
    },
  });

  fontsConfigured = true;
}

export async function renderPdf(
  docDefinition: TDocumentDefinitions,
): Promise<Buffer> {
  ensurePdfFonts();
  const document = pdfMake.createPdf(docDefinition);
  return document.getBuffer();
}
