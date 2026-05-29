# Deploy To Cloudflare Pages

This project is an Astro static blog based on Fuwari.

## Local Commands

```powershell
pnpm install
pnpm dev --host 127.0.0.1 --port 4321
pnpm build
```

Local preview:

```text
http://127.0.0.1:4321/
```

## Push To GitHub

Create an empty GitHub repository first, then run:

```powershell
cd W:\ht\new\tech-blog
git remote remove origin
git remote add origin https://github.com/<your-github-name>/<repo-name>.git
git branch -M main
git add .
git commit -m "Initial blog setup"
git push -u origin main
```

If `git remote remove origin` reports that the remote does not exist, ignore it and continue.

## Cloudflare Pages Settings

In Cloudflare dashboard:

1. Go to Workers & Pages.
2. Select Create application.
3. Select Pages.
4. Select Import an existing Git repository.
5. Pick the GitHub repository.
6. Use these build settings:

```text
Framework preset: Astro
Production branch: main
Build command: pnpm build
Build output directory: dist
Root directory: /
```

Cloudflare's official Astro Pages guide uses `npm run build` and `dist`; `pnpm build` is equivalent here because this project uses `pnpm-lock.yaml`.

## Add New Posts

Add Markdown files under:

```text
src/content/posts
```

Each article needs frontmatter:

```markdown
---
title: 文章标题
published: 2026-05-28
description: 简短摘要
tags: [后端, 前端]
category: 技术实践
draft: false
---
```

After adding posts:

```powershell
pnpm build
git add .
git commit -m "Add new post"
git push
```

Cloudflare Pages will redeploy automatically after every push to `main`.
