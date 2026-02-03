const pdfParse = require("pdf-parse");

async function parseResumeText(buffer) {
    let data;

    if (typeof pdfParse === "function") {
        data = await pdfParse(buffer);
    } else if (pdfParse?.PDFParse) {
        const parser = new pdfParse.PDFParse({ data: buffer });
        data = await parser.getText();
    } else if (pdfParse?.default && typeof pdfParse.default === "function") {
        data = await pdfParse.default(buffer);
    } else {
        throw new Error("Unsupported pdf-parse export shape");
    }

    return data.text
        .replace(/\s+/g, " ")
        .trim();
}

module.exports = { parseResumeText };