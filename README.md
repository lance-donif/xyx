# RIDGELINE · 山脊骑行

[开始游戏](https://lance-donif.github.io/xyx/)

支持键盘和触屏的 Three.js 下坡骑行游戏。首页可选无尽逃亡或 1.2 公里计时赛。

## 骑行逃亡

骑手会自动冲出山林石门。到断崖前主动转入侧桥，甩开两只山狼；随路面收窄，在断桥前起跳，在低枝前俯身。擦碰会减速，狼群近身时再擦碰就会被追上，连续通过两个障碍可以重新拉开距离。路段会从山林延伸到海岸，最远距离保存在当前浏览器。[进入骑行逃亡](https://lance-donif.github.io/xyx/chase.html) · [观看从石门左转到越过断桥的实玩](docs/chase-preview.mp4)

| 动作 | 触屏 | 键盘 |
| --- | --- | --- |
| 横移取币、避开倒木 | 按住后横拖 | A / D |
| 在路口转弯 | 快速左滑或右滑 | ← / → |
| 跳跃、俯身 | 上滑、下滑 | ↑ / ↓ |
| 暂停 | 点右上角暂停键 | P / Esc |

首页和暂停面板均可关闭骑行提示。要重复同一条生成路线，可打开 [固定种子 17](https://lance-donif.github.io/xyx/chase.html?seed=17)。

## 下坡计时赛

计时赛取景自下方五段骑行演示。可以直接进入对应场景，按「出发」开始骑行。

| 场景 | 骑行画面 |
| --- | --- |
| [松冠山道 · 摩托车](https://lance-donif.github.io/xyx/?route=alpine&vehicle=moto) | 在巨树间的窄脊俯瞰山村，驶过树荫和谷地石拱桥。 |
| [暮色山城 · 自行车](https://lance-donif.github.io/xyx/?route=alpine&vehicle=cycle) | 从坡顶望见夕阳下的灯城，沿土路转入半木结构房屋和摊棚之间。 |
| [翡翠海岸 · 自行车](https://lance-donif.github.io/xyx/?route=coast&vehicle=cycle) | 沿崖壁下降，看对岸的港城和高架拱桥。到 0.70–0.80 公里，石板街从两排日光木屋之间通向海湾。海岸也可选择摩托车。 |

[查看首版与本轮实玩的同里程画面对照](docs/visual-update.webp)

四段跟车预览取自游戏的相机、物理和渲染器，按固定 24 帧/秒录制，时长约 11 秒。[观看骑行预览](docs/ride-preview.mp4)

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
