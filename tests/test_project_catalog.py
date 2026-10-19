"""Exercise catalog commands against isolated copies, without adding sample projects."""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class CatalogCommands(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="research-catalog-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for filename in ("README.md", "projects.json"):
            shutil.copyfile(ROOT / filename, self.root / filename)
        for directory in ("scripts", "templates"):
            shutil.copytree(ROOT / directory, self.root / directory)
        (self.root / "projects").mkdir()
        shutil.copyfile(ROOT / "projects" / "README.md", self.root / "projects" / "README.md")
        # Tests always start empty, even after real projects have been added to the repo.
        self.save({"schema_version": 1, "projects": []})
        self.run_command("sync")

    def run_command(self, *args, success=True):
        result = subprocess.run(
            [sys.executable, str(self.root / "scripts" / "project_catalog.py"), *args],
            cwd=self.root, capture_output=True, text=True, encoding="utf-8",
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        self.assertEqual(result.returncode, 0 if success else 1, result.stdout + result.stderr)
        return result

    def add_project(self, slug, title="测试项目", summary="研究摘要"):
        return self.run_command(
            "add", "--slug", slug, "--title", title, "--repo", "https://github.com/example/research.git",
            "--summary", summary,
        )

    def load(self):
        return json.loads((self.root / "projects.json").read_text(encoding="utf-8"))

    def save(self, data):
        (self.root / "projects.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

    def readme(self):
        return (self.root / "README.md").read_text(encoding="utf-8")

    def test_creates_numbered_projects_and_sorts_independently_of_json_order(self):
        self.add_project("first")
        self.add_project("second")
        data = self.load()
        self.assertEqual([project["id"] for project in data["projects"]], ["001", "002"])
        self.assertEqual(data["projects"][0]["repository"], "https://github.com/example/research")
        for directory in ("001-first", "002-second"):
            for filename in ("README.md", "RESEARCH.md", "assets/README.md", "web/README.md"):
                content = (self.root / "projects" / directory / filename).read_text(encoding="utf-8")
                self.assertNotIn("{{", content)
        data["projects"].reverse()
        self.save(data)
        self.run_command("sync")
        self.assertLess(self.readme().index("| 001 |"), self.readme().index("| 002 |"))
        self.run_command("check")

    def test_duplicate_and_path_traversal_do_not_modify_files(self):
        self.add_project("first")
        before = (self.root / "projects.json").read_bytes(), self.readme()
        for slug in ("first", "../escape"):
            self.run_command(
                "add", "--slug", slug, "--title", "无效项目", "--repo", "https://github.com/example/research",
                "--summary", "无效输入", success=False,
            )
        self.assertEqual(before, ((self.root / "projects.json").read_bytes(), self.readme()))
        self.assertEqual([path.name for path in (self.root / "projects").iterdir() if path.is_dir()], ["001-first"])

    def test_missing_image_is_rejected_then_caption_and_image_are_rendered(self):
        self.add_project("illustrated")
        data = self.load()
        data["projects"][0].update(preview="assets/preview.svg", preview_caption="首页展示与交互入口")
        self.save(data)
        self.run_command("sync", success=False)
        (self.root / "projects" / "001-illustrated" / "assets" / "preview.svg").write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>', encoding="utf-8",
        )
        self.run_command("sync")
        self.assertIn("![首页展示与交互入口](projects/001-illustrated/assets/preview.svg)", self.readme())
        self.run_command("check")

    def test_stale_catalog_is_detected_and_sync_preserves_intro(self):
        self.add_project("first")
        current = "自定义说明\n\n" + self.readme()
        (self.root / "README.md").write_text(current, encoding="utf-8")
        data = self.load()
        data["projects"][0]["status"] = "已复现"
        self.save(data)
        self.run_command("check", success=False)
        self.run_command("sync")
        self.assertTrue(self.readme().startswith("自定义说明\n\n"))
        self.assertIn("| 已复现 |", self.readme())
        self.run_command("check")

    def test_archived_ids_stay_reserved_and_markdown_cannot_break_table(self):
        self.add_project("first")
        data = self.load()
        data["projects"][0]["status"] = "已归档"
        self.save(data)
        self.add_project("second", title="名称 | [测试]", summary="摘要 | <标签>")
        self.assertEqual(self.load()["projects"][-1]["id"], "002")
        self.assertIn(r"名称 \| \[测试\]", self.readme())
        self.assertIn(r"摘要 \| \<标签\>", self.readme())
        self.run_command("check")

    def test_unregistered_directory_and_missing_research_are_detected(self):
        (self.root / "projects" / "001-orphan").mkdir()
        self.run_command("check", success=False)
        (self.root / "projects" / "001-orphan").rmdir()
        self.add_project("first")
        (self.root / "projects" / "001-first" / "RESEARCH.md").unlink()
        self.run_command("check", success=False)

    def test_incomplete_catalog_is_rejected_without_renumbering(self):
        for slug in ("first", "second", "third", "fourth"):
            self.add_project(slug)
        complete = self.load()
        for keep, missing in (([3], "001, 002, 003"), ([0, 2, 3], "002")):
            with self.subTest(keep=keep):
                self.save({"schema_version": 1, "projects": [complete["projects"][i] for i in keep]})
                result = self.run_command("check", success=False)
                self.assertIn("研究总索引缺少编号", result.stderr)
                self.assertIn(missing, result.stderr)
                self.assertEqual([item["id"] for item in self.load()["projects"]],
                                 [complete["projects"][i]["id"] for i in keep])

    def test_source_only_project_keeps_unknown_repository_and_links_original_post(self):
        origin = "https://x.com/huoshan007/status/2109919568617484522"
        self.run_command("add", "--slug", "source-study", "--title", "原视频研究",
                         "--source", origin, "--summary", "研究原片")
        project = self.load()["projects"][0]
        self.assertIsNone(project["repository"])
        self.assertEqual(project["source_url"], origin)
        self.assertIn(f"[原帖]({origin})", self.readme())
        self.assertIn("| 来源链接 |", self.readme())
        notes = (self.root / "projects/001-source-study/README.md").read_text(encoding="utf-8")
        self.assertIn(f"[{origin}]({origin})", notes)
        self.assertIn("| 原仓库 | 尚未确认 |", notes)
        self.assertNotIn("{{", notes)
        self.run_command("check")

    def test_explicit_source_takes_priority_without_losing_repository(self):
        self.add_project("first")
        data = self.load()
        data["projects"][0]["source_url"] = "https://example.com/original-video"
        self.save(data)
        self.run_command("sync")
        self.assertIn("[来源](https://example.com/original-video)", self.readme())
        self.assertNotIn("[GitHub](https://github.com/example/research)", self.readme())
        self.assertEqual(self.load()["projects"][0]["repository"], "https://github.com/example/research")
        self.run_command("check")

    def test_missing_or_unsafe_source_does_not_create_project(self):
        before = (self.root / "projects.json").read_bytes(), self.readme()
        for origin in (None, "http://example.com/post", "javascript:alert(1)",
                       "https://user:password@example.com/post", "https://example.com/a b"):
            args = ["add", "--slug", "invalid", "--title", "无效来源", "--summary", "来源验证"]
            if origin is not None:
                args += ["--source", origin]
            self.run_command(*args, success=False)
        self.assertEqual(before, ((self.root / "projects.json").read_bytes(), self.readme()))
        self.assertFalse((self.root / "projects/001-invalid").exists())


if __name__ == "__main__":
    unittest.main()
