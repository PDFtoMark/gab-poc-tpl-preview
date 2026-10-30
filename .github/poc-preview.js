// PoC runner.
// `getAllTemplates`, `getPublishedTemplates`, `collectTemplateFiles` and `gitIgnored`
// are VERBATIM copies of cloudflare/templates cli/src/util.ts (main branch).
// The gate at the bottom is the verbatim logic of cli/src/preview.ts preview(),
// and the file-collection loop is the verbatim logic of cli/src/upload.ts upload().
const path = require("node:path");
const fs = require("node:fs");
const subprocess = require("node:child_process");

const TEMPLATE_DIRECTORY_SUFFIX = "-template";
const SEED_REPO_FILES = ["wrangler.jsonc", "wrangler.json", "wrangler.toml", "package.json", "README.md"];
const ALLOWED_DIRECTORIES = ["cli", "node_modules", "playwright-tests", "playwright-report", "test-results"];

// ---- verbatim from cli/src/util.ts ----
function getAllTemplates(templateDirectory) {
	if (path.basename(templateDirectory).endsWith(TEMPLATE_DIRECTORY_SUFFIX)) {
		const templatePath = templateDirectory;
		const packageJsonPath = path.join(templatePath, "package.json");
		if (!fs.existsSync(packageJsonPath)) {
			return [];
		}
		return [{ name: path.basename(templatePath), path: templatePath }];
	}
	const directories = fs
		.readdirSync(templateDirectory)
		.filter((file) => fs.statSync(path.join(templateDirectory, file)).isDirectory());
	for (const name of directories) {
		if (!name.endsWith(TEMPLATE_DIRECTORY_SUFFIX) && !name.startsWith(".") && !ALLOWED_DIRECTORIES.includes(name)) {
			throw new Error(`"${name}" does not end with "-template".`);
		}
	}
	return directories
		.filter((name) => fs.statSync(path.join(templateDirectory, name)).isDirectory())
		.filter((name) => name.endsWith(TEMPLATE_DIRECTORY_SUFFIX))
		.filter((name) => fs.existsSync(path.join(templateDirectory, name, "package.json")))
		.map((name) => ({ name, path: path.join(templateDirectory, name) }));
}

function getPublishedTemplates(templateDirectory) {
	return getAllTemplates(templateDirectory).filter((template) => {
		const packageJsonPath = path.join(template.path, "package.json");
		try {
			const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
			return pkg.cloudflare?.publish === true;
		} catch {
			return false;
		}
	});
}

function collectTemplateFiles(templatePath, onlySeedRepoFiles) {
	return fs
		.readdirSync(templatePath, { recursive: true })
		.map((file) => ({ name: file.toString(), filePath: path.join(templatePath, file.toString()) }))
		.filter(({ name }) => (onlySeedRepoFiles ? SEED_REPO_FILES.includes(name) : true))
		.filter(
			({ filePath }) =>
				!filePath.includes("node_modules") &&
				!fs.statSync(filePath).isDirectory() &&
				!gitIgnored(filePath),
		)
		.map(({ name, filePath }) => ({ filePath, file: new File([fs.readFileSync(filePath)], name) }));
}

function gitIgnored(filePath) {
	try {
		subprocess.execSync(`git check-ignore ${filePath}`);
		return true;
	} catch {
		return false;
	}
}
// ---- end verbatim ----

const args = process.argv.slice(2);
const templateDirectory = args[0];
const opt = (n) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : undefined);
const repoFullName = opt("--repoFullName");
const prId = opt("--pr");

console.log(`GITHUB_REPOSITORY=${process.env.GITHUB_REPOSITORY} --repoFullName=${repoFullName} --pr=${prId}`);
console.log(`PR_ALLOW_PREVIEW=${process.env.PR_ALLOW_PREVIEW}`);

// cli/src/preview.ts: preview() gate
const headRepo = `${repoFullName.split("/")[0]}/${repoFullName.split("/")[1]}`;
if (process.env.GITHUB_REPOSITORY !== headRepo && !process.env.PR_ALLOW_PREVIEW) {
	console.log(`BLOCKED: Preview links are not generated for forks (${headRepo}) without the label.`);
	process.exit(0);
}
console.log("gate passed -> upload()");

// cli/src/upload.ts: upload() file collection
const templates = getPublishedTemplates(templateDirectory);
for (const template of templates) {
	const files = collectTemplateFiles(template.path, true);
	console.log(`Uploading ${template.path}: ${files.map((f) => f.filePath).join(", ")}`);
}
