const fs = require("fs");
const { table } = require("table");

const getCoverageObject = (path) => {
  const content = fs.readFileSync(path, "utf-8");

  const result = {};

  const regex = /(.*):(\d+):\s+(\S+)\s+(\S+)/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const path = match[1];
    const func = match[3];
    const percentage = match[4];

    if (!result[path]) {
      result[path] = {};
    }

    result[path][func] = percentage;
  }

  return result;
};

const getTotal = (path) => {
  const content = fs.readFileSync(path, "utf-8");
  const rows = content.split("\n");

  const totalText = rows.find((row) => row.includes("total"));

  const [_total, _statements, percent] = totalText
    .split("\t")
    .filter((x) => x !== "");

  return percent;
};

const diff = (prev, curr) => {
  const paths = new Set([...Object.keys(prev), ...Object.keys(curr)]);
  const result = {};

  for (const path of paths) {
    const prevFuncs = prev[path] || {};
    const currFuncs = curr[path] || {};
    const funcs = new Set([
      ...Object.keys(prevFuncs),
      ...Object.keys(currFuncs),
    ]);

    for (const func of funcs) {
      const prevVal = prevFuncs[func];
      const currVal = currFuncs[func];

      if (prevVal !== currVal) {
        if (!result[path]) {
          result[path] = {};
        }
        result[path][func] = {
          diff: { curr: currVal, prev: prevVal },
        };
      } else if (result[path]?.[func]) {
        // rome-ignore lint/performance/noDelete: <explanation>
        delete result[path][func];
      }
    }

    if (Object.keys(currFuncs).length > Object.keys(prevFuncs).length) {
      for (const func of Object.keys(currFuncs)) {
        if (!prevFuncs.hasOwnProperty(func)) {
          if (!result[path]) {
            result[path] = {};
          }
          result[path][func] = {
            diff: { curr: currFuncs[func], prev: undefined },
          };
        }
      }
    }
  }

  return result;
};

const format = (repositoryURL, diff) => {
  const header = ["path", "func-name", "prev", "curr"];
  const rows = [];
  for (const [path, pathValue] of Object.entries(diff)) {
    for (const [funcName, { diff }] of Object.entries(pathValue)) {
      let prev = diff?.prev ?? "";
      let curr = diff?.curr ?? "";

      if (diff?.prev === undefined && diff?.curr) {
        prev = "(new func)";
      } else if (diff?.prev && diff?.curr === undefined) {
        curr = "(removed func)";
      }

      rows.push([path.replace(repositoryURL, ""), funcName, prev, curr]);
    }
  }

  return [header, ...rows];
};

const getEnv = (name) => {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`Missing env variable: ${name}`);
  }
  return value;
};

module.exports = async ({ github, context }) => {
  let repositoryURL = context.payload.repository.html_url.replace(
    "https://",
    ""
  );
  repositoryURL = `${repositoryURL}/`;

  const TARGET_BRANCH_COVERAGE_FILE = getEnv("TARGET_BRANCH_COVERAGE_FILE");
  const CURRENT_BRANCH_COVERAGE_FILE = getEnv("CURRENT_BRANCH_COVERAGE_FILE");
  const BOT_NAME = getEnv("BOT_NAME");

  const target = getCoverageObject(TARGET_BRANCH_COVERAGE_FILE);
  const targetTotal = getTotal(TARGET_BRANCH_COVERAGE_FILE);
  const current = getCoverageObject(CURRENT_BRANCH_COVERAGE_FILE);
  const currentTotal = getTotal(CURRENT_BRANCH_COVERAGE_FILE);

  const diffRows = format(repositoryURL, diff(target, current));
  if (targetTotal !== currentTotal) {
    diffRows.push(["total", "", targetTotal, currentTotal]);
  }

  let message = `Coverage: \`${currentTotal}\`\n`;
  if (diffRows.length > 1) {
    message += `## Diff: \`${diffRows.length - 1}\`\n`;
    message += `\`\`\`${table(diffRows)}\`\`\``;
  }

  const { data: comments } = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.payload.pull_request.number,
  });
  const alreadyCommented = comments.find(({ user }) => user.login === BOT_NAME);
  if (!alreadyCommented) {
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.payload.pull_request.number,
      body: message,
    });
  } else {
    await github.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: alreadyCommented.id,
      body: message,
    });
  }
};
