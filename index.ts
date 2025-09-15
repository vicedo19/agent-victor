import { stepCountIs, streamText } from "ai";
import { google } from "@ai-sdk/google"; // Import the google module from the ai-sdk package
import { SYSTEM_PROMPT } from "./prompts";
import { 
    getFileChangesInDirectoryTool,
    generateCommitMessageTool,
    generateMarkdownFileTool
 } from "./tools";

// specify the model to use for generating review, a prompt, tools, and when to stop
const codeReviewAgent = async (prompt: string) => {
    const res = streamText({
        model: google("models/gemini-2.5-flash"),
        prompt,
        system: SYSTEM_PROMPT,
        tools: { getFileChangesInDirectoryTool, generateCommitMessageTool, generateMarkdownFileTool },
        stopWhen: stepCountIs(10),
    });

    for await (const chunk of res.textStream) {
        process.stdout.write(chunk);
    }
};

// Specify which directory the code review agent should review changes in your prompt
await codeReviewAgent(
    "Review the code changes in '../agent-victor' directory, make your reviews and suggestions file by file."
)