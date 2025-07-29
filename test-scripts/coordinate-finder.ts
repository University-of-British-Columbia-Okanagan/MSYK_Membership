import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";

async function createCoordinateGrid() {
  try {
    const templatePath = path.join(
      process.cwd(),
      "public",
      "documents",
      "msyk-waiver-template.pdf"
    );
    const existingPdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const secondPage = pages[1];
    const { width, height } = secondPage.getSize();

    console.log(`PDF dimensions: ${width} x ${height}`);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Draw a fine grid every 10 points with coordinates
    for (let x = 0; x <= width; x += 25) {
      for (let y = 0; y <= height; y += 25) {
        // Draw small coordinate labels
        secondPage.drawText(`${x},${y}`, {
          x: x + 2,
          y: y + 2,
          size: 6,
          font: font,
          color: rgb(1, 0, 0), // Red
        });

        // Draw small dots for reference
        secondPage.drawRectangle({
          x: x,
          y: y,
          width: 1,
          height: 1,
          color: rgb(0, 0, 1), // Blue dots
        });
      }
    }

    // Draw major grid lines every 50 points
    for (let x = 0; x <= width; x += 50) {
      secondPage.drawLine({
        start: { x: x, y: 0 },
        end: { x: x, y: height },
        thickness: 0.5,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    for (let y = 0; y <= height; y += 50) {
      secondPage.drawLine({
        start: { x: 0, y: y },
        end: { x: width, y: y },
        thickness: 0.5,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    const pdfBytes = await pdfDoc.save();
    const outputPath = path.join(process.cwd(), "coordinate-grid.pdf");
    fs.writeFileSync(outputPath, pdfBytes);

    console.log(`Coordinate grid PDF created: ${outputPath}`);
    console.log("Open this PDF to find exact coordinates for signature lines");
  } catch (error) {
    console.error("Error creating coordinate grid:", error);
  }
}

createCoordinateGrid();
