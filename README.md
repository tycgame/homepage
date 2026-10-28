# TYC — A world of my own.

田*诚的个人数字主场。雾白展厅、实时金属 3D 纽结、手写 TYC 签名，以及通往 [TYC Phigros](https://tycofficial.github.io/phigros/) 的卡片放大转场。

## 使用

无需安装依赖。部署整个目录，或使用 Node.js 20+：

```sh
npm run check
npm test
npm run build
```

`dist/` 是完整静态网站，可部署到 GitHub Pages。所有资源使用相对路径，兼容 `/homepage/` 子目录。不要直接通过 `file://` 打开 ES modules；本地预览请使用 HTTP 静态服务。

## GitHub Pages

仓库包含 `.github/workflows/pages.yml`。在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**，再运行 **Check and deploy TYC Home** 工作流。`main` 的后续提交会自动检查、测试和部署。

## 交互

- 3D 雕塑支持鼠标拖动、触摸横向拖动、方向键旋转和 Home 复位。纵向手势保留页面滚动。
- TYC Phigros 保留真实链接；普通点击播放约 1 秒的非线性放大转场，修饰键点击和新标签页保持浏览器原生行为。
- 顶部按钮可关闭动态并保存偏好；系统“减少动态效果”优先。无 WebGL 时使用 Canvas 3D 后备渲染，无 JavaScript 时链接仍可用。
- 返回主页时清理转场状态，兼容浏览器往返缓存。离屏、切后台后暂停 3D 渲染。
- 支持 PWA 安装与缓存后的首页离线访问。iOS 用 Safari 的“分享 → 添加到主屏幕”。Phigros 是独立网站，需要它自身的网络与离线支持。

## 文件

`sculpture.js` / `geometry.js`：原生 WebGL 网格、金属环境光、交互与恢复。`navigation.js`：转场与跳转。`sw.js`：仅作用于本首页目录的缓存。更新缓存结构时增加 `CACHE` 版本。

无需第三方 JavaScript、外部字体、追踪器或网络 API。页面不会收集访问者个人资料。
