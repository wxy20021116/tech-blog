# WXY Tech Blog

一个面向求职作品集和日常复盘的个人技术博客。项目基于 Astro + Fuwari 做二次定制，重点不只是“搭一个博客”，而是把日常开发中的 Git 提交、工程问题和解决方案沉淀成可公开分享的技术文章。

## 项目定位

这个仓库是我的个人技术博客源码，主要记录：

- 后端状态建模、接口设计和数据一致性经验
- Web 管理端与 PDA/移动端协同开发实践
- 多端状态流转、幂等、校验和异常处理
- 从真实项目中抽象出来的脱敏技术案例
- AI 辅助生成技术文章并同步到博客的工作流

文章不会直接暴露具体业务细节，而是把项目中遇到的问题抽象成通用工程案例。

## 技术栈

- [Astro](https://astro.build/)：静态站点生成
- [Fuwari](https://github.com/saicaca/fuwari)：博客主题基础
- [Tailwind CSS](https://tailwindcss.com/)：样式系统
- [Pagefind](https://pagefind.app/)：静态全文搜索
- [Expressive Code](https://expressive-code.com/)：代码块增强
- [pnpm](https://pnpm.io/)：包管理

## 我做了哪些定制

- 改造成中文个人技术博客
- 清理模板演示文章和多语言模板文档
- 增加个人站点配置、关于页和首篇技术文章
- 增加 Cloudflare Pages 部署说明
- 接入本地 `git-tech-blog` skill 工作流
- 支持把 `W:\ht\new\tech_docs` 中的文章同步到博客文章目录

## 本地运行

```powershell
pnpm install
pnpm dev --host 127.0.0.1 --port 4321
```

访问：

```text
http://127.0.0.1:4321/
```

如果本机开启了代理，访问 `127.0.0.1` 时建议把它加入代理绕过列表。

## 构建

```powershell
pnpm build
```

构建产物会输出到：

```text
dist
```

## 写文章

文章目录：

```text
src/content/posts
```

文章 frontmatter 示例：

```markdown
---
title: 多端协同系统中共享资源分配的状态一致性设计
published: 2026-05-22
description: 从一次多端协同改造中抽象出的共享资源分配、状态流转和前后端一致性设计经验。
tags: [后端, 前端, PDA, 状态一致性]
category: 技术实践
draft: false
---
```

## AI 技术文章工作流

本地配套了一个 Codex skill：`git-tech-blog`。它可以从 PDA、Web、后端三个仓库的 Git 提交中提炼技术主题，生成脱敏 Markdown 技术文章，再同步到本博客。

典型使用方式：

```text
把今天 wxy 的 git 提交写成技术文章，并同步到本地博客
```

脚本会把文章同步到：

```text
src/content/posts
```

## 部署

推荐部署到 Cloudflare Pages。

构建配置：

```text
Framework preset: Astro
Build command: pnpm build
Build output directory: dist
Production branch: main
```

详细步骤见：

[DEPLOY_CLOUDFLARE.md](./DEPLOY_CLOUDFLARE.md)

## 开源说明

本项目是基于 [Fuwari](https://github.com/saicaca/fuwari) 的二次定制版本，保留原项目 MIT License 版权声明。感谢 Fuwari 提供的优秀 Astro 博客主题基础。

在此基础上，本仓库更关注个人技术内容沉淀、中文技术文章展示和 AI 辅助写作流程。

## License

MIT License. See [LICENSE](./LICENSE).
