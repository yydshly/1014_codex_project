#!/usr/bin/env python3
"""Create numbered research projects and keep the README catalog in sync."""

import argparse
import json
import re
import shutil
import sys
from pathlib import Path
from urllib.parse import quote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "projects.json"
README = ROOT / "README.md"
START = "<!-- PROJECTS:START -->"
END = "<!-- PROJECTS:END -->"
STATUSES = ("待研究", "研究中", "已复现", "已完成", "已归档")
FIELDS = {
    "id", "slug", "title", "repository", "summary", "status",
    "preview", "preview_caption", "demo_url",
}
OPTIONAL_FIELDS = {"source_url", "source_name", "repository_role", "summary_details"}
SUMMARY_LABELS = {
    "capability": "能力", "principle": "原理", "value": "意义", "progress": "进展",
}
REPOSITORY_ROLES = ("原仓库", "技术依赖", "独立参考", "早期参考")
REQUIRED_FILES = ("README.md", "RESEARCH.md", "assets/README.md", "web/README.md")
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def single_line(value, label, allow_empty=False):
    require(isinstance(value, str), f"{label} 必须是字符串。")
    require(not any(ord(char) < 32 for char in value), f"{label} 不能包含换行或控制字符。")
    require(allow_empty or bool(value.strip()), f"{label} 不能为空。")


def repository_url(value):
    single_line(value, "repository")
    match = re.fullmatch(r"https://github\.com/([A-Za-z0-9-]+)/([A-Za-z0-9._-]+)", value)
    require(match is not None and match.group(2) not in (".", ".."),
            "repository 必须是 https://github.com/owner/repository 格式。")


def source_url(value):
    single_line(value, "source_url")
    parsed = urlsplit(value)
    require(parsed.scheme == "https" and bool(parsed.hostname)
            and parsed.username is None and parsed.password is None
            and "\\" not in value and not any(char.isspace() for char in value),
            "source_url 必须是有效的 HTTPS 来源链接，不能包含登录信息或空白。")


def project_directory(project):
    return ROOT / "projects" / f"{project['id']}-{project['slug']}"


def validate(data, check_files=True):
    require(isinstance(data, dict), "索引根节点必须是对象。")
    require(set(data) == {"schema_version", "projects"}, "索引根节点应包含 schema_version 与 projects。")
    require(type(data["schema_version"]) is int and data["schema_version"] == 1,
            "不支持的 schema_version；当前版本为 1。")
    require(isinstance(data["projects"], list), "projects 必须是数组。")
    ids, slugs, directories = set(), set(), set()
    for project in data["projects"]:
        require(isinstance(project, dict) and FIELDS <= set(project) <= FIELDS | OPTIONAL_FIELDS,
                "每个项目必须包含九个基础字段，仅支持约定的可选字段。")
        project_id = project["id"]
        require(isinstance(project_id, str) and re.fullmatch(r"[0-9]{3}", project_id)
                and project_id != "000", "id 必须是 001 至 999 的三位编号。")
        require(project_id not in ids, f"编号重复：{project_id}")
        ids.add(project_id)
        slug = project["slug"]
        require(isinstance(slug, str) and len(slug) <= 64
                and re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug),
                f"{project_id} 的 slug 只能使用小写英文、数字与连字符，最长 64 个字符。")
        require(slug not in slugs, f"slug 重复：{slug}")
        slugs.add(slug)
        for field in ("title", "summary"):
            single_line(project[field], f"{project_id}.{field}")
        if project["repository"] is not None:
            repository_url(project["repository"])
        if project.get("source_url") is not None:
            source_url(project["source_url"])
        if "source_name" in project:
            single_line(project["source_name"], f"{project_id}.source_name")
            require(project.get("source_url") is not None,
                    f"{project_id} 的 source_name 需要同时提供 source_url。")
        if "repository_role" in project:
            require(project["repository"] is not None
                    and project["repository_role"] in REPOSITORY_ROLES,
                    f"{project_id} 的 repository_role 需要仓库地址及有效的来源关系。")
        if "summary_details" in project:
            details = project["summary_details"]
            require(isinstance(details, dict) and set(details) == set(SUMMARY_LABELS),
                    f"{project_id} 的 summary_details 必须包含 capability、principle、value、progress。")
            for field, value in details.items():
                single_line(value, f"{project_id}.summary_details.{field}")
        require(project["repository"] is not None or project.get("source_url") is not None,
                f"{project_id} 必须提供原仓库 repository 或原始来源 source_url。")
        require(project["status"] in STATUSES, f"{project_id} 的 status 不在允许列表中。")
        single_line(project["preview_caption"], f"{project_id}.preview_caption", allow_empty=True)
        directory = project_directory(project)
        directories.add(directory.name)
        require(directory.resolve().parent == (ROOT / "projects").resolve(),
                f"{project_id} 的项目目录必须位于 projects 内。")
        if check_files:
            for relative in REQUIRED_FILES:
                require((directory / relative).is_file(), f"缺少文件：{directory.name}/{relative}")
        preview = project["preview"]
        if preview is not None:
            single_line(preview, f"{project_id}.preview")
            require("\\" not in preview and not Path(preview).is_absolute()
                    and ":" not in preview and ".." not in Path(preview).parts,
                    f"{project_id} 的 preview 必须是项目内的相对路径，使用 / 分隔。")
            preview_path = directory / preview
            require(preview_path.resolve().is_relative_to(directory.resolve()),
                    f"{project_id} 的 preview 超出项目目录。")
            require(preview_path.suffix.lower() in IMAGE_EXTENSIONS,
                    f"{project_id} 的 preview 需要使用支持的图片格式。")
            require(bool(project["preview_caption"].strip()), f"{project_id} 的配图需要 preview_caption。")
            if check_files:
                require(preview_path.is_file(), f"配图不存在：{directory.name}/{preview}")
        demo = project["demo_url"]
        if demo is not None:
            single_line(demo, f"{project_id}.demo_url")
            parsed = urlsplit(demo)
            require(parsed.scheme == "https" and bool(parsed.hostname)
                    and parsed.username is None and not any(char.isspace() for char in demo),
                    f"{project_id} 的 demo_url 必须是有效的 HTTPS 地址。")
    if ids:
        expected_ids = {f"{number:03d}" for number in range(1, max(map(int, ids)) + 1)}
        missing_ids = sorted(expected_ids - ids)
        require(not missing_ids, f"研究总索引缺少编号：{', '.join(missing_ids)}；保留既有项目记录，不以网页发布清单过滤总索引。")
    if check_files:
        for directory in (ROOT / "projects").iterdir():
            if directory.is_dir():
                require(directory.name in directories, f"未登记的项目目录：{directory.name}")


