# 研究与目录约定

## 编号与顺序

- 项目目录格式为 `projects/NNN-slug/`，例如 `001-project-name/`。
- `id` 使用三位数字，从 `001` 开始；索引按数字升序排列。
- 编号表示收录顺序，创建后固定，不因研究状态变化重新编号。
- 已停止研究的项目改为“已归档”，保留记录和编号，避免复用已有链接。
- `slug` 使用小写英文、数字与连字符；标题和摘要可以使用中文。

## 新增项目

在仓库根目录运行：

```sh
python scripts/project_catalog.py add --slug project-name --title "项目名称" --repo "https://github.com/owner/repository" --summary "项目用途和本次研究重点"
```

命令自动分配编号、复制 `templates/project/`、登记 `projects.json` 并更新总 README。无需手动改编号或复制目录。

研究入口也可以是视频帖、文章或产品页面。原仓库尚未确认时，用`--source`登记真实来源，不要拿本研究归档仓库充当原仓库：

```sh
python scripts/project_catalog.py add --slug video-study --title "原视频研究" --source "https://example.com/original-video" --summary "研究演示效果、原理与价值"
```

`--repo`与`--source`至少提供一项，也可同时提供。未确认的原仓库保持`repository: null`；来源帖不等于原作者源码。

先完善项目 README，再记录 `RESEARCH.md`；源码和依赖按实际需要加入本项目目录。引用上游时保留仓库地址、许可证和固定 tag / commit，避免把研究结论与不断变化的默认分支混在一起。

## 索引数据

`projects.json` 是总索引唯一的数据来源。它使用以下结构；这是填写示例，不代表已收录的真实项目：

```json
{
  "schema_version": 1,
  "projects": [
    {
      "id": "001",
      "slug": "project-name",
      "title": "项目名称",
      "repository": "https://github.com/owner/repository",
      "summary": "一句话说明项目能力及其价值",
      "summary_details": {
        "capability": "能做什么，区分来源项目与我们的扩展",
        "principle": "通过什么机制实现",
        "value": "解决什么问题，对后续研究有什么意义",
        "progress": "已经验证什么，还有哪些边界或待确认事项"
      },
      "status": "待研究",
      "preview": null,
      "preview_caption": "",
      "demo_url": null
    }
  ]
}
```

| 字段 | 填写规则 |
| --- | --- |
| `id` | 固定编号，例如 `001` |
| `slug` | 目录名的英文部分，与编号共同组成项目路径 |
| `title` | 对外展示的项目名称 |
| `repository` | 已确认的 GitHub 仓库 HTTPS 地址，默认指原仓库；仅为依赖或参考时必须用 `repository_role` 标明。未确认时为 `null`，并填写 `source_url`；不得用本研究归档仓库冒充原仓库 |
| `repository_role` | 可选：`原仓库`（默认）/ `技术依赖` / `独立参考` / `早期参考`；用于说明仓库与研究对象的关系 |
| `source_url` | 可选，原视频帖、文章或项目页面的 HTTPS 链接；README 与仓库链接同时展示，网页来源入口仍优先使用它 |
| `source_name` | 可选，`source_url` 的可读名称，例如 `赛博小雅 · 原帖`、`Fotor Agent · 产品页`；仓库链接名称直接从地址提取 `owner/repository` |
| `summary` | 一句话说明能力与价值，用于 README 速览及网页项目卡片；使用纯文本 |
| `summary_details` | 可选对象，必须同时包含 `capability`（能力）、`principle`（原理）、`value`（意义）、`progress`（进展）；各项为单行纯文本，生成器负责加粗标签和表格内换行 |
| `status` | 待研究 / 研究中 / 已复现 / 已完成 / 已归档 |
| `preview` | 实际图片相对于子项目的路径，例如 `assets/preview.png`；无图片时为 `null` |
| `preview_caption` | 图片展示内容的简短说明；有配图时必填 |
| `demo_url` | 已发布并验证的演示地址；未发布时为 `null` |

更新数据后运行：

```sh
python scripts/project_catalog.py sync
python scripts/project_catalog.py check
```

`sync` 只更新根 README 的 `PROJECTS:START` 和 `PROJECTS:END` 标记之间的索引与图片区域。标记之外的介绍和导航可以直接编辑。`check` 检查编号、目录、必备文档、图片与索引同步状态。

## 配图与研究记录

每个项目在 `assets/` 保存图片，并在其中的 README 记录展示内容、来源和版本。总 README 使用一张代表性配图，其他截图和详细解释放在子项目 README 或研究记录中。

根 README 的项目状态用于快速导航；子项目研究记录保存实际证据。先完成复现再标记“已复现”，有研究结论后再标记“已完成”。

## 依赖与来源

子项目可以使用不同语言和框架，各自维护依赖文件与运行说明。总仓库的索引工具仅使用 Python 3.10+ 标准库，无需安装额外依赖。

默认不把原仓库完整历史或整个副本嵌入本仓库；确需保存上游代码时，记录版本、来源和改动，并保留其许可证。不要为所有引用项目统一声明一个未经确认的许可证。

[返回总入口](../README.md)
