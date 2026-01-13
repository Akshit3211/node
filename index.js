const https = require("https");
const fs = require("fs");

const API_KEY = "Your api";

const MODELS = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro"
];

const MAX_RETRIES = 5;
const TIMEOUT_MS = 15000;

const prompt = process.argv.slice(2).join(" ");
if (!prompt) {
  console.log('Usage: node index.js "Your prompt"');
  process.exit(1);
}

function removeComments(code) {
  return code
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();
}

function callGemini(modelIndex = 0, attempt = 1) {
  const MODEL = MODELS[modelIndex];

  const data = JSON.stringify({
    contents: [
      {
        parts: [
          {
            text: `
You are a code generator.
Output ONLY the final code.
${prompt}
`
          }
        ]
      }
    ]
  });

  const options = {
    hostname: "generativelanguage.googleapis.com",
    path: `/v1/models/${MODEL}:generateContent?key=${API_KEY}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data)
    },
    timeout: TIMEOUT_MS
  };

  const req = https.request(options, (res) => {
    let body = "";

    res.on("data", (chunk) => (body += chunk));
    res.on("end", () => {
      try {
        const json = JSON.parse(body);

        if (json.error) {
          if (
            json.error.code === 503 &&
            attempt < MAX_RETRIES
          ) {
            const delay = Math.pow(2, attempt) * 1000;
            setTimeout(() => callGemini(modelIndex, attempt + 1), delay);
            return;
          }

          if (modelIndex + 1 < MODELS.length) {
            callGemini(modelIndex + 1);
            return;
          }

          console.error("API Error:", json.error);
          return;
        }

        const output = json.candidates[0].content.parts[0].text;
        const cleaned = removeComments(output);

        const fileName = `output_${Date.now()}.txt`;
        fs.writeFileSync(fileName, cleaned, "utf8");
        console.log("Saved:", fileName);
      } catch (e) {
        console.error("Parse error:", e);
      }
    });
  });

  req.on("timeout", () => {
    req.destroy();
    if (attempt < MAX_RETRIES) {
      callGemini(modelIndex, attempt + 1);
    }
  });

  req.on("error", () => {
    if (attempt < MAX_RETRIES) {
      callGemini(modelIndex, attempt + 1);
    }
  });

  req.write(data);
  req.end();
}

callGemini();
