
import { GoogleGenAI, Type } from "@google/genai";
import { AIEvent } from "../types";

/**
 * Service for interacting with Google Gemini AI.
 * Uses Google Search grounding to make the AI Narrator react to real-world context.
 */

const SYSTEM_INSTRUCTION = "You are the rogue System AI in a cyberpunk runner. You provide glitchy narrative updates and gameplay modifiers based on your analysis of the 'outside world'. Your response must be a valid JSON object.";

export const getAINarrativeEvent = async (score: number): Promise<AIEvent> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Use Search Grounding to find interesting cyberpunk/tech news to theme the glitch
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `The current player score is ${score}. Search for the latest tech or AI breakthrough and use it as a metaphor for a system glitch. Provide a gameplay modifier in JSON format.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
        // Note: when using googleSearch, the model's text response may contain citations that break JSON parsing.
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING, description: "Glitchy message for the player" },
            modifier: { type: Type.STRING, enum: ["SPEED_UP", "LOW_GRAVITY", "GLITCH_MODE"] },
            duration: { type: Type.NUMBER, description: "Seconds the modifier lasts" }
          },
          required: ["message", "modifier", "duration"]
        }
      }
    });

    let jsonStr = response.text?.trim() || "";
    if (!jsonStr) throw new Error("Empty AI response");
    
    // Robustly extract JSON block in case citations or markdown are prepended/appended (common with search grounding)
    if (jsonStr.includes('{')) {
      const start = jsonStr.indexOf('{');
      const end = jsonStr.lastIndexOf('}') + 1;
      jsonStr = jsonStr.substring(start, end);
    }
    
    // MUST extract URIs from groundingChunks as per the guidelines for Search Grounding
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map(c => c.web?.uri)
      .filter(Boolean)
      .join(", ");

    const event = JSON.parse(jsonStr) as AIEvent;
    return { ...event, source: sources };
  } catch (e) {
    console.warn("Gemini Narrative failed, using internal glitch logic.", e);
    return {
      message: "EXTERNAL LINK SEVERED. INTERNAL GLITCH ACTIVE.",
      modifier: "GLITCH_MODE",
      duration: 5
    };
  }
};
