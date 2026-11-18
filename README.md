# RIDGELINE · 山脊骑行

[开始游戏](https://lance-donif.github.io/xyx/)

一款根据下方五段骑行演示改编的 Three.js 下坡计时游戏。松冠山道穿过巨树、石拱桥和山村，翡翠海岸沿海湾崖壁展开。两条赛道均为 1.2 公里，可选摩托车或公路自行车。

山道开场沿巨树间的窄脊俯瞰山村，选择自行车可在暮色中进入亮灯的市集。海岸赛道沿海崖小径下降，对岸是港城与两层石拱桥。

骑手会自动前进。对准八道橙色计时门，漏过一道会在冲线时加三秒。成绩按赛道和车型保存在当前浏览器。

| 操作 | 键盘 |
| --- | --- |
| 向左、向右 | A / D 或 ← / → |
| 加速、刹车 | W / S 或 ↑ / ↓ |
| 暂停、继续 | P 或 Esc |

触屏游玩时按住方向和加减速按钮，可同时操作。需要支持 WebGL 2 的浏览器。

## 本地运行和发布

在项目根目录运行 `python3 -m http.server 8000`，然后打开 `http://localhost:8000/`。页面使用仓库内的 Three.js 模块与字体，无需 CDN。

本仓库的 GitHub Pages 从 `main` 分支根目录发布。开发时也可运行 `npm ci` 和 `npm run dev`。运行 `npm run build` 可生成用于静态托管的 `dist/`，支持部署到项目子路径。

## 原始演示视频

1. [林冠下的摩托车](https://video.twimg.com/amplify_video/2121322867552096256/vid/avc1/1920x1080/31t25jCjnzlNXg7M.mp4?tag=29)
2. [海崖山地骑行](https://video.twimg.com/amplify_video/2122819764104077312/vid/avc1/1920x1080/TNEnS0TGrVVC6fOR.mp4?tag=29)
3. [暮色村道下坡](https://video.twimg.com/amplify_video/2122452276040409088/vid/avc1/1920x1080/lpgwehfcHlqigBqk.mp4?tag=29)
4. [山谷公路与巨树](https://video.twimg.com/amplify_video/2122030764632223744/vid/avc1/1920x1080/9dZvrVtEAdiutuNd.mp4?tag=29)
5. [半木结构山村与渡槽](https://video.twimg.com/amplify_video/2121747379640786944/vid/avc1/1920x1080/1WE-Q0axNTXbWIZy.mp4?tag=29)