def load_catalog():
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    validate(data)
    return data


def markdown_text(value):
    return re.sub(r"([\\`*_{}\[\]()<>|])", r"\\\1", value)


def link(label, url):
    return f"[{markdown_text(label)}]({quote(url, safe='/:#?=&%+@,;~.-_')})"


def render_summary(project):
    details = project.get("summary_details")
    if details is None:
        return markdown_text(project["summary"])
    return "<br>".join(
        f"<strong>{label}：</strong>{markdown_text(details[field])}"
        for field, label in SUMMARY_LABELS.items()
    )


def render_sources(project):
    sources = []
    if project["repository"]:
        name = urlsplit(project["repository"]).path.strip("/")
        role = project.get("repository_role", "原仓库")
        sources.append(f"{role}：{link(name, project['repository'])}")
    if project.get("source_url"):
        origin = project["source_url"]
        fallback = "原帖" if urlsplit(origin).hostname in ("x.com", "twitter.com") else "来源"
        sources.append(link(project.get("source_name", fallback), origin))
    return "<br>".join(sources)


def render_catalog(data):
    projects = sorted(data["projects"], key=lambda project: int(project["id"]))
    if not projects:
        return "尚未收录研究项目。首个项目将从 **001** 开始，添加后会自动生成有序索引与配图区域。\n"
    lines = [
        "### 一句话速览", "",
        "先找想回顾的能力与价值，点击项目名查看完整说明；实现原理、验证进展和来源见下方详细索引。",
        "",
    ]
    for project in projects:
        base = f"projects/{project_directory(project).name}"
        name = f"{project['id']} · {project['title']}"
        lines.append(f"- **{link(name, f'{base}/README.md')}**：{markdown_text(project['summary'])}")
    lines.extend([
        "", "### 详细索引", "",
        "摘要按 **能力 → 原理 → 意义 → 进展** 阅读；能力与原理区分来源项目和我们的扩展，进展保留已验证结果与待确认边界。",
        "",
        "来源显示真实仓库名称；技术依赖、独立参考与早期参考单独标明，原帖或产品页保留为补充入口。",
        "",
        "| 编号 | 项目 | 摘要 | 状态 | 研究记录 | 源库 / 来源 | Web 演示 |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ])
    for project in projects:
        base = f"projects/{project_directory(project).name}"
        demo = link("演示", project["demo_url"]) if project["demo_url"] else "—"
        cells = [
            project["id"], link(project["title"], f"{base}/README.md"),
            render_summary(project), project["status"],
            link("研究笔记", f"{base}/RESEARCH.md"), render_sources(project), demo,
        ]
        lines.append("| " + " | ".join(cells) + " |")
    lines.extend(["", "### 项目配图", ""])
    illustrated = [project for project in projects if project["preview"]]
    if not illustrated:
        lines.append("暂未添加配图。图片与说明登记后将在此按项目编号展示。")
    for project in illustrated:
        base = f"projects/{project_directory(project).name}"
        lines.extend([
            f"#### {project['id']} · {markdown_text(project['title'])}", "",
            "!" + link(project["preview_caption"], f"{base}/{project['preview']}"), "",
            markdown_text(project["preview_caption"]), "",
            link("查看项目", f"{base}/README.md"), "",
        ])
    return "\n".join(lines).rstrip() + "\n"


def updated_readme(data, current):
    require(current.count(START) == 1 and current.count(END) == 1,
            "README 必须恰好包含一组 PROJECTS 索引标记。")
    start = current.index(START) + len(START)
    end = current.index(END)
    require(start < end, "README 索引标记顺序不正确。")
    return current[:start] + "\n\n" + render_catalog(data) + "\n" + current[end:]


def write_text(path, text):
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)


def sync(data):
    current = README.read_text(encoding="utf-8")
    replacement = updated_readme(data, current)
    if replacement != current:
        write_text(README, replacement)


def add_project(args):
    data = load_catalog()
    number = max((int(project["id"]) for project in data["projects"]), default=0) + 1
    require(number <= 999, "三位编号已用尽；需要先升级编号约定。")
    project = {
        "id": f"{number:03d}", "slug": args.slug, "title": args.title.strip(),
        "repository": args.repo.rstrip("/").removesuffix(".git") if args.repo else None,
        "summary": args.summary.strip(), "status": "待研究",
        "preview": None, "preview_caption": "", "demo_url": None,
    }
    if args.source is not None:
        project["source_url"] = args.source
    data["projects"].append(project)
    validate(data, check_files=False)
    directory = project_directory(project)
    require(not directory.exists(), f"目录已存在：{directory.name}")
    old_catalog = CATALOG.read_text(encoding="utf-8")
    old_readme = README.read_text(encoding="utf-8")
    replacement = updated_readme(data, old_readme)
    template = ROOT / "templates" / "project"
    require(all((template / relative).is_file() for relative in REQUIRED_FILES), "项目模板不完整。")
    created = False
    try:
        directory.mkdir()
        created = True
        values = {
            "id": project["id"], "title": markdown_text(project["title"]),
            "repository": project["repository"] or "尚未确认",
            "source_url": project.get("source_url") or project["repository"],
            "summary": markdown_text(project["summary"]),
            "directory": directory.name,
        }
        for source in template.rglob("*"):
            if not source.is_file():
                continue
            target = directory / source.relative_to(template)
            target.parent.mkdir(parents=True, exist_ok=True)
            if source.suffix.lower() == ".md":
                content = source.read_text(encoding="utf-8")
                content = re.sub(r"\{\{(\w+)\}\}", lambda match: values.get(match.group(1), match.group(0)), content)
                write_text(target, content)
            else:
                shutil.copyfile(source, target)
        validate(data)
        write_text(CATALOG, json.dumps(data, ensure_ascii=False, indent=2) + "\n")
        write_text(README, replacement)
    except (OSError, ValueError):
        if created:
            # Only clean up the newly created project, after checking its resolved parent.
            require(directory.resolve().parent == (ROOT / "projects").resolve(), "停止清理：目录越界。")
            shutil.rmtree(directory)
            write_text(CATALOG, old_catalog)
            write_text(README, old_readme)
        raise
    print(f"已创建 {directory.relative_to(ROOT).as_posix()}，并更新项目索引。")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    add = commands.add_parser("add", help="创建下一个编号项目并更新索引")
    add.add_argument("--slug", required=True)
    add.add_argument("--title", required=True)
    add.add_argument("--repo", help="已确认的原 GitHub 仓库；与 --source 至少提供一项")
    add.add_argument("--source", help="原始网页、视频帖或项目介绍的 HTTPS 链接")
    add.add_argument("--summary", required=True)
    commands.add_parser("sync", help="从 projects.json 更新 README 索引")
    commands.add_parser("check", help="检查项目记录、目录、图片和 README 同步状态")
    args = parser.parse_args()
    try:
        if args.command == "add":
            add_project(args)
        else:
            data = load_catalog()
            if args.command == "sync":
                sync(data)
                print("README 项目索引已同步。")
            else:
                current = README.read_text(encoding="utf-8")
                require(updated_readme(data, current) == current,
                        "README 索引未同步；请先运行 python scripts/project_catalog.py sync。")
                print(f"检查通过：{len(data['projects'])} 个项目，编号、目录、配图和 README 索引有效。")
    except (OSError, ValueError) as error:
        print(f"错误：{error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
