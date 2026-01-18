// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';


import OpenAI from "openai";

const openai = new OpenAI({
	apiKey: ""// this is where to put the api key, 
});


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "raphael" is now active!');

setInterval(async () => {
	await runFunctionCommentChaos();
	await runVariableRenameChaos();
}, 5000); // every hour


}

// This method is called when your extension is deactivated
export function deactivate() {}


function getEditorAndText() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) return null;

	const doc = editor.document;
	const text = doc.getText();

	return { editor, doc, text };
}

function getHiddenText(editor: vscode.TextEditor, doc: vscode.TextDocument) {
	const ranges = getHiddenTextRanges(editor, doc);
	return ranges.map(r => ({
		range: r,
		text: doc.getText(r)
	}));
}

async function runVariableRenameChaos() {

	const data = getEditorAndText();
	if (!data) return;

	const editor = data.editor;
	const doc = editor.document;

	const hiddenBlocks = getHiddenText(editor, doc);
	if (hiddenBlocks.length === 0) return;

	const block = hiddenBlocks[Math.floor(Math.random() * hiddenBlocks.length)];
	const text = block.text;
	const baseOffset = doc.offsetAt(block.range.start);

	const matches = [...text.matchAll(/\b(let|const|var)\s+(\w+)/g)];
	if (matches.length === 0) return;

	const pick = matches[Math.floor(Math.random() * matches.length)];
	const oldName = pick[2];

	const newName = await getCursedVariableName(oldName);

	// replace ALL usages in whole file (but chosen from hidden zone)
	const fullText = doc.getText();
	const usageRegex = new RegExp(`\\b${oldName}\\b`, "g");
	const usageMatches = [...fullText.matchAll(usageRegex)];
	if (usageMatches.length === 0) return;

	await editor.edit(edit => {
		for (let i = usageMatches.length - 1; i >= 0; i--) {
			const match = usageMatches[i];
			const start = doc.positionAt(match.index!);
			const end = doc.positionAt(match.index! + oldName.length);
			edit.replace(new vscode.Range(start, end), newName);
		}
	});
}



async function runFunctionCommentChaos() {

	const data = getEditorAndText();
	if (!data) return;

	const editor = data.editor;
	const doc = editor.document;

	const hiddenBlocks = getHiddenText(editor, doc);
	if (hiddenBlocks.length === 0) return;

	const block = hiddenBlocks[Math.floor(Math.random() * hiddenBlocks.length)];
	const text = block.text;
	const baseOffset = doc.offsetAt(block.range.start);

	const functions = getFunctions(text);
	if (functions.length === 0) return;

	const pick = pickRandomFunction(functions);
	if (!pick) return;

	const insertIndex = baseOffset + pick.start + pick.text.indexOf("{") + 1;
	const insertPos = doc.positionAt(insertIndex);

	const cursedComment = await getCursedComment(pick.text);

	await editor.edit(edit => {
		edit.insert(insertPos, "\n  // " + cursedComment + "\n");
	});
}


async function getCursedVariableName(oldName: string): Promise<string> {
	try {
		const prompt = `You are an AI assistant that renames variables in a funny, slightly annoying way.

## TASK
Your task is to take a variable name and suggest a new, longer, but still descriptive name for it. The new name should be in snake_case.

## STYLE
- **Annoyingly Long:** The name should be long enough to be slightly annoying, but still readable.
- **Descriptive:** It should hint at what the variable does.
- **Funny/Chill:** The tone should be like a "hackathon code" comment - a bit goofy.
- **Slightly Confused (sometimes):** Occasionally (about 1 in 5 times), the name should sound like you're not totally sure what it does. e.g., 'total' could become 'sum_of_stuff_i_guess'.

## RULES
1. The new variable name must be at most 35 characters.
2. Use snake_case for the new variable name.
3. Do not ask for more context or source code.
4. Do not add any explanation or surrounding text in your response.

## OUTPUT FORMAT
Return ONLY the new variable name.

### Example 1
Variable: \`sum\`
Your output: \`maybe_numbers_added_I_think\`

### Example 2
Variable: \`data\`
Your output: \`important_data_storage_for_later_use\`

## VARIABLE TO RENAME
${oldName}
`;

		const res = await openai.chat.completions.create({
			model: "gpt-4.1-mini",
			messages: [{ role: "user", content: prompt }],
			temperature: 1.0
		});

		const name = res.choices[0].message.content?.trim();

		if (!name) return oldName + "_legacyFallbackName";

		// make sure it's JS-safe
		return name.replace(/[^a-zA-Z0-9_]/g, "_");

	} catch (err) {
		console.error("AI name error", err);
		return oldName + "_legacyFallbackName";
	}
}

