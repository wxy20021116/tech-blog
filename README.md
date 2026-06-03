# Kris_Wen Tech Blog

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
- 增加作品集入口和隐藏图文发布页
- 增加 Cloudflare Pages 部署说明
- 接入本地 `git-tech-blog` skill 工作流
- 支持把 `W:\ht\new\tech_docs` 中的文章同步到博客文章目录
- 接入 Giscus 评论、不蒜子阅读量、Cloudflare Web Analytics 和相关文章推荐
- 自动生成文章 OG 分享图，并作为缺省文章列表封面使用

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

## 作品集和图文发布

作品集页面：

```text
/portfolio/
```

隐藏发布页面：

```text
/portfolio/publish/
```

这个发布页不会出现在顶部导航里，适合自己手动输入地址访问。页面设计成类似朋友圈发布框：只写一段话、选择图片、点击发表。

发布成功后会自动提交到 GitHub 仓库：

- 图文数据写入 `src/data/portfolio.json`
- 图片写入 `public/images/portfolio/`
- Cloudflare Pages 监听 `main` 分支，几分钟后自动部署

公开作品墙不会使用假数据。`src/data/portfolio.json` 为空时，页面只显示空状态。

### GitHub 授权发布

发布器使用 GitHub OAuth。流程是：

1. 打开 `/portfolio/publish/`
2. 写文字、选图片、点击发表
3. 如果还没登录，会跳转到 GitHub 授权页
4. 授权后回到博客
5. 再次点击发表，服务端用当前 GitHub 账号提交代码

安全边界：

- `GITHUB_OAUTH_CLIENT_ID` 和 `GITHUB_OAUTH_CLIENT_SECRET` 只是 OAuth App 的应用身份，不是你的 GitHub 密码，也不是仓库写入权限
- 真正提交代码使用的是当前登录 GitHub 用户授权后的 token
- 服务端还会校验 GitHub 登录名，只允许 `GITHUB_ALLOWED_LOGIN` 指定的账号发布
- 其他人即使打开隐藏页面并完成 GitHub 授权，也会被接口拒绝

### 创建 GitHub OAuth App

进入 GitHub：

```text
头像 -> Settings -> Developer settings -> OAuth Apps -> New OAuth App
```

填写：

```text
Application name: 你的博客作品发布器
Homepage URL: https://你的域名
Authorization callback URL: https://你的域名/api/github/callback
```

例如本项目：

```text
Homepage URL: https://blog.hiauto.me
Authorization callback URL: https://blog.hiauto.me/api/github/callback
```

创建后 GitHub 会给出：

```text
Client ID
Client Secret
```

把它们填到 Cloudflare Pages 环境变量里。

### 作品发布相关环境变量

必须设置：

```text
GITHUB_OAUTH_CLIENT_ID=<GitHub OAuth App Client ID>
GITHUB_OAUTH_CLIENT_SECRET=<GitHub OAuth App Client Secret>
GITHUB_ALLOWED_LOGIN=<允许发布的 GitHub 登录名>
```

fork 后建议也显式设置：

```text
GITHUB_OWNER=<你的 GitHub 用户名或组织名>
GITHUB_REPO=<你的仓库名>
GITHUB_BRANCH=main
```

可选：

```text
GITHUB_OAUTH_SCOPE=public_repo
```

如果仓库是公开仓库，`public_repo` 即可。  
如果仓库是私有仓库，需要改成：

```text
GITHUB_OAUTH_SCOPE=repo
```

## AI 技术文章工作流

本地配套了一个 Codex skill：`git-tech-blog`。它可以从 PDA、Web、后端三个仓库的 Git 提交中提炼技术主题，生成脱敏 Markdown 技术文章，再同步到本博客。

典型使用方式：

```text
把今天的 git 提交写成技术文章，并同步到本地博客
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

本项目包含 Cloudflare Pages Functions，目录是：

```text
functions
```

Cloudflare Pages 会自动识别这个目录，用于处理：

- GitHub OAuth 登录：`/api/github/login`
- GitHub OAuth 回调：`/api/github/callback`
- 当前用户校验：`/api/github/me`
- 作品发布：`/api/portfolio/publish`

详细步骤见：

[DEPLOY_CLOUDFLARE.md](./DEPLOY_CLOUDFLARE.md)

## Cloudflare Workers & Pages 快速配置

在 Cloudflare 控制台：

```text
Workers & Pages -> Create application -> Pages -> Import an existing Git repository
```

选择 fork 后的 GitHub 仓库，构建配置：

```text
Framework preset: Astro
Build command: pnpm build
Build output directory: dist
Root directory: /
Production branch: main
```

环境变量在：

```text
Workers & Pages -> 你的 Pages 项目 -> Settings -> Environment variables
```

建议同时在 `Production` 和 `Preview` 中按需配置。至少 Production 要配置：

```text
GITHUB_OAUTH_CLIENT_ID
GITHUB_OAUTH_CLIENT_SECRET
GITHUB_ALLOWED_LOGIN
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
PUBLIC_GISCUS_REPO_ID
PUBLIC_GISCUS_CATEGORY_ID
```

如果 Cloudflare Web Analytics 不是在 Pages 面板中自动注入，而是走代码配置，再加：

```text
PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN
```

## Giscus 评论配置

Giscus 用 GitHub Discussions 作为评论系统。fork 后需要重新配置自己的仓库信息。

### GitHub 仓库设置

1. 仓库必须是 Public
2. 进入仓库 `Settings -> General -> Features`
3. 勾选 `Discussions`
4. 安装 Giscus App：`https://github.com/apps/giscus`
5. 授权给你的博客仓库

### 生成 Giscus 参数

打开：

```text
https://giscus.app
```

填写：

```text
Repository: <你的 GitHub 用户名>/<你的仓库名>
Page ↔️ Discussions Mapping: pathname
Discussion Category: Announcements
Theme: preferred_color_scheme
Language: zh-CN
```

页面下方会生成一段 script，从里面找到：

```html
data-repo-id="..."
data-category-id="..."
```

把它们配置到 Cloudflare Pages 环境变量：

```text
PUBLIC_GISCUS_REPO_ID=<data-repo-id>
PUBLIC_GISCUS_CATEGORY_ID=<data-category-id>
```

代码里的仓库名在 [src/config.ts](./src/config.ts) 的 `commentConfig.giscus.repo`。fork 后建议同步改成：

```ts
repo: "<你的 GitHub 用户名>/<你的仓库名>"
```

如果没有配置 `PUBLIC_GISCUS_CATEGORY_ID`，评论框不会显示，但网站仍然可以正常构建和访问。

## 开源说明

本项目是基于 [Fuwari](https://github.com/saicaca/fuwari) 的二次定制版本，保留原项目 MIT License 版权声明。感谢 Fuwari 提供的优秀 Astro 博客主题基础。

在此基础上，本仓库更关注个人技术内容沉淀、中文技术文章展示和 AI 辅助写作流程。

## License

MIT License. See [LICENSE](./LICENSE).
