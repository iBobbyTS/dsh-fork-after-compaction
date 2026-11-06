# 压缩后分叉

[English](README.md) | [简体中文](README.zh.md)

在每次成功的 DSH 上下文压缩下增加操作行：复制摘要、从该压缩点分叉、查看摘要调用的 token 用量，以及显示压缩完成时间。

普通 Turn 结尾的分支动作切在 `turn/end`，可能早于手动压缩。本插件切在 `compaction/end`，使新会话继承压缩检查点；该压缩之后产生的内容不会进入新会话。

## 安装

Desktop 请先启动一次并完全退出，再使用应用自带 CLI 执行下列命令。

使用本仓库的源码 checkout 和 Node.js 22 或更高版本，将下面的绝对路径替换成实际路径：

```sh
dsh plugin --profile desktop add "link:/absolute/path/to/dsh-fork-after-compaction"
```

独立 Web profile 将 `desktop` 换成 `web`。重启对应 DSH 进程并刷新界面。本项目是 private 的 `@local/dsh-fork-after-compaction` bundle，通过源码目录安装，不使用 npm 上的同名包。

## 使用与限制

- 失败或尚未结束的压缩不出现操作行；较早的压缩需要对应记录页加载后才显示。
- 分叉复用 DSH 自身动作；没有 `session/fork` 权限时隐藏整行。
- 用量显示摘要调用的「缓存读取 / 未缓存输入 / 输出」。输入和输出都必须有效才显示用量胶囊；缺失的缓存桶按零处理。弹窗还可显示已上报的缓存写入量。
- 安装 `dsh-statusbar-config` 后由它格式化用量文字；未安装时使用本插件的兜底格式。
- 操作行和弹窗遵循原生悬停、键盘、时间和窄屏行为；根据已提交事件派生，不写入会话事件。

[开发与状态栏集成（英文）](docs/DEVELOPMENT.md)
