import { google } from "googleapis";

class SheetsClient {
  constructor(apiKeyBase64, sheetId) {
    this.sheetId = sheetId;
    
    // Decode the base64 API key
    const apiKeyJson = Buffer.from(apiKeyBase64, "base64").toString("utf-8");
    const credentials = JSON.parse(apiKeyJson);

    this.auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    this.sheets = google.sheets({ version: "v4", auth: this.auth });
  }

  async getNextPlannedArticle() {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: "pautas-modelo_calendario!A:J",
      });

      const values = response.data.values || [];
      if (values.length < 2) return null;

      // Find first row with Status = "planejado"
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (row[8] === "planejado") {
          // Column I (index 8) = Status
          return {
            calId: row[0], // A: CAL_ID
            data: row[1], // B: Data
            artId: row[2], // C: ART_ID
            titulo: row[3], // D: Título
            categoria: row[4], // E: Categoria
            vol: row[5], // F: Volume
            dif: row[6], // G: Dificuldade
            slug: row[7], // H: slug
            status: row[8], // I: Status
          };
        }
      }

      return null;
    } catch (error) {
      console.error("Error fetching planned article:", error);
      throw error;
    }
  }

  async getKeywordsForArticle(artId) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: "pautas-modelo_keywords!A:D",
      });

      const values = response.data.values || [];
      const keywords = [];

      // Find all rows matching artId
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (row[0] === artId) {
          keywords.push({
            keyword: row[1], // B: Keyword
            volume: row[2], // C: Volume
            dif: row[3], // D: Dificuldade
          });
        }
      }

      return keywords;
    } catch (error) {
      console.error("Error fetching keywords:", error);
      return [];
    }
  }

  async markAsPublished(calId) {
    try {
      // Find the row index for this calId
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: "pautas-modelo_calendario!A:I",
      });

      const values = response.data.values || [];
      let rowIndex = -1;

      for (let i = 1; i < values.length; i++) {
        if (values[i][0] === calId) {
          rowIndex = i + 1; // Convert to 1-based index for API
          break;
        }
      }

      if (rowIndex === -1) {
        console.warn(`Could not find article with calId: ${calId}`);
        return;
      }

      // Update the Status column (I) to "publicado"
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetId,
        range: `pautas-modelo_calendario!I${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [["publicado"]],
        },
      });

      console.log(`Marked article ${calId} as published`);
    } catch (error) {
      console.error("Error marking article as published:", error);
      throw error;
    }
  }
}

export default SheetsClient;