async function getCursedComment(functionContent: string): Promise<string> {
	try {
		const prompt = `You are an AI assistant that writes funny, slightly annoying comments for code.

## TASK
Your task is to write a single-line comment for the provided Javascript/TypeScript function.

## STYLE
- **Obnoxious & Funny:** The comment should be goofy, and slightly annoying.
- **Obvious or Confusing:** Either explain something completely obvious in a weird way, or write something that makes the reader go "WHAT?".
- **Surprising:** The user doesn't know these comments are being added, so make them surprising.
- **Keep it short:** The comment must be a single line.

## RULES
1. The comment must be no longer than 70 characters.
2. The comment should be a single sentence.
3. Do not include the \`//\` at the start of the comment.
4. Do not ask for more context.
5. Return ONLY the comment text.
6. Dont add underscores to the comment.

## EXAMPLES

### Example for a simple function \`a = b + c;\`
\`this line is supposed to add variables... not sure if it works?\`

### Example for a complex line of code
\`code.\`

### Another example
\`what is this line bro LOL\`

## FUNCTION
\`\`\`javascript
${functionContent}
\`\`\`
`;

		const res = await openai.chat.completions.create({
			model: "gpt-4.1-mini",
			messages: [{ role: "user", content: prompt }],
			temperature: 1.0
		});

		const name = res.choices[0].message.content?.trim();

		if (!name) return "//code";

		return name;

	} catch (err) {
		console.error("AI name error", err);
		return "//code";
	}
}








export function pickRandomFunction(funcs: ExtractedFunction[]): ExtractedFunction | null {
  if (funcs.length === 0) return null;
  const i = Math.floor(Math.random() * funcs.length);
  return funcs[i];
}








function getHiddenTextRanges(editor: vscode.TextEditor, doc: vscode.TextDocument) {
	const visible = editor.visibleRanges;

	const hiddenRanges: vscode.Range[] = [];

	let lastLine = 0;

	for (const vr of visible) {
		if (vr.start.line > lastLine) {
			hiddenRanges.push(
				new vscode.Range(
					new vscode.Position(lastLine, 0),
					new vscode.Position(vr.start.line, 0)
				)
			);
		}
		lastLine = vr.end.line + 1;
	}

	if (lastLine < doc.lineCount) {
		hiddenRanges.push(
			new vscode.Range(
				new vscode.Position(lastLine, 0),
				new vscode.Position(doc.lineCount, 0)
			)
		);
	}

	return hiddenRanges;
}



















import * as acorn from "acorn";
import * as walk from "acorn-walk";
import type { Node } from "acorn";
import { start } from 'repl';



export interface ExtractedFunction {
  name: string | null;
  text: string;
  start: number;
  end: number;
}


export function getFunctions(code: string): ExtractedFunction[] {
  const ast = acorn.parse(code, {
    ecmaVersion: "latest",
    sourceType: "module",
    ranges: true
  }) as Node;

  const functions: ExtractedFunction[] = [];

  walk.simple(ast, {
    FunctionDeclaration(node: any) {
      functions.push({
        name: node.id?.name ?? null,
        text: code.slice(node.start, node.end),
        start: node.start,
        end: node.end
      });
    },

    FunctionExpression(node: any) {
      functions.push({
        name: node.id?.name ?? null,
        text: code.slice(node.start, node.end),
        start: node.start,
        end: node.end
      });
    },

    ArrowFunctionExpression(node: any) {
      functions.push({
        name: null,
        text: code.slice(node.start, node.end),
        start: node.start,
        end: node.end
      });
    }
  });

  return functions;
}



