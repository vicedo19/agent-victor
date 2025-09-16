import { tool } from "ai";
import { simpleGit } from "simple-git";
import { z } from "zod";
import { writeFile } from "fs/promises";
import { join } from "path";


const excludeFiles = ["dist", "bun.lock"];

const fileChange = z.object({
    rootDir: z.string().min(1).describe("The root directory"),
});

type fileChange = z.infer<typeof fileChange>;

// commit message generation
const commitMessageInput = z.object({
    rootDir: z.string().min(1).describe("The root directory"),
    type: z.enum(["feat", "fix", "docs", "style", "refactor", "test", "chore"]).describe("Type of commit"),
    scope: z.string().optional().describe("Scope of the commit (optional)"),
    description: z.string().min(1).describe("Brief description of the changes"),
    body: z.string().optional().describe("Detailed description of the changes (optional)"),
    breakingChange: z.boolean().default(false).describe("Whether this is a breaking change"),
    breakingChangeDescription: z.string().optional().describe("Specific description of the breaking change (optional, used when breakingChange is true)"),
});

type commitMessageInput = z.infer<typeof commitMessageInput>;


// markdown file input
const markdownFileInput = z.object({
    filePath: z.string().min(1).describe("Path where the markdown file should be created"),
    title: z.string().min(1).describe("Title of the markdown document"),
    content: z.string().min(1).describe("Content of the markdown document"),
    includeMetadata: z.boolean().default(false).describe("Whether to include frontmatter metadata"),
    metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().describe("Metadata to include in frontmatter (if includeMetadata is true)"),
});

type markdownFileInput = z.infer<typeof markdownFileInput>;


async function getFileChangesInDirectory({ rootDir }: fileChange) {
    const git = simpleGit(rootDir);
    const summary = await git.diffSummary();
    const diffs: { file: string; diff: string }[] = [];

    for (const file of summary.files) {
        if (excludeFiles.includes(file.file)) continue;
        const diff = await git.diff(["--", file.file]);
        diffs.push({ file: file.file, diff });
    }

    return diffs;
}


async function generateCommitMessage({ 
    rootDir, 
    type, 
    scope, 
    description, 
    body, 
    breakingChange,
    breakingChangeDescription
}: commitMessageInput) {
    try {
        const git = simpleGit(rootDir);
        
        // Build the commit message following conventional commits format
        let commitMessage = type;
        if (scope) {
            commitMessage += `(${scope})`;
        }
        if (breakingChange) {
            commitMessage += "!";
        }
        commitMessage += `: ${description}`;
        
        if (body) {
            commitMessage += `\n\n${body}`;
        }
        
        if (breakingChange) {
            const breakingText = breakingChangeDescription || body || "Breaking change introduced";
            commitMessage += `\n\nBREAKING CHANGE: ${breakingText}`;
        }
        
        // Create the commit
        await git.commit(commitMessage);
        
        return {
            message: commitMessage,
            success: true,
            hash: await git.revparse(['HEAD'])
        };
    } catch (error) {
        return {
            message: "",
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred during commit generation"
        };
    }
}


async function generateMarkdownFile({
    filePath,
    title,
    content,
    includeMetadata,
    metadata
}: markdownFileInput) {
    try {
        let markdownContent = "";
        
        // Add frontmatter if requested
        if (includeMetadata && metadata) {
            markdownContent += "---\n";
            for (const [key, value] of Object.entries(metadata)) {
                markdownContent += `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}\n`;
            }
            markdownContent += "---\n\n";
        }
        
        // Add title
        markdownContent += `# ${title}\n\n`;
        
        // Add content
        markdownContent += content;
        
        // Write the file
        await writeFile(filePath, markdownContent, 'utf-8');
        
        return {
            filePath,
            success: true,
            size: markdownContent.length
        };
    } catch (error) {
        return {
            filePath,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred during markdown file generation"
        };
    }
}


export const getFileChangesInDirectoryTool = tool({
    description: "Get the code changes made in given directory",
    inputSchema: fileChange,
    execute: getFileChangesInDirectory,
});


export const generateCommitMessageTool = tool({
    description: "Generate and create a git commit with a conventional commit message format",
    inputSchema: commitMessageInput,
    execute: generateCommitMessage,
});


export const generateMarkdownFileTool = tool({
    description: "Generate a markdown file with optional frontmatter metadata",
    inputSchema: markdownFileInput,
    execute: generateMarkdownFile,
});

