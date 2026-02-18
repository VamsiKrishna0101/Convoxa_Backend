
import axios from 'axios';
import { env } from '../config/env.js';
import fs from 'fs';
import path from 'path';

async function listModels() {
    const apiKey = env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("❌ GEMINI_API_KEY is missing in .env");
        return;
    }

    console.log(`🔑 Using API Key: ${apiKey.substring(0, 5)}...`);
    console.log("📡 Fetching available Gemini models...");

    try {
        const response = await axios.get(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );

        const models = response.data.models;
        let output = "\n✅ Available Models:\n";
        output += "------------------------------------------------\n";

        models.forEach((m: any) => {
            if (m.supportedGenerationMethods.includes("generateContent")) {
                output += `- ${m.name.replace('models/', '')} (${m.displayName})\n`;
            }
        });
        output += "------------------------------------------------\n";

        console.log(output);

        const outputPath = path.resolve(process.cwd(), 'models_list_utf8.txt');
        fs.writeFileSync(outputPath, output, 'utf-8');
        console.log(`\n📄 Saved list to: ${outputPath}`);

    } catch (error: any) {
        console.error("❌ Failed to list models:", error.response?.data || error.message);
    }
}

listModels();
