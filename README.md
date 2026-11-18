# RIDGELINE · 山脊骑行

[开始游戏](https://lance-donif.github.io/xyx/)

一款根据下方五段骑行演示改编的 Three.js 下坡计时游戏。每场比赛全长 1.2 公里。可以直接进入对应场景，按「出发」开始骑行。

| 场景 | 骑行画面 |
| --- | --- |
| [松冠山道 · 摩托车](https://lance-donif.github.io/xyx/?route=alpine&vehicle=moto) | 在巨树间的窄脊俯瞰山村，驶过树荫和谷地石拱桥。 |
| [暮色山城 · 自行车](https://lance-donif.github.io/xyx/?route=alpine&vehicle=cycle) | 从坡顶望见夕阳下的灯城，沿土路转入半木结构房屋和摊棚之间。 |
| [翡翠海岸 · 自行车](https://lance-donif.github.io/xyx/?route=coast&vehicle=cycle) | 沿向海的崖壁下降，越过弯道看对岸的港城和高架拱桥。海岸也可选择摩托车。 |

[查看首版与本轮实玩的同里程画面对照](docs/visual-update.webp)

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
