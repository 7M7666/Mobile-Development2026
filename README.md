# Mobile Development 2026

中国海洋大学《移动软件开发》课程学习与实验仓库，记录微信小程序、HarmonyOS 应用实验和个人项目代码。

截至 2026-09-09：仓库已收录实验 1–6 的源码与实验报告，涵盖微信小程序基础、新闻展示、小游戏、HarmonyOS 计算器和云开发照片社区；个人项目 **Summer 2026** 已加入访客互动、路线编排与个性化拼贴。

## 课程信息

- 课程：移动软件开发
- 学校：中国海洋大学
- 学年：2026
- 课程页面：https://oucai.club/classes/MobileDev.html

## 仓库结构

```text
experiments/                 课程实验
├─ experiment-01/            实验 1：第一个微信小程序
├─ experiment-02/            实验 2：个人名片
├─ experiment-03/            实验 3：高校新闻网（源码在 project/）
├─ experiment-04/            实验 4：MEOW PUSH 推箱子（源码在 project/）
├─ experiment-05/            实验 5：HarmonyOS 多功能计算器
└─ experiment-06/            实验 6：海大一刻校园照片社区

project/                     个人项目 Summer 2026
├─ code/                     微信小程序源码、照片与音频素材
├─ materials/                原始项目素材
├─ tests/                    交互与回归测试
└─ summer2026_demo.mp4        剪辑后的演示视频
```

## 实验进度

| 实验 | 内容 | 源码 | 报告 | 状态 |
| --- | --- | --- | --- | --- |
| 实验 1 | 第一个微信小程序 | [experiment-01](experiments/experiment-01/) | [Markdown](experiments/experiment-01/report.md) / [PDF](experiments/experiment-01/report.pdf) | 已完成 |
| 实验 2 | 个人名片 | [experiment-02](experiments/experiment-02/) | [Markdown](experiments/experiment-02/report.md) / [PDF](experiments/experiment-02/report.pdf) | 已完成 |
| 实验 3 | 高校新闻网（OUC NEWS） | [project](experiments/experiment-03/project/) | [Markdown](experiments/experiment-03/Lab3_高校新闻网_实验报告.md) / [PDF](experiments/experiment-03/Lab3_高校新闻网_实验报告.pdf) | 已完成 |
| 实验 4 | MEOW PUSH 像素推饭碗 | [project](experiments/experiment-04/project/) | [Markdown](experiments/experiment-04/report.md) / [PDF](experiments/experiment-04/report.pdf) | 已完成 |
| 实验 5 | HarmonyOS 多功能计算器 | [experiment-05](experiments/experiment-05/) | [Markdown](experiments/experiment-05/report.md) / [PDF](experiments/experiment-05/report.pdf) | 已完成 |
| 实验 6 | 海大一刻校园照片社区 | [experiment-06](experiments/experiment-06/) | [Markdown](experiments/experiment-06/report.md) / [PDF](experiments/experiment-06/report.pdf) | 已实现并附运行记录，部分问题待完善 |

## 个人项目：Summer 2026

以暑期旅行与照片为内容的微信小程序，使用原生 WXML、WXSS、JavaScript 和 Skyline 渲染器。当前已实现：

| 模块 | 功能 |
| --- | --- |
| Home | 夏日总览、旅行地图、访客地点与氛围记录 |
| Journey | 行程卡片、旅行天数与偏好选择、地点排序及跳过、路线保存与对照 |
| Detail | 地点介绍、照片墙、照片预览与情境选择 |
| Summer Wrapped | 多页交互回顾、旅行与音乐选择、个人片段与回顾海报 |
| Your Cut | 根据互动选择照片、调整拼贴内容与顺序、生成海报并保存 |
| Archive | 作者与访客双视角归档、路线与选择记录、继续互动入口 |

项目使用统一数据与资源管理、自定义导航，并在本地保存回顾进度、访客偏好、路线、情境选择、照片选择和声音设置。交互与海报逻辑的验证脚本位于 `project/tests/`。

- [小程序源码](project/code/)

## 使用说明

### 微信小程序

使用微信开发者工具导入实验 1、2 的目录，或实验 3、4 下的 `project/` 目录。实验 6 导入 `experiments/experiment-06/`，源码入口为 `miniprogram/`，云函数位于 `cloudfunctions/`；使用自己的云环境，按[部署说明](experiments/experiment-06/README.md)配置集合、索引并部署云函数。最新运行记录见实验报告。

个人项目导入根目录下的 `project/`，其配置已将 `miniprogramRoot` 指向 `code/`。按自己的开发者权限配置 AppID，再编译、预览或真机调试；个人项目使用支持 Skyline 的基础库。

在仓库根目录运行个人项目与实验六的本地测试：

```sh
node --test project/tests/*.cjs
node --test experiments/experiment-06/tests/stage1.test.js
```

### HarmonyOS 计算器

使用 DevEco Studio 打开 `experiments/experiment-05/`，安装工程要求的 SDK 并同步依赖。当前配置为 `targetSdkVersion: 26.0.0`、`compatibleSdkVersion: 6.1.1(24)`。运行前需在本机配置签名并选择设备或模拟器。

核心逻辑可通过 Node.js 和 TypeScript 独立验证。在实验五目录执行，将 `<typescript.js>` 替换为本机 TypeScript 模块的绝对路径（例如 DevEco Studio 下的 `tools/ohpm/node_modules/typescript/lib/typescript.js`）：

```sh
node tests/verify-calculator.cjs "<typescript.js>"
node tests/verify-graph.cjs "<typescript.js>"
```

## 说明

本仓库用于保存课程实验和课程项目。具体实验要求、实现过程和运行截图以相应实验目录中的报告与源码为准。

本机私有配置、构建缓存、依赖目录、鸿蒙模拟器系统镜像和下载的 FFmpeg 工具包不纳入版本管理。
