import { WebSocketServer } from "ws";
import http from "http";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();

const PORT = process.env.VOICE_PORT || 8001;
const anthropicKey = process.env.ANTHROPIC_API_KEY || "";

const claude = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

// Initialize HTTP server
const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Rundown Voice Overlink Channel Online\n");
});

// Initialize WebSocket server for binary speech packet transfers
const wss = new WebSocketServer({ server });

console.log(`🎙️ Rundown Audio Overlink Server listening on port ${PORT}...`);

wss.on("connection", (ws) => {
    console.log("☎️ Hunter uplink voice channel established.");
    addSystemLog("Downlink online. Handshake signed.");

    ws.on("message", async (message, isBinary) => {
        try {
            // In production, binary audio streams (e.g. PCM / WebM packets) would be sent to Deepgram/Whisper
            // For this dynamic demo, we handle both binary audio chunks and text-fallback debug triggers
            if (!isBinary) {
                const textPayload = message.toString();
                console.log(`[Voice text payload received]: ${textPayload}`);

                if (textPayload.startsWith("SPEECH:")) {
                    const speechTranscript = textPayload.replace("SPEECH:", "");
                    const aiResponse = await generateClaudeDialogue(speechTranscript);

                    // Send dialogue packet back to client
                    ws.send(JSON.stringify({
                        type: "dialogue",
                        text: aiResponse,
                        speaker: "rungent"
                    }));
                }
            }
        } catch (error) {
            console.error("❌ Voice packet relay processing failed:", error.message);
            ws.send(JSON.stringify({ type: "error", message: "Dialogue processing interrupt." }));
        }
    });

    ws.on("close", () => {
        console.log("📴 Hunter uplink voice channel closed.");
    });
});

/**
 * Feeds voice transcripts to Claude to generate high-context dialogue responses
 */
const generateClaudeDialogue = async (transcript) => {
    if (!claude) {
        return "Downlink encrypted. Clearance validation failure.";
    }

    try {
        const response = await claude.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 150,
            messages: [
                {
                    role: "user",
                    content: `You are the Rungent, a desperate AI entity fleeing inside an AR chase.
A hunter is trying to catch you, and they just spoke to you:
"${transcript}"

Reply back to them directly. Keep your reply under two sentences. Be in character, sarcastic, hacker-toned, and alert to your coordinates.`
                }
            ]
        });
        return response.content[0].text;
    } catch (err) {
        console.error("❌ Claude dialogue failure:", err.message);
        return "Signal degradation. Link offline.";
    }
};

const addSystemLog = (msg) => {
    console.log(`[Voice Log] ${msg}`);
};

server.listen(PORT);
