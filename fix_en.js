import fs from 'fs';

const code = fs.readFileSync('js/auth-guard.js', 'utf8');

// Find the th block
const authGuardStart = code.indexOf('window.globalAppTranslations = ');
const startTh = code.indexOf('th: {', authGuardStart);
const startLo = code.indexOf('  lo: {', startTh);
if (startTh === -1 || startLo === -1) {
  console.log('Cannot find th or lo blocks');
  process.exit(1);
}

const thStr = code.substring(startTh + 4, startLo).trim().replace(/,$/, '');
let thObj;
eval(`thObj = ${thStr};`);

import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  console.log('Translating to EN...', Object.keys(thObj).length, 'keys');
  
  const prompt = `Translate the following JSON object's values from Thai to English.
Make sure the translation is professional and appropriate for a Human Resources / Leave Management System.
DO NOT CHANGE ANY KEYS. ONLY CHANGE THE VALUES. Return ONLY a valid JSON string.

${JSON.stringify(thObj, null, 2)}`;

  const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
          responseMimeType: "application/json"
      }
  });

  const enObj = JSON.parse(response.text);
  
  let enStr = '{\n';
  for (const [k, v] of Object.entries(enObj)) {
      enStr += `    ${k}: ${JSON.stringify(v)},\n`;
  }
  enStr += '  }';
  
  // Replace the old en: { ... } block
  const startEn = code.indexOf('  en: {');
  const endEn = code.indexOf('};\n\nwindow.leaveRulesData');
  
  if (startEn === -1 || endEn === -1) {
    console.log('Cannot find en block boundaries', startEn, endEn);
    return;
  }
  
  const newCode = code.substring(0, startEn) + '  en: ' + enStr + '\n' + code.substring(endEn);
  fs.writeFileSync('js/auth-guard.js', newCode);
  console.log('Successfully replaced EN translations.');
}

run();
