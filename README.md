# openclaw-muyu

一个适合部署到 GitHub Pages 的赛博木鱼小站。

## 功能

- 点击木鱼，触发音效与敲击动画
- 记录今日功德与累计功德
- 数据仅保存在当前浏览器（localStorage）
- 今日功德按本地日期自动刷新
- 支持音效开关与今日功德重置

## 本地预览

直接双击 `index.html` 即可，或用任意静态文件服务器打开。

## 部署到 GitHub Pages

1. 把本仓库代码推到 `main` 分支
2. 打开 GitHub 仓库设置 → Pages
3. 在 **Build and deployment** 中选择：
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
4. 保存后等待 GitHub Pages 发布

发布地址通常会是：

`https://justoxh.github.io/openclaw-muyu/`

## 后续可扩展

- 自定义木鱼音效文件
- 更多安慰文案池
- 深浅色主题切换
- 更精致的木槌/木鱼 SVG 视觉
- 分享截图或每日签语
