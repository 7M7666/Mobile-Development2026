# 海大一刻

校园照片社区。已完成三个阶段的本地代码，并补充资料保存校验、删除自己的动态和编辑面板排版。云端部署与真机联调仍需完成。界面为全中文，使用黑色粗体标题、白色留白和蓝色操作按钮，已移除界面中的“·”分隔符。

## 打开与编译

微信开发者工具导入 `W:\LiWanlin\workplace\weixin\experiments\experiment-06`。

- 实际源码入口：`miniprogram/app.js`，`project.config.json` 的 `miniprogramRoot` 必须为 `miniprogram/`。
- 云函数目录：`cloudfunctions/`。
- 环境配置：`miniprogram/config.js`，当前为 `cloud1-d6g4ha86qb278255f`。
- AppID 使用 `project.config.json` 当前值。
- 根目录原始默认 `app.*`、`pages/index/`、`components/navigation-bar/` 不参与当前小程序编译。
- 底栏使用 `miniprogram/custom-tab-bar/` 自定义组件，图标由样式绘制，已不再引用旧图片。若仍看到红色圆形、灰色多边形，请确认导入的是上述目录，再重新编译；必要时在工具中清除编译缓存。
- `node_modules/` 已加入当前实验的 `.gitignore`，保留本地已安装依赖。

## 本次更新后必须部署

仅重新编译前端不会更新云函数。尤其要重新部署getUserProfile，否则保存资料会提示资料服务版本过旧。

部署后依次验证：修改昵称和简介→保存→退出再进我的页；自己的动态→删除→返回首页及我的喜欢确认消失；发现页切换标签和热门；搜索动态、同学与标签。

### 1. 创建新增集合

保留原有 `users`、`posts`。补齐以下4个集合，不需要删除或重建旧数据：

```text
likes
comments
follows
notifications
```

六个集合均通过云函数读写，客户端数据库自定义权限：

```json
{ "read": false, "write": false }
```

云存储保持“所有用户可读，仅创建者可写”。用户自己上传照片、头像和封面。

### 2. 检查索引

以下均为非唯一索引。字段名 `_id` 末尾没有下划线，不能把默认索引名称 `_id_` 当作字段名。

| 集合 | 索引名称 | 字段顺序 |
| --- | --- | --- |
| posts | feed_latest | createTime 降序、_id 降序 |
| posts | feed_hot | likeCount 降序、createTime 降序、_id 降序 |
| posts | tag_latest | tags 升序、createTime 降序、_id 降序 |
| posts | tag_hot | tags 升序、likeCount 降序、createTime 降序、_id 降序 |
| users | popular_users | followerCount 降序、_id 降序 |
| posts | author_latest | _openid 升序、createTime 降序、_id 降序 |
| likes | user_latest | _openid 升序、createTime 降序、_id 降序 |
| likes | user_post | _openid 升序、postId 升序 |
| comments | post_latest | postId 升序、createTime 降序、_id 降序 |
| follows | user_order | _openid 升序、_id 升序 |
| notifications | receiver_latest | receiverOpenid 升序、createTime 降序、_id 降序 |
| notifications | receiver_unread | receiverOpenid 升序、isRead 升序 |

已有索引可保留；新增查询包含deleted不等于true过滤，真实云端若提示缺少组合索引，请按控制台给出的字段顺序补建。这里的索引尚未通过云端联调。

### 3. 部署全部13个云函数

在代码编辑器中展开 `cloudfunctions`，环境选择 `cloud1`。对每个文件夹右键选择“上传并部署：云端安装依赖”，等待成功：

```text
login
createPost
getPosts
getPostDetail
toggleLike
addComment
getComments
toggleFollow
getUserProfile
getNotifications
markNotificationsRead
searchContent
deletePost
```

新增6个：`toggleLike`、`addComment`、`getComments`、`toggleFollow`、`getNotifications`、`markNotificationsRead`。已有 `getPosts`、`getPostDetail`、`getUserProfile` 也已修改，必须重新部署；建议本次把11个统一部署。

