# Web3 Hackathon Collector

这是一个用于发现、去重、浅克隆并整理 Web3 Hackathon 公开源码的本地采集器。GitHub 仓库只包含采集与整理工具；运行后生成的第三方源码、中文描述及状态数据全部保留在本机，不会被提交或上传。

> 采集到的源码来自第三方公开仓库，仅作资料整理，不代表其安全性、完整性、许可证兼容性或仍可运行。使用、构建或部署前请自行审查。

## 这个 GitHub 仓库包含什么

| 包含 | 不包含 |
| --- | --- |
| 采集、去重、状态重建和目录整理脚本 | `repositories/` 下的第三方源码快照 |
| README 与忽略规则 | `descriptions/` 下的本地中文项目说明 |
| 平台采集工作流 | `state*.json`、去重索引及其他本地运行状态 |

这使得代码仓库保持轻量；换到新电脑时只需克隆本仓库，再重新运行采集器即可。

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
│   └── dorahacks/  ├── hackathonprojects/  └── github-discovery/
├── descriptions/                 # 本地数据：中文项目说明（不提交）
├── state-*.json                  # 本地数据：每个平台的可恢复采集状态（不提交）
├── state.json                    # 本地数据：汇总状态（不提交）
├── clone-reservations.json       # 本地数据：跨平台 URL 去重索引（不提交）
├── crawl-and-clone.mjs           # 主采集器
├── run-platform-continuously.ps1 # 单平台持续采集入口
├── rebuild-state.mjs             # 从本地快照重建状态
└── organize-*.mjs                # 按平台整理源码和描述
```

仓库目录名由可读名称和稳定哈希后缀组成，以避免同名项目碰撞。每个描述文件记录公开源码 URL、发现页面、项目摘要和顶层文件结构。

## 归档策略

- 仅处理公开展示页和公开代码托管链接；不登录、不提交表单、不收集私有仓库。
- 以规范化后的 Forge URL（主机、组织、仓库名）去重，并在克隆前建立全局预留记录。
- 新项目使用浅克隆：`git clone --depth 1 --single-branch --no-tags`。
- 当前归档已移除各项目内的 `.git/` 历史目录，只保留源码快照，以减少体积与迁移成本。
- 若需要某个项目的完整历史，请根据相应描述文件或状态文件中的原始 URL 单独重新克隆。

## 快速开始

需要 Node.js 18 或更高版本。采集器不依赖额外的 npm 包。

```powershell
git clone https://github.com/OddMiss/Web3-Hackathon-Collector.git
cd Web3-Hackathon-Collector

# 小批量、可恢复地采集
node .\crawl-and-clone.mjs --platform=blitz --state-file=state-blitz.json --max-pages=100

# 持续采集某个平台，直到达到目标或候选队列耗尽
.\run-platform-continuously.ps1 -Platform ethglobal
```

运行前请确认网络、磁盘空间和公开 API 的访问限制。首次运行会在本地创建 `repositories/`、`descriptions/`、`state-*.json` 与 `clone-reservations.json`；这些文件均已由 `.gitignore` 排除。

## 数据来源

采集器面向下列公开展示页，并在记录中保留发现来源：

- [ETHGlobal Showcase](https://ethglobal.com/showcase)
- [Blitz / Monad Showcase](https://blitz.devnads.com/showcase)
- [Devfolio Hackathons](https://devfolio.co/search?primary_filter=hackathons)
- [HackQuest Projects](https://www.hackquest.io/projects)
- [DoraHacks](https://dorahacks.io/hackathon)
- [HackathonProjects](https://hackathonprojects.dev/)

为扩大覆盖面，采集器也会使用与 Web3 Hackathon 明确相关的公开 GitHub 搜索结果；无法可靠归属单一平台的项目会落入 `github-discovery` 本地目录。

## 本地数据与发布安全

根目录的 `.gitignore` 会排除所有本地采集数据、嵌套 `.git/`、依赖目录、构建产物、日志与常见私密环境文件。若你修改采集器并准备推送，请先执行 `git status`，确认没有使用 `git add -f` 将本地数据或第三方源码强制纳入提交。

## 许可证与来源

每个子目录均为独立第三方项目，许可证并不相同。保留原始许可证、README 和来源信息；向公开 GitHub 仓库推送或再分发前，请按每个项目的许可证和平台条款评估授权范围。
