const https = require("https");
const fs = require("fs");

const API_KEY = "Your Api";
const MODEL = "gemini-2.5-flash";

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

const data = JSON.stringify({
  contents: [
    {
      parts: [
        {
          text: `
You are a code generator.

Rules:
- Output ONLY the final code
- Do NOT add explanations
- Do NOT add comments
- Do NOT use markdown
- Do NOT use code fences

Task:
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
  }
};

const req = https.request(options, (res) => {
  let body = "";

  res.on("data", (chunk) => {
    body += chunk;
  });

  res.on("end", () => {
    try {
      const json = JSON.parse(body);

      if (json.error) {
        console.error("API Error:", json.error);
        return;
      }

      const rawOutput = json.candidates[0].content.parts[0].text;
      const cleanOutput = removeComments(rawOutput);

      const fileName = `output_${Date.now()}.txt`;
      fs.writeFileSync(fileName, cleanOutput, "utf8");

      console.log("Saved:", fileName);
    } catch (err) {
      console.error("Parse error:", err);
      console.error(body);
    }
  });
});

req.on("error", (err) => {
  console.error("Request error:", err);
});

req.write(data);
req.end();