# Web3 Hackathon Source Archive

这是一个面向研究、浏览与复现的 Web3 Hackathon 公开源码归档。项目从公开展示页发现可访问的源码链接，按来源平台分类保存，并为每个成功获取的项目生成中文描述。

> 归档中的源码来自第三方公开仓库，仅作资料整理，不代表其安全性、完整性、许可证兼容性或仍可运行。使用、构建或部署前请自行审查。

## 收录范围

| 平台 | 归档目录 | 目标 |
| --- | --- | --- |
| [ETHGlobal](https://ethglobal.com/showcase) | `repositories/ethglobal/` | 1,000 个源码快照 |
| [Blitz / Monad](https://blitz.devnads.com/showcase) | `repositories/blitz/` | 1,000 个源码快照 |
| [Devfolio](https://devfolio.co/search?primary_filter=hackathons) | `repositories/devfolio/` | 1,000 个源码快照 |
| [HackQuest](https://www.hackquest.io/projects) | `repositories/hackquest/` | 1,000 个源码快照 |
| [DoraHacks](https://dorahacks.io/hackathon) | `repositories/dorahacks/` | 持续补充 |
| [HackathonProjects](https://hackathonprojects.dev/) | `repositories/hackathonprojects/` | 1,000 个源码快照 |

`repositories/github-discovery/` 存放通过公开 GitHub 搜索发现、但未能可靠归属至单一展示平台的补充项目。实际数量与可重试状态以 `state*.json` 为准。

## 目录结构

```text
.
├── repositories/                 # 本地数据：按来源平台分类的第三方源码快照（不提交）
│   ├── ethglobal/  ├── blitz/  ├── devfolio/  ├── hackquest/
│   ├── dorahacks/  ├── hackathonprojects/  └── github-discovery/
├── descriptions/                 # 本地数据：中文项目说明（不提交）
├── state-*.json                  # 本地数据：每个平台的可恢复采集状态（不提交）
├── state.json                    # 本地数据：汇总状态（不提交）
├── clone-reservations.json       # 本地数据：跨平台 URL 去重索引（不提交）
├── crawl-and-clone.mjs           # 主采集器
└── REPOSITORY_DESCRIPTIONS.md    # 早期归档的汇总说明
```

仓库目录名由可读名称和稳定哈希后缀组成，以避免同名项目碰撞。每个描述文件记录公开源码 URL、发现页面、项目摘要和顶层文件结构。

## 归档策略

- 仅处理公开展示页和公开代码托管链接；不登录、不提交表单、不收集私有仓库。
- 以规范化后的 Forge URL（主机、组织、仓库名）去重，并在克隆前建立全局预留记录。
- 新项目使用浅克隆：`git clone --depth 1 --single-branch --no-tags`。
- 当前归档已移除各项目内的 `.git/` 历史目录，只保留源码快照，以减少体积与迁移成本。
- 若需要某个项目的完整历史，请根据相应描述文件或状态文件中的原始 URL 单独重新克隆。

## 继续采集

需要 Node.js 18 或更高版本。采集器不依赖额外的 npm 包。

```powershell
# 小批量、可恢复地采集
node .\crawl-and-clone.mjs --platform=blitz --state-file=state-blitz.json --max-pages=100

# 持续采集某个平台，直到达到目标或候选队列耗尽
.\run-platform-continuously.ps1 -Platform ethglobal
```

运行前请确认网络、磁盘空间和公开 API 的访问限制。`state-*.json`、`clone-reservations.json` 与 `descriptions/` 应与源码目录一同保留；它们让中断后的采集能够恢复，并防止重复下载。

## 推送到 GitHub 前

本目录当前只是普通文件夹。创建自己的 GitHub 仓库前，建议先在本地初始化并检查待提交内容：

```powershell
git init
git add README.md .gitignore *.mjs *.ps1
git status
```

根目录的 `.gitignore` 会排除所有本地采集数据（`repositories/`、`descriptions/`、状态文件）、嵌套 `.git/`、依赖目录、构建产物、日志与常见私密环境文件。仍应在首次提交前人工检查 `git status`：第三方项目可能包含未被通用规则覆盖的测试凭据、私钥、二进制大文件或不适合公开再分发的内容。

## 许可证与来源

每个子目录均为独立第三方项目，许可证并不相同。保留原始许可证、README 和来源信息；向公开 GitHub 仓库推送或再分发前，请按每个项目的许可证和平台条款评估授权范围。
