# koishi-plugin-aikanojo

[![npm](https://img.shields.io/npm/v/koishi-plugin-aikanojo?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-aikanojo)

高智能AI女友，基于oobabooga-text-generation-webui语言模型启动器。正式版。 
当前版本号1.0.0 

### 完成功能: 
时间轴√  
思维链√  
全功能状态栏√  
  穿着√  
  位置√  
  心情√  
  好感度√  
  与对话者的关系√  
优化切分逻辑和延时√  
优化状态栏显示√  
添加动作区块√  
添加长期记忆切分与读取 √  
语音系统√  
支持更多人设√  
工具调用√  
表情包√  
档案存储功能√  

### ToDo:  
world book系统  
正经的RAG长期记忆系统  

### 注意事项：
TGW后台需要自行部署<br>
github上有一键安装包，包含Windows，Linux，Mac。<br>
https://github.com/oobabooga/text-generation-webui<br>
也可以直接使用我制作的一键懒人包：https://www.bilibili.com/video/BV1Te411U7me<br>

支持使用Vits语音输出回复，需要加载任意tts插件比如open-vits插件，或者直接使用内置接口。<br>
可以通过编辑设置中的指令开头，来调整使用的插件格式。比如openvits插件就可以直接用：say<br>
open-vits插件：https://github.com/initialencounter/koishi-plugin-open-vits#readme<br>
自建vits后端：https://github.com/Artrajz/vits-simple-api<br>

推荐模型：<br>
强烈推荐(本插件以其为基础测试制作)：Gemma2 27b<br>
dolphine yi 1.5 34b<br>
yi 1.5 34b<br>