沿用上游 `wx-server-sdk ~2.6.3`。不部署旧版 `uploadImage/getImages/getImageDetail`，项目不再使用单图 `images` 集合。

### 4. 编译并验证

1. 登录后进入“我的”，编辑昵称、简介、头像、封面并保存。
2. 发布含3张照片的动态，确认只生成一条 Post。
3. 在最新动态点赞，再次点击取消；查看获赞统计随之变化。
4. 进入详情，发布评论，确认评论列表与收到评论统计增加。
5. 用另一个微信账号或真实的另一位参与者登录测试关注、关注信息流及消息通知。开发者工具模拟器和同一账号真机通常不能代表两个独立用户。
6. 关注发布者后，“关注”信息流出现对方动态；取消后不再出现。
7. 被互动用户进入消息页，看到点赞、评论、关注通知。点击通知进入对应动态/主页；“本页已读”只标记已加载的消息。
8. 打开“我的喜欢”和公开主页“喜欢”标签，验证点赞内容网格。
9. 验证详情页1～9图预览、任意一张保存、真机微信分享仍能使用。

## 已实现范围

- 第一阶段：OpenID 登录，多图单 Post，文字、标签、手填地点、上传进度，最新 Feed，下拉刷新和分页，详情、浏览量、预览、下载、分享，个人发布网格。
- 第二阶段：点赞/取消、评论分页与发布、关注/取消、关注 Feed、三类通知与已读、获赞和收到评论统计、头像/昵称/简介/封面编辑、个人页与我的喜欢。
- 界面：自定义四入口底栏“首页、发现、发布、我的”；删除标题上方的装饰口号和点分隔；使用系统中文黑体字族与粗字重，具体字形随设备字体而异，没有加载第三方字体。
- 现在有8个页面：home、discover、publish、detail、profile、mine、search、notifications。资料编辑在个人页弹层内完成，不新增独立页面。
- 第三阶段：发现页标签筛选、最新/热门双列照片流、推荐用户；搜索动态、同学和标签；点击标签查找对应动态。近期热门标签统计最新100条未删除动态，热门照片按累计获赞排序，并非仅统计今天。
- 本次修复：资料编辑使用表单提交最终输入，只有服务端确认更新并返回一致资料才提示成功；识别旧版只读云函数。编辑面板有独立封面、头像、表单和固定保存区。
- 删除：在“我的→我的发布”缩略图右上角点击“删除”；也可打开自己的动态详情，在浏览次数右侧点击“删除动态”，确认后删除。别人看不到删除按钮，云函数也检查所有权。

## 接口与数据约定

