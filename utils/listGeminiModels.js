const https = require("https");
require("dotenv").config();

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https
            .get(url, (res) => {
                let data = "";

                res.on("data", (chunk) => {
                    data += chunk;
                });

                res.on("end", () => {
                    if (res.statusCode && res.statusCode >= 400) {
                        return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }

                    try {
                        resolve(JSON.parse(data));
                    } catch (err) {
                        err.message = `Failed to parse response JSON: ${err.message}`;
                        reject(err);
                    }
                });
            })
            .on("error", reject);
    });
}

async function fetchModels(apiBase, apiVersion, apiKey) {
    const baseUrl = `${apiBase}/${apiVersion}/models?key=${encodeURIComponent(apiKey)}`;
    const fieldMask = "models(name,displayName,version,supportedGenerationMethods,rateLimits)";

    try {
        return await fetchJson(`${baseUrl}&fieldMask=${encodeURIComponent(fieldMask)}`);
    } catch (_) {
        return await fetchJson(baseUrl);
    }
}

function getRateLimit(rateLimits, name) {
    if (!Array.isArray(rateLimits)) {
        return "n/a";
    }

    const entry = rateLimits.find((limit) => limit.name === name);

    if (!entry || entry.limit === undefined || entry.limit === null) {
        return "n/a";
    }

    return entry.limit;
}

function formatTable(rows) {
    const headers = ["model", "rpm", "rpd", "tpd"];
    const colWidths = headers.map((header, index) =>
        Math.max(
            header.length,
            ...rows.map((row) => String(row[index]).length)
        )
    );

    const formatRow = (row) =>
        row
            .map((cell, index) => String(cell).padEnd(colWidths[index], " "))
            .join("  ");

    const lines = [];
    lines.push(formatRow(headers));
    lines.push(colWidths.map((width) => "-".repeat(width)).join("  "));
    rows.forEach((row) => lines.push(formatRow(row)));

    return lines.join("\n");
}

async function listAvailableGeminiModels() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set");
    }

    const apiBase = process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com";
    const versions = [process.env.GEMINI_API_VERSION, "v1beta", "v1"].filter(Boolean);
    const triedVersions = new Set();
    let result;
    let lastError;

    for (const version of versions) {
        if (triedVersions.has(version)) {
            continue;
        }

        triedVersions.add(version);

        try {
            result = await fetchModels(apiBase, version, apiKey);
            if (result) {
                break;
            }
        } catch (err) {
            lastError = err;
        }
    }

    if (!result) {
        throw lastError || new Error("Failed to fetch models");
    }

    const models = Array.isArray(result) ? result : (result.models || []);

    const filteredModels = models.filter((model) =>
        Array.isArray(model.supportedGenerationMethods)
            ? model.supportedGenerationMethods.includes("generateContent")
            : false
    );

    return filteredModels.map((model) => ({
        name: model.name,
        displayName: model.displayName,
        version: model.version,
        supportedGenerationMethods: model.supportedGenerationMethods,
        rpm: getRateLimit(model.rateLimits, "requests-per-minute"),
        rpd: getRateLimit(model.rateLimits, "requests-per-day"),
        tpd: getRateLimit(model.rateLimits, "tokens-per-day"),
    }));
}

if (require.main === module) {
    listAvailableGeminiModels()
        .then((models) => {
            if (!models.length) {
                console.log("No models found with generateContent support.");
                return;
            }

            const rows = models.map((model) => [
                model.name,
                model.rpm,
                model.rpd,
                model.tpd,
            ]);

            console.log(formatTable(rows));
        })
        .catch((err) => {
            console.error("Failed to list models:", err);
            process.exitCode = 1;
        });
}

module.exports = { listAvailableGeminiModels };
