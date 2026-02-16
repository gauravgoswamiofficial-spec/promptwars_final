
import { GoogleGenAI, Type } from "@google/genai";
import { LevelPattern, AIEvent } from "../types";

/**
 * Service for interacting with Google Gemini AI.
 * Handles dynamic level generation and narrative game events.
 */

const SYSTEM_INSTRUCTION = "You are the system architect for 'HyperRun: Nexus', a high-performance cyberpunk runner. Respond only in valid JSON.";

export const generateDynamicLevel = async (difficulty: number): Promise<LevelPattern> => {
  try {
    // Create a new GoogleGenAI instance right before making an API call to ensure it uses the up-to-date API key.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a JSON pattern for an endless runner level. Difficulty: ${difficulty}/10. 
      The level should have a name and a sequence of 10 obstacles. 
      Lanes are 0 (left), 1 (center), 2 (right). 
      Types: BARRIER, TRAIN, RAMP, POWERUP.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            difficulty: { type: Type.NUMBER },
            obstacles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  lane: { type: Type.NUMBER },
                  type: { type: Type.STRING },
                  gap: { type: Type.NUMBER }
                }
              }
            }
          },
          required: ["name", "difficulty", "obstacles"]
        }
      }
    });

    // Use response.text getter directly.
    const jsonStr = response.text?.trim();
    if (!jsonStr) throw new Error("Empty response from AI");
    return JSON.parse(jsonStr) as LevelPattern;
  } catch (error) {
    console.error("Gemini Level Gen Failed:", error);
    return {
      name: "Neo-City Circuit (Fallback)",
      difficulty: 1,
      obstacles: Array.from({ length: 10 }, (_, i) => ({
        lane: i % 3,
        type: i % 5 === 0 ? "TRAIN" : "BARRIER",
        gap: 300
      }))
    };
  }
};

export const getAINarrativeEvent = async (score: number): Promise<AIEvent> => {
  try {
    // Create a new GoogleGenAI instance right before making an API call to ensure it uses the up-to-date API key.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Player Score: ${score}. Action: Generate glitch narrative event.`,
      config: {
        systemInstruction: "You are a rogue AI. Generate a short message (max 10 words) and a gameplay modifier: SPEED_UP, LOW_GRAVITY, or GLITCH_MODE.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            modifier: { type: Type.STRING },
            duration: { type: Type.NUMBER }
          },
          required: ["message", "modifier", "duration"]
        }
      }
    });
    // Use response.text getter directly.
    const jsonStr = response.text?.trim();
    if (!jsonStr) throw new Error("Empty response from AI");
    return JSON.parse(jsonStr) as AIEvent;
  } catch (e) {
    return {
      message: "CONNECTION STABILITY COMPROMISED",
      modifier: "GLITCH_MODE",
      duration: 5
    };
  }
};