- 集合固定为 users、posts、likes、comments、follows、notifications。
- `posts.images` 永远是1～9项云 fileID 数组；一次发布仅写1条 Post，事务更新用户 postCount。
- `users` 保留 postCount、likeReceivedCount、commentReceivedCount、followerCount、followingCount 等统计字段。
- 身份始终来自 `cloud.getWXContext().OPENID`；昵称、头像从服务端用户记录读取。
- `login`、详情及事务读取启用 `throwOnNotFound: false`。此前首登失败是 SDK 默认对缺失文档抛错，已修复；集合缺失依然是真实错误，不当作空文档吞掉。
- `createPost({requestId,images,caption,tags,location})`：OPENID与requestId决定稳定Post ID，重复提交不重复计数。
- `getPosts({mode,page,pageSize,tag,sortBy})`：mode为forYou、following或tag；sortBy为newest或hot。关注关系分页读取，不把关注名单截断为默认查询条数；Feed返回最新作者资料和当前用户点赞状态。
- `toggleLike({postId,liked})` 和 `toggleFollow({targetOpenid,following})` 传入期望布尔状态，网络重试不会意外反转结果。关系、计数、通知在同一事务内更新。
- 取消点赞/关注时删除相应通知；再次操作可产生新的未读通知。自赞与自评论不通知自己，禁止关注自己。
- `addComment({postId,content,requestId})`：1～500字，稳定ID防止超时重试重复评论，同步更新帖子、作者统计与通知。
- `getComments({postId,page,pageSize})` 返回分页评论与当前作者资料。
- `getUserProfile({targetOpenid,tab,page,pageSize})`：tab为posts或likes；空目标为自己。我的主页额外返回自己的未读数量。
- `getUserProfile({action:'update',nickName,bio,avatarUrl,coverUrl})`：只允许修改自己；昵称1～30字，简介最多160字；新头像和封面必须来自本人profiles上传目录或为空，也允许保留当前旧地址。返回updated:true与保存后的userInfo。
- `getNotifications({page,pageSize})` 永远只查询当前身份接收的通知；返回未读数、当前发送者资料。
- `markNotificationsRead({ids})` 最多30条，只更新属于当前接收者的记录。前端分批标记已加载消息，避免把刚到达的新通知误标已读。
- 头像和封面上传到 `profiles/<用户文档ID>/`；动态图片上传到 `moments/<用户文档ID>/<requestId>/`。
- 作者资料在查询时刷新，修改昵称或头像后，旧动态和评论显示当前资料。

## 本地验证

```powershell
cd W:\LiWanlin\workplace\weixin\experiments\experiment-06
node --test tests/stage1.test.js
```

测试文件保留原名称，现覆盖三个阶段。36项测试通过，包含多图单条、事务回滚、社交计数、资料持久化与旧服务误报、删除权限和重复删除、搜索转义和分页、标签计数、超过100条关注关系的推荐排除、过期搜索响应处理等。

29个JS文件语法检查通过。WXML/WXSS使用本机微信开发者工具编译器检查。个人资料编辑、发现和搜索页用实际编译的WXML树及WXSS进行了浏览器静态排版检查；这不是微信模拟器或真机截图。

云端部署、微信模拟器交互、权限弹窗和真机分享尚未验证。当前开发者工具服务端口关闭，CLI打开项目被阻止，未更改该安全设置。

## 当前限制

- 地点为用户手填名称，坐标为null，不伪造定位。
- 浏览量为访问次数，不是去重人数；丢失响应后重试可能多记一次。
- 分页沿用skip/limit，客户端按ID去重；持续新增内容时可下拉刷新。
- 发布和评论的结果不明时保留当前页面草稿并复用请求ID，关闭小程序后不持久保存。
- 删除动态使用deleted标记隐藏并事务扣回统计，保留原记录防止旧发布请求恢复帖子。成功时清理相关点赞、评论和通知；清理失败会提示重试，重复删除不重复扣数。部分清理期间可能短暂保留通知或喜欢记录，但详情和信息流已不可访问该动态。
- 删除动态不物理删除云图片；放弃上传或更换头像封面也可能留下未关联文件，暂无后台清理任务。
- 测试使用内存数据库和微信API mock，不代表真实CloudBase事务、权限、索引已经联调通过。

## 来源

- [yydscq6/wechat-image-community](https://github.com/yydscq6/wechat-image-community)：2026-09-08下载main源码ZIP，git clone因网络失败。沿用目录分层、基础页面流程及默认头像，重构为多图Post和校园社交模型；第三阶段直接复制并改编其Discover/Search页面逻辑及searchContent云函数，保留方法结构，适配Post、标签搜索和分页竞态处理。
- [xiaozhaoqi/moments](https://github.com/xiaozhaoqi/moments)：下载并阅读master的index/self，参考封面、刷新分页和头像进入相册的交互，未整体搬入。
- [Lab 6 PDF](https://gaopursuit.oss-cn-beijing.aliyuncs.com/course/mobileDev/lab6.pdf)：保留OpenID、云数据库、存储、云函数、图片首页、个人页、详情、下载、分享与全屏预览链路。
