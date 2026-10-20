import { Script } from "node:vm";
import { getQuickJS, shouldInterruptAfterDeadline } from "quickjs-emscripten";

// Generated code runs inside a bounded WASM interpreter, with no host callbacks,
// file system, network, shell, process or environment exposed.
export async function evaluateCore(core, expression, timeout = 750) {
  const engine = await getQuickJS();
  return engine.evalCode(`${core}\n;(${expression})`, {
    memoryLimitBytes: 24 * 1024 * 1024,
    shouldInterrupt: shouldInterruptAfterDeadline(Date.now() + timeout),
  });
}

export async function testDemo(
  run,
  { signal = new AbortController().signal } = {},
) {
  const files = await run.files(),
    checks = [];
  const check = (name, passed, detail = "") =>
    checks.push({
      name,
      passed: Boolean(passed),
      detail: String(detail).slice(0, 1200),
    });
  for (const name of ["index.html", "style.css", "core.js", "app.js"])
    check(`交付文件 ${name}`, Boolean(files[name]?.trim()));
  const html = files["index.html"] || "";
  check(
    "页面加载样式和两份实际脚本",
    /href=["'](?:\.\/)?style\.css["']/.test(html) &&
      /src=["'](?:\.\/)?core\.js["']/.test(html) &&
      /src=["'](?:\.\/)?app\.js["']/.test(html),
  );
  check(
    "核心脚本先于界面脚本加载",
    html.indexOf("core.js") >= 0 &&
      html.indexOf("core.js") < html.indexOf("app.js"),
  );
  check(
    "页面包含可交互控件",
    /<(?:button|input|select|textarea)\b/i.test(html),
  );
  check("界面引用同一 DemoAPI", /\bDemoAPI\b/.test(files["app.js"] || ""));
  const ids = new Set(
    [...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]),
  );
  const referenced = [
    ...(files["app.js"] || "").matchAll(
      /(?:getElementById|\$)\(\s*["']([\w-]+)["']\s*\)/g,
    ),
  ].map((m) => m[1]);
  check(
    "界面引用的元素存在",
    referenced.every((id) => ids.has(id)),
    referenced.filter((id) => !ids.has(id)).join(", "),
  );
  const code = `${files["core.js"] || ""}\n${files["app.js"] || ""}`
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\n)\s*\/\/[^\n]*/g, "$1");
  // Attribution URLs in source comments are evidence, not network requests.
  check(
    "可离线运行，无外部脚本或运行时网络依赖",
    !/(?:\b(?:fetch|XMLHttpRequest|WebSocket|importScripts|Worker|eval)\s*\(|\bimport\s|\bimport\s*\(|\blocation\s*[.=[])/i.test(
      code,
    ) &&
      !/(?:<(?:script|link|img|audio|video|source)\b[^>]*\b(?:src|href)\s*=\s*["']\s*(?:(?:https?:)?\/\/|javascript:)|<(?:iframe|object|embed)\b)/i.test(
        html,
      ) &&
      !/url\(\s*["']?(?:https?:)?\/\//i.test(files["style.css"] || ""),
  );
  for (const name of ["core.js", "app.js"]) {
    try {
      new Script(files[name] || "", { filename: name });
      check(`${name} JavaScript 语法`, Boolean(files[name]));
    } catch (error) {
      check(`${name} JavaScript 语法`, false, error.message);
    }
  }
  try {
    check(
      "核心 API 在隔离环境实际加载",
      await evaluateCore(
        files["core.js"] || "",
        "typeof DemoAPI==='object' && Object.values(DemoAPI).some(value=>typeof value==='function')",
      ),
    );
  } catch (error) {
    check(
      "核心 API 在隔离环境实际加载",
      false,
      error.message || JSON.stringify(error),
    );
  }
  let cases = [];
  try {
    const data = JSON.parse(files["tests.json"] || "null");
    if (
      !Array.isArray(data) ||
      data.length < 5 ||
      data.length > 18 ||
      data.some(
        (c) =>
          typeof c.name !== "string" ||
          !c.name.trim() ||
          c.name.length > 100 ||
          typeof c.expression !== "string" ||
          !/\bDemoAPI\b/.test(c.expression) ||
          /\b(?:require|process|module|fetch|import)\b/.test(c.expression) ||
          c.expression.length > 5000,
      )
    )
      throw new Error(
        "测试必须直接调用全局 DemoAPI；隔离环境没有 require、process、module、fetch 或文件系统。结构检查由平台执行，只需提交 5–18 条核心功能断言。",
      );
    cases = data;
    check("验证员提供完整功能断言", true);
  } catch (error) {
    check("验证员提供完整功能断言", false, error.message);
  }
  for (const entry of cases) {
    signal.throwIfAborted();
    try {
      const result = await evaluateCore(
        files["core.js"] || "",
        entry.expression,
      );
      check(
        entry.name,
        result === true,
        result === true
          ? "QuickJS 执行返回 true"
          : `实际返回：${JSON.stringify(result)}`,
      );
    } catch (error) {
      check(
        entry.name,
        false,
        `${error.name || "Error"}: ${error.message || JSON.stringify(error)}`,
      );
    }
  }
  const result = {
    passed: checks.every((c) => c.passed),
    passedCount: checks.filter((c) => c.passed).length,
    total: checks.length,
    checks,
    digest: await run.digest(),
    testedAt: new Date().toISOString(),
    scope:
      "交付结构、JavaScript 语法与核心逻辑的真实执行；不包含上游安装构建或完整浏览器测试",
  };
  await run.write(
    "tests.log",
    `${result.testedAt}\n${result.scope}\n${checks.map((c) => `${c.passed ? "PASS" : "FAIL"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`).join("\n")}\n${result.passedCount}/${result.total}\nSHA256 ${result.digest}\n`,
  );
  let history = [];
  try {
    history = JSON.parse(await run.read("test-history.json"));
  } catch {
    /* First test execution. */
  }
  await run.write(
    "test-history.json",
    JSON.stringify([...history, { ...result, cases }].slice(-12), null, 2),
  );
  return result;
}
