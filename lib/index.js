"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const koishi_1 = require("koishi");
const axios = require("axios");
const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');
const { channel } = require("diagnostics_channel");
const HttpsProxyAgent = require('https-proxy-agent');
const { time } = require("console");
const { SlowBuffer } = require("buffer");
const { send, memoryUsage } = require("process");
const userTimers = new Map();
const alarms = new Map();
exports.inject = ['puppeteer', 'database', 'assets'];

exports.name = "aikanojo";
exports.usage = `
## 用前需知
### 当前为正式版1.3.2
### QQ讨论群：719518427
遇到bug或者有想要的功能，都可以加qq群讨论<br>
效果演示：https://www.bilibili.com/video/BV1BE421F7TT/?<br>
### 注意！插件更新会导致历史记录与默认人设重置，请自行保存相关文档！或使用档案功能存储到外部。<br>
默认的历史记录地址为：<br>
Koishi\\Desktop\\data\\instances\\default\\node_modules\\koishi-plugin-aikanojo\\lib<br>
目录下的longtermmemory和sessionData目录。分别保存着长期记忆，短期记忆和状态数据<br>

## 完成功能:<br>
时间轴√<br>
思维链√<br>
全功能状态栏√<br>
-穿着√<br>
-位置√<br>
-心情√<br>
-好感度√<br>
-与对话者的关系√<br>
动作区块√<br>
语音系统√<br>
工具调用√<br>
表情包√<br>
档案存储功能√<br>
视觉模块√<br>
RAG长期记忆系统√<br>

## ToDo:<br>
world book系统<br>

## 部署相关:<br>
TGW后台需要自行部署（1.3.0版本后可以使用deepseek的api）<br>
github上有一键安装包，包含Windows，Linux，Mac。<br>
https://github.com/oobabooga/text-generation-webui<br>
也可以直接使用我制作的一键懒人包：https://www.bilibili.com/video/BV1Te411U7me<br>

支持使用Vits语音输出回复，需要加载任意tts插件比如open-vits插件，或者直接使用内置接口。<br>
可以通过编辑设置中的指令开头，来调整使用的插件格式。比如openvits插件就可以直接用：say<br>
open-vits插件：https://github.com/initialencounter/koishi-plugin-open-vits#readme<br>
自建vits后端：https://github.com/Artrajz/vits-simple-api<br>

## 推荐模型：<br>
强烈推荐(本插件以其为基础调试制作)：Gemma2 27b：https://hf-mirror.com/turboderp/gemma-2-27b-it-exl2<br>
dolphine yi 1.5 34b<br>
yi 1.5 34b<br>
最低需求：Gemma2 9b q4 gguf<br>

### 如何接入视觉模块
emb模块是必须的，不然就没有长期记忆能力，约等于健忘症，当然，你也可以选择关闭emb选项然后无脑拉长短期记忆(不推荐)<br>
项目名：https://github.com/GralchemOz/llm_toolkit_api<br>
教程：https://forum.koishi.xyz/t/topic/2391/54<br>

### 如何使用emb向量库
教程：https://forum.koishi.xyz/t/topic/2391/55<br>

### 如何使用人设背景库
教程：https://forum.koishi.xyz/t/topic/2391/56<br>

## 更新日志:<br>
https://forum.koishi.xyz/t/topic/8207<br>
1.3.2修复语音发送失效的问题<br>
`;

exports.Config = koishi_1.Schema.intersect([
    koishi_1.Schema.object({
        apiMode: koishi_1.Schema.union([
            koishi_1.Schema.const('TGW').description('TGW-API'),
            koishi_1.Schema.const('DeepSeek').description('DeepSeek-API')
        ]).description('选择你使用的后端')
          .default('TGW'),
    }).description('模式选择'),
    koishi_1.Schema.union([
        koishi_1.Schema.object({
            apiMode: koishi_1.Schema.const('TGW').description('TGW后端'),
            apiURL: koishi_1.Schema.string()
                .description('TGW 服务器地址')
                .default('http://127.0.0.1:5000/')
        }).description('TGW模式配置'),
        koishi_1.Schema.object({
            apiMode: koishi_1.Schema.const('DeepSeek').description('DeepSeekAPI'),
            apiDeepSeek: koishi_1.Schema.string()
                .description('DeepSeekAPI 服务器地址')
                .default('https://api.deepseek.com/'),
            apiKey: koishi_1.Schema.string()
                .description('DeepSeekAPI Key')
                .default('xxxxx')
        }).description('DeepSeek模式配置')
    ]).description('选择API模式'),
    koishi_1.Schema.object({
        historyLimit: koishi_1.Schema.number()
            .description('短期记忆(注意这里指的是句子数量，一组对话有两个句子。)')
            .default(20),
        IntentionJudge: koishi_1.Schema.boolean()
            .description('是否显示意图判断')
            .default(false),
        InternalThinking: koishi_1.Schema.boolean()
            .description('是否显示内心思想')
            .default(false),
        show_state_bar: koishi_1.Schema.boolean()
            .description('是否显示状态栏')
            .default(true),
        show_Action: koishi_1.Schema.boolean()
            .description('是否显示动作')
            .default(true),
        Short_term_active: koishi_1.Schema.number().description('短期活跃间隔(单位毫秒,ms)')
            .default(600000),
        Short_term_active_times: koishi_1.Schema.number().description('短期活跃次数(决定了自激活上限)')
            .default(3),
        send_separate: koishi_1.Schema.boolean()
            .description('是否开启分开回复文本(增加模型回复拟人程度)')
            .default(true),
        if_at: koishi_1.Schema.boolean()
            .description('是否开启@回复')
            .default(false),
        nicknames: koishi_1.Schema.array(koishi_1.Schema.string())
            .description('昵称，当消息包含这些昵称时将触发 oob 指令')
            .default([]),
        if_private: koishi_1.Schema.boolean()
            .description('是否开启高级私聊模式，唤醒不需要前缀')
            .default(false),
        auto_use_character: koishi_1.Schema.boolean()
            .description('在未创建人设的情况下被唤醒是否会自动选择人设。')
            .default(false),
        select_character_notice: koishi_1.Schema.boolean()
            .description('自动选取人设时是否提示选取内容。')
            .default(true),
        auto_use_character_name: koishi_1.Schema.string().description('自动选择人设的人设名称')
            .default('咕咕白'),
    }).description('基础设置'),
    koishi_1.Schema.object({
        visual_url: koishi_1.Schema.string()
            .description('visual服务器地址(注意为/generate)')
            .default('http://127.0.0.1:8000/generate/'),
        emb_url: koishi_1.Schema.string()
            .description('向量库服务器地址(注意为/embed)')
            .default('http://127.0.0.1:8000/embed/'),
        visual_module: koishi_1.Schema.boolean()
            .description('是否开启视觉模块')
            .default(false),
        visual_debug: koishi_1.Schema.boolean()
            .description('是否发送视觉识别内容')
            .default(false),
        emb_module: koishi_1.Schema.boolean()
            .description('是否开启向量库长期记忆模块(是刚需，务必部署emb后台，教程地址：https://forum.koishi.xyz/t/topic/2391/55)')
            .default(true),
        emb_similar: koishi_1.Schema.number().description('数据库匹配相似度(越高则回调需求的相似度越高，0.7=70%相似度才回调)')
            .default(0.7),
        emb_user_message_number: koishi_1.Schema.number().description('回调历史参考范围(决定了最近几句会被作为数据库匹配默认-3)')
            .default(-3),
        emb_recall_number: koishi_1.Schema.number().description('回调的条目数量')
            .default(3),
        archive: koishi_1.Schema.boolean()
            .description('是否显示存入向量库内数据')
            .default(false),
        messagelabel: koishi_1.Schema.boolean()
            .description('是否显示用户输入打标')
            .default(false),
        emb_debug: koishi_1.Schema.boolean()
            .description('向量库回调debug模式')
            .default(false)
    }).description('视觉模块与向量库长期记忆模块设定(向量库为必须，不打开模型只有短期记忆)'),
    koishi_1.Schema.object({
        emb_pretreat: koishi_1.Schema.boolean()
            .description('是否开启背景库(开启后会多出一个预处理指令knj.pretreat，执行后，会自动将有背景库的人设文件进行标准化处理。如果没执行，在第一次加载人设的时候也会尝试自动进行转换)')
            .default(false),
    }).description('人设背景库设置'),
    koishi_1.Schema.object({
        UseTool: koishi_1.Schema.boolean()
            .description('开启工具调用')
            .default(false),
        UseTool_fullreply: koishi_1.Schema.boolean()
            .description('发送精确数据')
            .default(false),
        Google_Proxy: koishi_1.Schema.string()
            .description('谷歌搜索引擎的代理地址，默认本地clash')
            .default('http://127.0.0.1:7890'),
        UseTool_Picture: koishi_1.Schema.boolean()
            .description('发送网页图片(需要开启全局代理，只能获取维基百科图片，谨慎开启，建议配合下面的屏蔽词)')
            .default(false),
        dangerous_search_keywords: koishi_1.Schema.array(koishi_1.Schema.string())
            .description('屏蔽关键词(检索内容只要包含了以下内容就无法进行搜索)')
            .default(['超级北极熊'])
            .collapse(true),
        search_keywords: koishi_1.Schema.array(koishi_1.Schema.string())
            .description('触发搜索的关键词(在模型判断需要搜索且用户输入包含如下内容时，搜索生效)')
            .default(['搜索', '检索', '找', '搜', '查', '上网', '详细知识', '详细信息', '链接'])
            .collapse(true),
        UseTool_reply: koishi_1.Schema.boolean()
            .description('显示调用工具判断(Debug模式)')
            .default(false)
    }).description('工具调用相关设定'),
    koishi_1.Schema.object({
        UseEmoji: koishi_1.Schema.boolean()
            .description('开启表情包调用')
            .default(false),
        Emoji_Path: koishi_1.Schema.string()
            .description('表情包本地路径(留空就用内置)')
            .default(''),
        Emoji_Names: koishi_1.Schema.array(koishi_1.Schema.string())
            .description('可用表情名称')
            .default(['wink', '不知所措', '点赞', '愤怒', '惊讶', '开心', '哭哭', '礼貌', '冒泡', '你好', '生气', '帅气', '晚安', '凶', '耶', '疑惑', '微笑','思考'])
            .collapse(true),
        Emoji_alone: koishi_1.Schema.boolean()
            .description('是否需要开启表情包对应机制（如果开启，你必须去为每个人设创建一个独立的表情包文件夹，系统默认只给一个特蕾西娅的）')
            .default(false),
        Emoji_reply: koishi_1.Schema.boolean()
            .description('显示调用判断')
            .default(false)
    }).description('表情包相关设定'),
    koishi_1.Schema.object({
        Archive_Path: koishi_1.Schema.string()
            .description('档案文件夹本地路径(留空就用内置)')
            .default('')
    }).description('档案文件夹相关设定'),
    koishi_1.Schema.object({
        outputMode: koishi_1.Schema.union([
            koishi_1.Schema.const('text').description('只返回文字'),
            koishi_1.Schema.const('voice').description('只返回语音'),
            koishi_1.Schema.const('both').description('同时返回语音与文字'),
            koishi_1.Schema.const('extra').description('同时返回语音与文字(使用内置独立语音接口)'),
        ])
            .description('输出模式')
            .default('text'),
        ttscommand: koishi_1.Schema.string()
            .description('对接插件使用的指令(如果是对接其他语音插件只需要填写这个，下面的都不用管)')
            .default('say'),
        ttsurl: koishi_1.Schema.string()
            .description('vits-simple-api的url，默认值为http://127.0.0.1:23456/')
            .default('http://127.0.0.1:23456/'),
        bertorvits: koishi_1.Schema.boolean()
            .description('是否是bert-vits2模型')
            .default(false),
        ttsemotion: koishi_1.Schema.number()
            .description('情感控制')
            .default(8),
        ttsspeechlength: koishi_1.Schema.number()
            .description('语音速度')
            .default(1),
        ttsmaxlength: koishi_1.Schema.number()
            .description('最大合成长度')
            .default(128),
        ttsspeakerID: koishi_1.Schema.number()
            .description('tts语音服务的默认speakerid')
            .default(0),
        ttsformat: koishi_1.Schema.union([
            koishi_1.Schema.const('ogg').description('ogg'),
            koishi_1.Schema.const('wav').description('wav'),
            koishi_1.Schema.const('mp3').description('mp3'),
            koishi_1.Schema.const('amr').description('amr'),
        ])
            .description('音频格式')
            .default('mp3'),
        ttslanguage: koishi_1.Schema.union([
            koishi_1.Schema.const('auto').description('auto'),
            koishi_1.Schema.const('zh').description('zh'),
            koishi_1.Schema.const('en').description('en'),
            koishi_1.Schema.const('ja').description('ja'),
        ])
            .description('语言标记（建议auto）')
            .default('auto'),
    }).description('tts相关设置'),
    koishi_1.Schema.union([
        koishi_1.Schema.object({
            apiMode: koishi_1.Schema.const('TGW').description('TGW后端'),
            max_tokens: koishi_1.Schema.number().description('max_tokens')
                .default(250),
            temperature: koishi_1.Schema.number().description('temperature')
                .default(0.9),
            instruction_template: koishi_1.Schema.string().description('instruction_template')
                .default(''),
            frequency_penalty: koishi_1.Schema.number().description('frequency_penalty')
                .default(0),
            presence_penalty: koishi_1.Schema.number().description('presence_penalty')
                .default(0),
            stop: koishi_1.Schema.array(koishi_1.Schema.string())
                .default(["\n\n\n"]),
            top_p: koishi_1.Schema.number().description('top_p')
                .default(0.9),
            min_p: koishi_1.Schema.number().description('min_p')
                .default(0),
            top_k: koishi_1.Schema.number().description('top_k')
                .default(20),
            repetition_penalty: koishi_1.Schema.number().description('repetition_penalty')
                .default(1.15),
            repetition_penalty_range: koishi_1.Schema.number().description('repetition_penalty_range')
                .default(1024),
            typical_p: koishi_1.Schema.number().description('typical_p')
                .default(1),
            tfs: koishi_1.Schema.number().description('tfs')
                .default(1),
            top_a: koishi_1.Schema.number().description('top_a')
                .default(0),
            epsilon_cutoff: koishi_1.Schema.number().description('epsilon_cutoff')
                .default(0),
            eta_cutoff: koishi_1.Schema.number().description('eta_cutoff')
                .default(0),
            guidance_scale: koishi_1.Schema.number().description('guidance_scale')
                .default(1),
            negative_prompt: koishi_1.Schema.string().description('negative_prompt')
                .default(''),
            penalty_alpha: koishi_1.Schema.number().description('penalty_alpha')
                .default(0),
            mirostat_mode: koishi_1.Schema.number().description('mirostat_mode')
                .default(0),
            mirostat_tau: koishi_1.Schema.number().description('mirostat_tau')
                .default(5),
            mirostat_eta: koishi_1.Schema.number().description('mirostat_eta')
                .default(0.1),
            temperature_last: koishi_1.Schema.boolean().description('temperature_last')
                .default(false),
            do_sample: koishi_1.Schema.boolean().description('do_sample')
                .default(true),
            seed: koishi_1.Schema.number().description('seed')
                .default(-1),
            encoder_repetition_penalty: koishi_1.Schema.number().description('encoder_repetition_penalty')
                .default(1),
            no_repeat_ngram_size: koishi_1.Schema.number().description('no_repeat_ngram_size')
                .default(0),
            min_length: koishi_1.Schema.number().description('min_length')
                .default(0),
            num_beams: koishi_1.Schema.number().description('num_beams')
                .default(1),
            length_penalty: koishi_1.Schema.number().description('length_penalty')
                .default(1),
            early_stopping: koishi_1.Schema.boolean().description('early_stopping')
                .default(false),
            truncation_length: koishi_1.Schema.number().description('truncation_length')
                .default(0),
            max_tokens_second: koishi_1.Schema.number().description('max_tokens_second')
                .default(0),
            custom_token_bans: koishi_1.Schema.string().description('custom_token_bans')
                .default(''),
            auto_max_new_tokens: koishi_1.Schema.boolean().description('auto_max_new_tokens')
                .default(false),
            ban_eos_token: koishi_1.Schema.boolean().description('ban_eos_token')
                .default(false),
            add_bos_token: koishi_1.Schema.boolean().description('add_bos_token')
                .default(true),
            skip_special_tokens: koishi_1.Schema.boolean().description('skip_special_tokens')
                .default(true),
            grammar_string: koishi_1.Schema.string().description('grammar_string')
                .default(''),
        }).description('TGW高阶设置，如果你不知道你在干什么，请不要修改，保持默认'),
        koishi_1.Schema.object({
            apiMode: koishi_1.Schema.const('DeepSeek').description('DeepSeekAPI'),
            model: koishi_1.Schema.string().description('model')
                .default('deepseek-chat'),
            max_tokens: koishi_1.Schema.number().description('max_tokens')
                .default(800),
            temperature: koishi_1.Schema.number().description('temperature')
                .default(0.9),
            frequency_penalty: koishi_1.Schema.number().description('frequency_penalty')
                .default(0.2),
            presence_penalty: koishi_1.Schema.number().description('presence_penalty')
                .default(0),
            stop: koishi_1.Schema.array(koishi_1.Schema.string())
                .default(["\n\n\n"]),
            top_p: koishi_1.Schema.number().description('top_p')
                .default(0.9)
        }).description('DeepSeek高阶设置，如果你不知道你在干什么，请不要修改，保持默认')
    ]).description('高阶设置')
]);

//创建sessionId
function buildSessionId(session, config, characterName, speakerId) {
    let sessionIdParts = [
        session.channelId.toString().replace(/-/g, '')
    ];

    sessionIdParts.push(session.userId.toString());
    sessionIdParts.push(characterName);
    sessionIdParts.push(speakerId);

    return sessionIdParts.join('-');
}

//转换ms到min
function millisecondsToMinutes(milliseconds) {
    var minutes = milliseconds / (1000 * 60);
    return minutes;
}

//准备url
function prepareURL(config) {
    let url = '';
    if (config.apiMode == "TGW") {
        if (config.apiURL.endsWith('/')) {
            url = config.apiURL + 'v1/chat/completions';
        } else {
            url = config.apiURL + '/v1/chat/completions';
        }
        return url;
    }
    if (config.apiMode == "DeepSeek") {
        if (config.apiDeepSeek.endsWith('/')) {
            url = config.apiDeepSeek + 'chat/completions';
        } else {
            url = config.apiDeepSeek + '/chat/completions';
        }
        return url
    }
}

//创建requestbody并post发送获得response
async function createRequest(config, session, customConfig = {}) {
    //TGW
    if (config.apiMode == "TGW") {
        const url = prepareURL(config)
        const defaultConfig = {
            "messages": [{}],
            "continue_": false,
            "instruction_template": config.instruction_template,
            "frequency_penalty": config.frequency_penalty,
            "max_tokens": config.max_tokens,
            "presence_penalty": config.presence_penalty,
            "stop": config.stop,
            "temperature": config.temperature,
            "top_p": config.top_p,
            "min_p": config.min_p,
            "top_k": config.top_k,
            "repetition_penalty": config.repetition_penalty,
            "repetition_penalty_range": config.repetition_penalty_range,
            "typical_p": config.typical_p,
            "tfs": config.tfs,
            "top_a": config.top_a,
            "epsilon_cutoff": config.epsilon_cutoff,
            "eta_cutoff": config.eta_cutoff,
            "guidance_scale": config.guidance_scale,
            "negative_prompt": config.negative_prompt,
            "penalty_alpha": config.penalty_alpha,
            "mirostat_mode": config.mirostat_mode,
            "mirostat_tau": config.mirostat_tau,
            "mirostat_eta": config.mirostat_eta,
            "temperature_last": config.temperature_last,
            "do_sample": config.do_sample,
            "seed": config.seed,
            "encoder_repetition_penalty": config.encoder_repetition_penalty,
            "no_repeat_ngram_size": config.no_repeat_ngram_size,
            "min_length": config.min_length,
            "num_beams": config.num_beams,
            "length_penalty": config.length_penalty,
            "early_stopping": config.early_stopping,
            "truncation_length": config.truncation_length,
            "max_tokens_second": config.max_tokens_second,
            "custom_token_bans": config.custom_token_bans,
            "auto_max_new_tokens": config.auto_max_new_tokens,
            "ban_eos_token": config.ban_eos_token,
            "add_bos_token": config.add_bos_token,
            "skip_special_tokens": config.skip_special_tokens,
            "grammar_string": config.grammar_string
        };
        let request = Object.assign({}, defaultConfig, customConfig);
        let response = await axios.post(url, request);
        if (response.status == 200) {
            return response;
        } else {
            session.send(`API请求失败，请检查服务器状态。错误代码：${response.status}`);
            console.log("API请求失败，请检查服务器状态。");
            return;
        }
    }
    //DeepSeek
    if (config.apiMode == "DeepSeek") {
        let url
        let lastMessage = ''
        //不续写
        if (customConfig.continue_ == false || !('continue_' in customConfig)) {
            url = prepareURL(config);
        }
        //续写
        if (customConfig.continue_ == true) {
            if (config.apiDeepSeek.endsWith('/')) {
                url = config.apiDeepSeek + 'beta/chat/completions';
            } else {
                url = config.apiDeepSeek + '/beta/chat/completions';
            }
            if (customConfig.messages && customConfig.messages.length > 0) {
                // 设置 prefix 参数为 true
                lastMessage = customConfig.messages[customConfig.messages.length - 1];
                lastMessage.prefix = true;
            }
        }
        //去掉continue_
        for (const key in customConfig) {
            if (key.startsWith("continue_")) {
                delete customConfig[key];
            }
        }
        const defaultConfig = {
            "messages": [{}],
            "model": config.model,
            "frequency_penalty": config.frequency_penalty,
            "max_tokens": config.max_tokens,
            "presence_penalty": config.presence_penalty,
            "response_format": {
                "type": "text"
            },
            "stop": config.stop,
            "stream": false,
            "stream_options": null,
            "temperature": config.temperature,
            "top_p": config.top_p,
            "tools": null,
            "tool_choice": "none",
            "logprobs": false,
            "top_logprobs": null
        };
        let request = Object.assign({}, defaultConfig, customConfig);
        let response = await axios.post(url, request, {
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
            }
        });
        if (response.status == 200) {
            if (lastMessage !== '') {
                //重组content
                response.data.choices[0].message.content = lastMessage.content + response.data.choices[0].message.content;
            }
            return response;
        } else {
            session.send(`API请求失败，请检查服务器状态。错误代码：${response.status}`);
            console.log("API请求失败，请检查服务器状态。");
            return;
        }
    }
  if (!config.apiMode) {
    session.send("模式选择有误，请呼叫管理员手动选择apiMode模式");
  }
}

//获取用户名
async function getUsername(session, ctx) {
    let username;
    if (ctx.database) {
        username = session.user.name;
    }
    if (!username) {
        username = session.author.nick || session.author.username;
    }
    return username;
}

// 解析人设名称
async function getSessionData(session, config) {
    let safefilename = await CheckSessionFile(session, config);
    let filename = decodeURIComponent(safefilename.replace(/\.json$/, ''));
    let parts = filename.split('-');
    let channelId = parts[0];
    let userId = parts[1];
    let characterName = parts[2];
    let speakerId = parts[3];
    return {
        channelId: channelId,
        userId: userId,
        characterName: characterName,
        speakerId: speakerId
    };
}

//检查现有的历史记录文件
async function CheckSessionFile(session, config) {
    const channelId = encodeURIComponent(session.channelId.toString().replace(/-/g, ''));
    const userId = encodeURIComponent(session.userId.toString());
    const files = fs.readdirSync(`${__dirname}/sessionData/`);
    let prefixPattern = new RegExp(`^${channelId}-${userId}`);

    for (let file of files) {
        if (prefixPattern.test(file)) {
            //排除state文件
            if (!file.endsWith('state.json')) {
                return file;
            }
        }
    }
    return "";
}

//自动选择人设
async function selectCharacter(session, config, autocharactername) {
    if (config.select_character_notice) {
        await session.send('未检测到对应历史记录文件，已自动选择人设。');
    }
    await session.execute(`knj.load ${autocharactername}`);
}

//创建历史记录
function createHistory(id) {
    let safeId = encodeURIComponent(id);
    fs.writeFileSync(`${__dirname}/sessionData/${safeId}.json`, JSON.stringify([]));
}

//创建状态记录
function createState(id) {
    let safeId = encodeURIComponent(id);
    fs.writeFileSync(`${__dirname}/sessionData/${safeId}-state.json`, JSON.stringify({}));
}

//创长期记忆记录
function createMemory(id) {
    let safeId = encodeURIComponent(id);
    fs.writeFileSync(`${__dirname}/longtermmemory/${safeId}-memory.json`, JSON.stringify({}));
}

//读取并写入基础状态
function writeBaseState(id, character ,time) {
    let safeId = encodeURIComponent(id);
    let filePath = path.join(__dirname, 'sessionData', `${safeId}-state.json`);
    let statefilePath = path.join(__dirname, 'characters', `${character}-state.json`);
    //读取
    const statedata = JSON.parse(fs.readFileSync(statefilePath, 'utf-8'));
    //写入基础信息
    let stateData = {
        [time]: {
            time: time,
            favorability: statedata.favorability,
            relationship: statedata.relationship,
            emotion: statedata.emotion,
            clothes: statedata.clothes,
            location: statedata.location
        }
    };
    fs.writeFileSync(filePath, JSON.stringify(stateData, null, 2), 'utf-8');
}

//保存历史记录
function saveHistory(id, history) {
    let safeId = encodeURIComponent(id);
    let filteredHistory = history.filter(message => message !== "");
    fs.writeFileSync(path.join(__dirname, 'sessionData', `${safeId}.json`), JSON.stringify(filteredHistory));
}

//读取图片url
async function extractImageSrc(config, htmlString) {
    const regex = /<img\s+src="([^"]+)"/ig;
    let matches;
    const imgSrcs = [];
    if (!config.visual_module) {
        return [];
    }
    while ((matches = regex.exec(htmlString)) !== null) {
        let imgSrc = matches[1];
        imgSrc = imgSrc.replace(/&amp;/g, "&");
        imgSrcs.push(imgSrc);
    }
    return imgSrcs;
}

//获得不同配置的图像解析
async function ImgRequest(config, task_type, base64Image) {
    const customRequest = {
        "prompt": task_type,
        "task_type": task_type,
        "file_or_url": base64Image
    };
    let url = config.visual_url;
    if (!url.endsWith('/generate/')) {
        if (url.endsWith('/generate')) {
            url += '/';
        } else {
            url = url.replace(/\/$/, '') + '/generate/';
        }
    }
    let response = await axios.post(url, customRequest);
    if (task_type !== '<OD>') {
        return response.data[task_type]
    } else {
        return response.data[task_type].labels.join(', ')
    }
}

//获得文本语意向量
async function EmbRequest(config, text) {
    const customRequest = {
        "text": text
    };
    let url = config.emb_url;
    if (!url.endsWith('/embed/')) {
        if (url.endsWith('/embed')) {
            url += '/';
        } else {
            url = url.replace(/\/$/, '') + '/embed/';
        }
    }
    let response = await axios.post(url, customRequest);
    return response.data
}

//单次图片识别
async function SingleImageProcess(ctx, config, session, imgSrc, type) {
    let base64Image = '';
    let downloadSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await ctx.http.file(imgSrc);
            base64Image = (0, koishi_1.arrayBufferToBase64)(response.data);
            downloadSuccess = true;
            break;
        }
        catch (error) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    if (!downloadSuccess) {
        await session.send('下载图片失败，请重试。');
        return;
    }
    if (type == 'standard') {
        let MORE_DETAILED_CAPTION = await ImgRequest(config, '<MORE_DETAILED_CAPTION>', base64Image);
        let OD = await ImgRequest(config, '<OD>', base64Image);
        let output = [MORE_DETAILED_CAPTION, OD];
        return output
    } else {
        let Data = await ImgRequest(config, type, base64Image);
        return Data
    }
}

//多次图片识别
async function ImagesProcess(ctx, config, session, imgSrcs) {
    const results = [];

    for (let i = 0; i < imgSrcs.length; i++) {
        const imgSrc = imgSrcs[i];
        const result = await SingleImageProcess(ctx, config, session, imgSrc, 'standard');
        if (result) {
            results.push(`这里是图片${i + 1}内的物体: ${result[0]}.\n这里是对图片${i + 1}内物体的描述：${result[1]}`);
        } else {
            results.push(`图片${i + 1}处理失败。`);
        }
    }
    const results_prompt = results.join('\n')
    if (config.visual_debug) {
        await session.send(results_prompt)
    }
    return results_prompt
}

//保存长期记忆
function saveMemory(id, archives, tags, tags_vector, archives_vector) {
    let time = getTime()
    let safeId = encodeURIComponent(id);
    let filePath = path.join(__dirname, 'longtermmemory', `${safeId}-memory.json`);

    let existingData = fs.readFileSync(filePath, 'utf-8');
    let Data = JSON.parse(existingData);
    Data[time] = {
        time: time,
        tags: tags,
        tags_vector: tags_vector,
        archives: archives,
        archives_vector: archives_vector
    };
    fs.writeFileSync(filePath, JSON.stringify(Data, null, 2));
}

//保存状态记录
function saveState(id, time, NewstateData, IntentionJudge, InternalThinking,Action) {
    let safeId = encodeURIComponent(id);
    let filePath = path.join(__dirname, 'sessionData', `${safeId}-state.json`);

    let existingData = fs.readFileSync(filePath, 'utf-8');
    let stateData = JSON.parse(existingData);
    stateData[time] = {
        time: time,
        favorability: `${NewstateData.好感度}`,
        relationship: `${NewstateData.与对话者的关系}`,
        emotion: `${NewstateData.心情}`,
        clothes: `${NewstateData.穿着}`,
        location: `${NewstateData.位置}`,
        IntentionJudge: IntentionJudge,
        InternalThinking: InternalThinking,
        Action: Action
    };
    fs.writeFileSync(filePath, JSON.stringify(stateData, null, 2));
}

// 删除最新的状态记录
function deleteLatestState(id) {
    let safeId = encodeURIComponent(id);
    let filePath = path.join(__dirname, 'sessionData', `${safeId}-state.json`);

    if (fs.existsSync(filePath)) {
        let existingData = fs.readFileSync(filePath, 'utf-8');
        let stateData = JSON.parse(existingData);

        // 获取所有键
        let keys = Object.keys(stateData);
        if (keys.length === 0) {
            console.log("No data to delete");
            return;
        }
        let lastKey = keys[keys.length - 1];

        // 删除最后一个状态记录
        delete stateData[lastKey];
        fs.writeFileSync(filePath, JSON.stringify(stateData, null, 2));
        console.log("Latest state deleted successfully");
    } else {
        console.log("State file does not exist");
    }
}

//检查人设是否存在
function checkCharacter(characterName, folder) {
    return fs.existsSync(`${__dirname}/${folder}/${characterName}.json`);
}

//获取人设
function getCharacter(characterName, folder) {
    if (checkCharacter(characterName, folder)) {
        let characterObj = JSON.parse(fs.readFileSync(path.join(__dirname, `${folder}`, `${characterName}.json`)));
        return characterObj;
    } else {
        return null;
    }
}

//获取历史记录
function getHistory(id) {
    let safeId = encodeURIComponent(id);
    let filePath = path.join(__dirname, 'sessionData', `${safeId}.json`);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath);
        if (content.length > 0) {
            return JSON.parse(content);
        } else {
            return [];
        }
    } else {
        return null;
    }
}

//获取最新状态记录
function getState(id) {
    let safeId = encodeURIComponent(id);
    let filePath = path.join(__dirname, 'sessionData', `${safeId}-state.json`);
    if (fs.existsSync(filePath)) {
        let stateData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        let latestTime = Object.keys(stateData).sort().pop();
        return stateData[latestTime];
    } else {
        return null;
    }
}

// 获取全部状态记录
function getAllStates(id) {
    let safeId = encodeURIComponent(id);
    let filePath = path.join(__dirname, 'sessionData', `${safeId}-state.json`);
    if (fs.existsSync(filePath)) {
        let stateData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return stateData;
    } else {
        return null;
    }
}

//获取原始state数据
function getOriginStates(character) {
    let filePath = path.join(__dirname, 'characters', `${character}-state.json`);
    if (fs.existsSync(filePath)) {
        let stateData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return stateData;
    } else {
        return null;
    }
}

//获取长期记忆
async function readMemory(id) {
    let safeId = encodeURIComponent(id);
    let filePath = path.join(__dirname, 'longtermmemory', `${safeId}-memory.json`);
    if (fs.existsSync(filePath)) {
        let MemoryData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return MemoryData;
    } else {
        return null;
    }
}

//获取包含时间信息的历史记录
function getTimeHistory(id) {
    let history = getHistory(id);
    let stateData = getAllStates(id)
    // 获取时间戳对象中的键（按顺序）
    const timestampKeys = Object.keys(stateData);
    const lastTimestampKeys = timestampKeys.slice(-history.length/2);

    let timestampIndex = 0; // 初始化时间戳索引

    // 遍历对话数组
    history.forEach((message) => {
        // 检查角色是否是 assistant 并且有未使用的时间戳
        if (message.role === 'assistant' && timestampIndex < lastTimestampKeys.length) {
            const timestamp = stateData[lastTimestampKeys[timestampIndex]].time;
            // 在 content 开头插入时间戳
            message.content = `消息记录时间：${timestamp}\n以下是我根据以上分析做出的回答：\n ${message.content}`;
            // 更新时间戳索引
            timestampIndex++;
        }
    });

    return history;
}

//计算余弦相似度
function cosineSimilarity(vec1, vec2) {
    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitude1 * magnitude2);
}

// 计算加权相似度
function weightedSimilarity(tagsVector, archivesVector, vector1, vector2) {
    const tagsSimilarity = cosineSimilarity(tagsVector, vector1);
    const archivesSimilarity = cosineSimilarity(archivesVector, vector2);
    return (tagsSimilarity + archivesSimilarity) / 2;
}

//读取时间
function getTime() {
    let now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;
    let date = now.getDate();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();
    month = month < 10 ? '0' + month : month;
    date = date < 10 ? '0' + date : date;
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;
    return year + '年' + month + '月' + date + '日' + hours + ':' + minutes + ':' + seconds;
}

//设置闹钟
function setAlarm(id, time, callback) {
    if (alarms.has(id)) {
        console.error(`Alarm with id ${id} already exists.`);
        return;
    }

    const now = new Date();
    const normalizedTime = time.replace('：', ':');
    const timeParts = normalizedTime.split(':');

    if (timeParts.length !== 2) {
        console.error('Invalid time format. Please use HH:MM format.');
        return;
    }

    const [hour, minute] = timeParts.map(Number);

    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        console.error('Invalid time format. Please use HH:MM format with valid hour and minute.');
        return;
    }

    const alarmTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);

    if (alarmTime <= now) {
        alarmTime.setDate(alarmTime.getDate() + 1);
    }

    const timeDifference = alarmTime - now;

    const timerId = setTimeout(async () => {
        await callback();
        alarms.delete(id);
    }, timeDifference);

    alarms.set(id, timerId);
    console.log(`Alarm with id ${id} set for ${alarmTime}.`);
}

//取消闹钟
function cancelAlarm(id) {
    if (alarms.has(id)) {
        clearTimeout(alarms.get(id));
        alarms.delete(id);
        console.log(`Alarm with id ${id} has been cancelled.`);
    } else {
        console.error(`No alarm found with id ${id}.`);
    }
}

//取消用户所有闹钟
function cancelUserAlarms(sessionId) {
    const alarmsToDelete = [];
    for (let [id, timerId] of alarms.entries()) {
        if (id.startsWith(sessionId + '-')) {
            clearTimeout(timerId);
            alarmsToDelete.push(id);
        }
    }
        for (let id of alarmsToDelete) {
        alarms.delete(id);
    }
}

//转化对话记录
function formatDialogue(dialogue, NameA, NameB) {
    let result = '';
    for (let i = 0; i < dialogue.length; i++) {
        if (dialogue[i].role === 'user') {
            result += `${NameA}:` + dialogue[i].content + '\n';
        } else if (dialogue[i].role === 'assistant') {
            result += `${NameB}:` + dialogue[i].content + '\n';
        }
    }
    return result;
}


//分析意图
async function IntentionJudge(config, session, message, history, NameA, NameB) {
    let character = getCharacter('IntentionJudge', 'buildincharacters');
    //准备内容
    let Inthistory = history.concat({ "role": "user", "content": message });
    // 限制长度
    if (Inthistory.length > 7) {
        Inthistory = Inthistory.slice(-7);
    }

    let dialogue = formatDialogue(Inthistory, NameA, NameB);
    character.push({ "role": "user", "content": `请你判断对话的意图，然后将其尽可能以简洁干练的语言进行总结。这里是你需要判断意图的文本：\n` + dialogue });

    // 准备request
    const customRequest = {
        "messages": character,
        "temperature": 0.6,
        "max_tokens": 150,
    };
    //post request
    let response = await createRequest(config, session, customRequest)
    let output = response.data.choices[0].message.content.replace(/\n\s*\n/g, '\n');
    return output
}

//Emoji判断
async function EmojiJudge(message, message2, config, session, characterName) {
    let Raw_character = getCharacter('EmojiJudge', 'buildincharacters');
    let Emoji_Names = config.Emoji_Names.map(item => `[${item}]`).join(',');
    const character = Raw_character.map(item => {
        return {
            ...item,
            content: item.content.replace(/%Emoji_Names/g, Emoji_Names)
        };
    });
    let usermessage = { "role": "user", "content": message };
    let assistantmessage = { "role": "assistant", "content": message2 };
    let Inthistory = [usermessage].concat(assistantmessage);

    let dialogue = formatDialogue(Inthistory, 'A', 'B');
    character.push({ "role": "user", "content": `请你判断对话的情感基调，然后判断是否需要为B配一张表情包。这里是你需要判断的对话：\n` + dialogue });

    // 准备request
    const customRequest = {
        "messages": character,
        "temperature": 0.4,
        "max_tokens": 50,
        "stop": ["\n"],
    };
    //post request
    let response = await createRequest(config, session, customRequest)
    let output = response.data.choices[0].message.content.replace(/\n\s*\n/g, '');
    let regex = /\[(.*?)\]/g;
    let match = regex.exec(output);

    if (match[1] !== "None") {
        let basePath = config.Emoji_Path ? config.Emoji_Path.replace(/\\/g, '/') + `/特蕾西娅` : path.resolve(__dirname, 'Emoji/特蕾西娅');
        if (config.Emoji_alone) {
            basePath = config.Emoji_Path ? config.Emoji_Path.replace(/\\/g, '/') + `/${characterName}` : path.resolve(__dirname, `Emoji/${characterName}`);
            if (!fs.existsSync(basePath)) {
                session.send(`路径不存在，请手动创建表情包: Emoji/${characterName}`)
                return
            }
        }
        const filePath = path.resolve(basePath, `${match[1]}.png`);
        // 检查文件是否存在
        if (fs.existsSync(filePath)) {
            const fileURL = `file://${filePath.replace(/\\/g, '/')}`;
            await session.send(`<img src="${fileURL}"/>`);
            if (config.Emoji_reply) {
                await session.send(match[1])
            }
        } else {
            await session.send(`${match[1]}.png图片文件不存在。`);
        }
    } else {
        return
    }
}

// 修复引号和逗号的函数
function fixJSONFormat(str) {
    str = str.trim();
    str = str.replace(/:\s*([a-zA-Z0-9_$]+)/g, ': "$1"');
    str = str.replace(/"\s*([^"]+?)\n/g, '"$1",\n');
    str = str.replace(/"([^"]+?)""/g, '"$1"');
    str = str.replace(/([a-zA-Z0-9_$"])\n\s*([a-zA-Z0-9_$"])/g, '$1,\n$2');
    str = str.replace(/,\s*([}\]])/g, '$1');

    return str;
}

// 检查好感度格式
function isValidFavorability(value) {
    if (/^\d+\/\d+$/.test(value)) {
        let [numerator, denominator] = value.split('/');
        if (parseInt(numerator) > parseInt(denominator)) {
            denominator = parseInt(denominator) + 100;
            return `${numerator}/${denominator}`;
        }
        return true;
    }
    return false;
}

//修改好感度
function updateFavorability(jsonStr) {
    let jsonObject;
    try {
        jsonObject = JSON.parse(jsonStr);
    } catch (error) {
        return jsonStr;
    }

    if (jsonObject.hasOwnProperty("好感度") && typeof jsonObject["好感度"] === 'string') {
        let result = isValidFavorability(jsonObject["好感度"]);
        if (result !== true) {
            jsonObject["好感度"] = result;
        }
    }

    return JSON.stringify(jsonObject);
}

// 检查值是否包含中文字符且长度不小于2的函数
function isValidChinese(value) {
    return /[\u4e00-\u9fa5]/.test(value) && value.length >= 2;
}

// 修复并重新组装的函数
function fixJSONFormatWithOrder(str,OldstateData) {
    // 先尝试修复引号和逗号
    str = fixJSONFormat(str);

    // 尝试解析修复后的字符串，如果成功则返回修复后的字符串
    try {
        JSON.parse(str);
        return str;
    } catch (error) {
        // 如果解析失败，继续下面的处理
    }

    // 拆分成行
    let lines = str.split('\n');

    // 预期的键值对顺序
    const expectedKeys = ["穿着", "位置", "心情", "好感度", "与对话者的关系"];
    const oldstateKeys = ["clothes", "location", "emotion", "favorability", "relationship"];
    let fixedLines = [];

    // 处理每一行，确保每行只有一个键值对，并且按预期顺序排列
    for (let i = 0; i < expectedKeys.length; i++) {
        let key = expectedKeys[i];
        let oldStateKey = oldstateKeys[i];
        let found = false;
        for (let line of lines) {
            let regex = new RegExp(`"${key}":\\s*"([^"]*)"`, 'g');
            let match = regex.exec(line);
            if (match) {
                let value = match[1];
                if ((key === "好感度" && !isValidFavorability(value)) ||
                    (["穿着", "位置", "心情", "与对话者的关系"].includes(key) && !isValidChinese(value))) {
                    value = OldstateData[oldStateKey]; // 使用 OldstateData 的默认值
                }
                fixedLines.push(`"${key}": "${value}"`);
                found = true;
                break;
            }
        }
        if (!found) {
            // 如果没有找到对应的键，添加 OldstateData
            fixedLines.push(`"${key}": "${OldstateData[oldStateKey]}"`);
        }
    }

    // 组装成 JSON 字符串
    let fixedStr = `{\n    ${fixedLines.join(',\n    ')}\n}`;

    return fixedStr;
}

//状态栏计算
async function status_bar(character, history, message, userName, IntJudge, IntThink, OldstateData, config, session, summarize,Action) {

    let prompt = `${summarize}
当前穿着：${OldstateData.clothes}
当前位置：${OldstateData.location}
当前心情：${OldstateData.emotion}
当前好感度：${OldstateData.favorability}
与对话者的关系：${OldstateData.relationship}
对历史记录的分析:
${IntJudge}
以下是我看到消息后的内心思考:
${IntThink}
以下是我看到消息后做出的动作：
${Action}
以下是我在看到消息前，输出的标准json格式数值(好感度最高每次增减5)：
{
    "穿着": "${OldstateData.clothes}",
    "位置": "${OldstateData.location}",
    "心情": "${OldstateData.emotion}",
    "好感度": "${OldstateData.favorability}",
    "与对话者的关系": "${OldstateData.relationship}"
}
以下是我在看到消息后，输出的标准json格式数值(好感度最高每次增减5)：
`
    let Inthistory = history.concat({ "role": "user", "content": message });
    let input = character.concat(Inthistory);
    input.push({ "role": "assistant", "content": prompt }); 
    // 准备request
    const customRequest = {
        "messages": input,
        "temperature": 0.7,
        "continue_": true,
        "stop": ["}"],
        "max_tokens": 200,
    };
    //post request
    let response = await createRequest(config, session, customRequest);
    let output = response.data.choices[0].message.content.replace(/\n\s*\n/g, '\n');
    let result = output.split(`以下是我在看到消息后，输出的标准json格式数值(好感度最高每次增减5)`)[1];
    //尝试修复
    let fixedresult = fixJSONFormatWithOrder(result + '}', OldstateData);
    let newfixedresult = updateFavorability(fixedresult)
    let results = JSON.parse(newfixedresult);
    if (config.show_state_bar) {
        let formattedResult = `状态栏:
| 穿着: ${results["穿着"]} |
| 位置: ${results["位置"]} |
| 心情: ${results["心情"]} |
| 好感度: ${results["好感度"]} |
| 与对话者的关系: ${results["与对话者的关系"]} |`
        await session.send(`${formattedResult}`)
    }
    return results
}



//内心思考
async function InternalThinking(character, history, message, IntJudge, session, config, OldstateData, summarize) {
    //获取相关参数
    const Time = getTime();

    //组合上下文
    let Inthistory = history.concat({ "role": "user", "content": message });

    // 限制长度
    if (Inthistory.length > 7) {
        Inthistory = Inthistory.slice(-7);
    }

    let fullinput = character.concat(Inthistory);

    let Think = `${summarize}
当前时间：${Time}
当前穿着：${OldstateData.clothes}
当前位置：${OldstateData.location}
当前心情：${OldstateData.emotion}
当前好感度：${OldstateData.favorability}
与对话者的关系：${OldstateData.relationship}
对历史记录的分析：
${IntJudge}
以下是我看到消息后的内心思考(内心思考为一整个段落没有换行)：
我思考了一下，`;

    fullinput.push({ "role": "assistant", "content": Think });

    // 准备request
    const customRequest = {
        "messages": fullinput,
        "continue_": true,
        "stop": ["以下是","：",":","\n"],
        "max_tokens": 200,
    };
    //post request
    let response = await createRequest(config, session, customRequest);
    let output = response.data.choices[0].message.content.replace(/\n\s*\n/g, '\n');

    let sendoutput = output.split(`以下是我看到消息后的内心思考(内心思考为一整个段落没有换行)：\n`)[1];
    if (config.InternalThinking) {
        await session.send(`内心思想：\n${sendoutput}`)
    }

    return sendoutput
}

//动作计算
async function action(character, history, message, IntJudge, IntThink, session, config, OldstateData, summarize, characterName) {
    //获取相关参数
    const Time = getTime();

    //组合上下文
    const Inthistory = history.concat({ "role": "user", "content": message });
    let fullinput = character.concat(Inthistory);

    let Think = `${summarize}
当前时间：${Time}
当前穿着：${OldstateData.clothes}
当前位置：${OldstateData.location}
当前心情：${OldstateData.emotion}
当前好感度：${OldstateData.favorability}
与对话者的关系：${OldstateData.relationship}
对历史记录的分析：
${IntJudge}
以下是我看到消息后的内心思考：
${IntThink}
于是我看到消息后做了如下动作(只有我自己的身体动作情况，且动作描写为一整个段落没有换行，例如：${characterName}调整了一下坐姿，拿起手机，发送了一条消息。或是抬起头直接对着某人说话。)：
${characterName}`;

    fullinput.push({ "role": "assistant", "content": Think });

    // 准备request
    const customRequest = {
        "messages": fullinput,
        "continue_": true,
        "stop": ["以下是", "：", ":", "\n"],
        "max_tokens": 100,
    };
    //post request
    let response = await createRequest(config, session, customRequest);
    let output = response.data.choices[0].message.content.replace(/\n\s*\n/g, '\n');

    let sendoutput = output.split(`于是我看到消息后做了如下动作(只有我自己的身体动作情况，且动作描写为一整个段落没有换行，例如：${characterName}调整了一下坐姿，拿起手机，发送了一条消息。或是抬起头直接对着某人说话。)：\n`)[1];
    if (config.show_Action) {
        await session.send(`动作：\n${sendoutput}`)
    }

    return sendoutput
}

//闲置高活跃
async function recall(character, sessionId, speakerId, history, session, config, ctx, OldstateData, message, userName, summarize, characterName) {
    const Time = getTime();
    const pastminutes = millisecondsToMinutes(config.Short_term_active)
    let remind = `以下是系统消息，并非用户发出的信息：
当前时间：${Time}
距离上一次交流已经过去了${pastminutes}分钟。
${userName}并未发送任何信息
请你输出你的内心思考`
    let remind2 = `${summarize}
当前穿着：${OldstateData.clothes}
当前位置：${OldstateData.location}
当前心情：${OldstateData.emotion}
当前好感度：${OldstateData.favorability}
与对话者的关系：${OldstateData.relationship}
以下是我看到消息后的内心思考(内心思考为一整个段落没有换行)：
我`
    let fullinput = character.concat(history);
    fullinput.push({ "role": "user", "content": remind })
    fullinput.push({ "role": "assistant", "content": remind2 })
    //准备request
    const customRequest = {
        "messages": fullinput,
        "continue_": true,
        "stop": ["以下是", "：", ":", "\n"],
        "max_tokens": 200,
    };
    //post request
    let response = await createRequest(config, session, customRequest);
    let output = response.data.choices[0].message.content.replace(/\n\s*\n/g, '\n');

    let sendoutput = output.split(`以下是我看到消息后的内心思考(内心思考为一整个段落没有换行)：`)[1];
    if (config.InternalThinking) {
        await session.send(`内心思想：${sendoutput}`);
    }
    //计算状态栏
    let NewstateData = await status_bar(character, history, remind, userName, '无意图', sendoutput, OldstateData, config, session, '无动作');

    //重组状态栏
    let remind3 = `${summarize}
当前穿着：${NewstateData.穿着}
当前位置：${NewstateData.位置}
当前心情：${NewstateData.心情}
当前好感度：${NewstateData.好感度}
与对话者的关系：${NewstateData.与对话者的关系}
以下是我看到消息后的内心思考：
${sendoutput}
是否需要主动开启对话(是或否)？
回答`

    let fullinput2 = character.concat(history);
    fullinput2.push({ "role": "user", "content": remind })
    fullinput2.push({ "role": "assistant", "content": remind3 })
    //准备request
    const customRequest2 = {
        "messages": fullinput2,
        "continue_": true,
        "temperature": 0.4,
        "stop": ["以下是", "\n"],
        "max_tokens": 20,
    };
    //post request
    let response2 = await createRequest(config, session, customRequest2);
    let output2 = response2.data.choices[0].message.content.replace(/\n\s*\n/g, '\n');
    let sendoutput2 = output2.split(`是否需要主动开启对话(是或否)？`)[1];

    if (config.IntentionJudge) {
        await session.send(`是否主动？${sendoutput2}`);
    }

    if (sendoutput2.includes("是")) {

        //计算动作
        let Action = await action(character, history, remind, '无意图', sendoutput, session, config, OldstateData, summarize, characterName)

        let selectTrue = `${summarize}
当前穿着：${NewstateData.clothes}
当前位置：${NewstateData.location}
当前心情：${NewstateData.emotion}
当前好感度：${NewstateData.favorability}
与对话者的关系：${NewstateData.relationship}
以下是我看到消息后的内心思考：
${sendoutput}
以下是我看到消息后做出的动作：
${Action}
以下是我选择使用的开启对话的询问：
`
        fullinput.pop();
        fullinput.push({ "role": "assistant", "content": selectTrue });
        //准备request
        const customRequest3 = {
            "messages": fullinput,
            "continue_": true,
            "max_tokens": 200,
        };
        //post request
        let response3 = await createRequest(config, session, customRequest3);
        let output3 = response3.data.choices[0].message.content.replace(/\n\s*\n/g, '\n');

        //发送开始对话
        let sendoutput3 = output3.split(`以下是我选择使用的开启对话的询问：\n`)[1];
        //删除干扰
        sendoutput3 = sendoutput3.replace(/[：:“”‘’"\n\\]/g, '');
        //发送回复
        await handleOutput(session, sendoutput3, config, ctx, speakerId);

        //历史记录更新
        let Newhistory = getHistory(sessionId);
        Newhistory.push({ "role": "user", "content": `以下是系统消息，并非用户发出的信息：\n距离上一次交流已经过去了${pastminutes}分钟，用户并未发送任何信息。` });
        Newhistory.push({ "role": "assistant", "content": `以下是我的心里活动：` + sendoutput + `以下是我选择使用的开启对话的询问：` + sendoutput3 });
        saveHistory(sessionId, Newhistory);
        saveState(sessionId, Time, NewstateData, '无意图', sendoutput, Action);
    } else {
        if (userTimers.has(sessionId)) {
            const { stopTimer } = userTimers.get(sessionId);
            stopTimer();  // 停止之前的计时器
        }
        //历史记录更新
        let Newhistory = getHistory(sessionId);
        Newhistory.push({ "role": "user", "content": `以下是系统消息，并非用户发出的信息：\n距离上一次交流已经过去了${pastminutes}分钟，用户并未发送任何信息。` });
        Newhistory.push({ "role": "assistant", "content": `以下是我的心里活动：` + sendoutput + `我并没有发送消息来尝试开启对话。` });
        saveHistory(sessionId, Newhistory);
        saveState(sessionId, Time, NewstateData, '无意图', sendoutput, '无动作');
    }
}

//闹钟recall
async function Alarmrecall(character, sessionId, speakerId, history, session, config, ctx, OldstateData, message, userName, summarize, characterName) {
    const Time = getTime();
    let remind = `以下是系统消息，并非用户发出的信息：
当前时间：${Time}
预定的提醒时间到了
${userName}并未发送任何信息
请你输出你的内心思考`
    let remind2 = `${summarize}
当前穿着：${OldstateData.clothes}
当前位置：${OldstateData.location}
当前心情：${OldstateData.emotion}
当前好感度：${OldstateData.favorability}
与对话者的关系：${OldstateData.relationship}
以下是我看到消息后的内心思考(内心思考为一整个段落没有换行)：
我应该提醒`
    let fullinput = character.concat(history);
    fullinput.push({ "role": "user", "content": remind })
    fullinput.push({ "role": "assistant", "content": remind2 })
    //准备request
    const customRequest = {
        "messages": fullinput,
        "continue_": true,
        "stop": ["以下是", "：", ":", "\n"],
        "max_tokens": 200,
    };
    //post request
    let response = await createRequest(config, session, customRequest);
    let output = response.data.choices[0].message.content.replace(/\n\s*\n/g, '\n');
    let sendoutput = output.split(`以下是我看到消息后的内心思考(内心思考为一整个段落没有换行)：`)[1];

    if (config.InternalThinking) {
        await session.send(`内心思想：${sendoutput}`);
    }
    //计算状态栏
    let NewstateData = await status_bar(character, history, remind, userName, '预定的提醒时间到了', sendoutput, OldstateData, config, session);

    //计算动作
    let Action = await action(character, history, remind, '预定的提醒时间到了', sendoutput, session, config, OldstateData, summarize, characterName,'无动作')

    let selectTrue = `${summarize}
当前穿着：${NewstateData.穿着}
当前位置：${NewstateData.位置}
当前心情：${NewstateData.心情}
当前好感度：${NewstateData.好感度}
与对话者的关系：${NewstateData.与对话者的关系}
以下是我看到消息后的内心思考：
${sendoutput}
以下是我看到消息后做出的动作：
${Action}
以下是我选择使用提醒${userName}时间到了的回答：
时间`
    fullinput.pop();
    fullinput.push({ "role": "assistant", "content": selectTrue });
    //准备request
    const customRequest3 = {
        "messages": fullinput,
        "continue_": true,
        "max_tokens": 200,
    };
    //post request
    let response3 = await createRequest(config, session, customRequest3);
    let output3 = response3.data.choices[0].message.content.replace(/\n\s*\n/g, '\n');

    //发送开始对话
    let sendoutput3 = output3.split(`以下是我选择使用提醒${userName}时间到了的回答：\n`)[1];
    //删除干扰
    sendoutput3 = sendoutput3.replace(/[：:“”‘’"\n\\]/g, '');
    //发送回复
    await handleOutput(session, sendoutput3, config, ctx, speakerId);

    //历史记录更新
    let Newhistory = getHistory(sessionId);
    Newhistory.push({ "role": "user", "content": `以下是系统消息，并非用户发出的信息：\n当前时间：${Time}，预定的提醒时间到了，用户并未发送任何信息。` });
    Newhistory.push({ "role": "assistant", "content": `以下是我的心里活动：` + sendoutput + `以下是我选择使用的开启对话的询问：` + sendoutput3 });
    saveHistory(sessionId, Newhistory);
    saveState(sessionId, Time, NewstateData, '无意图', sendoutput, Action);
}


//5分钟闲置高活跃
async function FiveRecall(ctx, delay, character, sessionId, speakerId, history, session, config, maxCount, OldstateData, message, userName, summarize, characterName) {
    let recallCount = 0;   // 重置计数器
    const interval = ctx.setInterval(() => {
        recallCount++;
        recall(character, sessionId, speakerId, history, session, config, ctx, OldstateData, message, userName, summarize, characterName);
        if (recallCount >= maxCount) {
            interval();  // 停止计时器
            userTimers.delete(sessionId); 
            console.log("闲置时间过长，停止活跃循环");
        }
    }, delay);

    // 返回一个函数，用于停止计时器
    return function stopInterval() {
        interval();
        userTimers.delete(sessionId);  // 从 Map 中删除该用户的计时器
    };
}

//工具调用
async function ToolMessage(ctx, config, session, message, IntThink, Action, character, sessionId, speakerId, history, OldstateData, userName, summarize, characterName) {
    let Time = getTime();
    let timeWithoutSeconds = Time.replace(/:\d{2}$/, '');
    let UseTool = getCharacter('Tools', 'buildincharacters');
    const Message = `这里是你需要判断B的意图，并决定工具调用的文本：
当前时间：${timeWithoutSeconds}
A说的话：${message}
B的内心思考：${IntThink}
B的内心思考：${Action}`;
    UseTool.push({ "role": "user", "content": Message });
    //准备request
    const customRequest = {
        "messages": UseTool,
        "temperature": 0.3,
        "max_tokens": 50,
        "stop": ["\n"],
    };
    //post request
    let response = await createRequest(config, session, customRequest);
    let Tool_use = response.data.choices[0].message.content;
    if (config.UseTool_reply) {
        await session.send(Tool_use);
    }

    //解析
    const regex = /\[([^\]=]+)(?:=([^\]]+))?\]/g;
    let match;
    let Tools = {};
    while ((match = regex.exec(Tool_use)) !== null) {
        let key = match[1];
        let value = match[2] !== undefined ? match[2] : key;
        Tools[key] = value;
    }

    //准备
    let Weather_info = '';
    let Search_info = '';
    let Alarm_Clock = '';

    //调用
    if (Tools.Weather) {
        const cityName = Tools.Weather;
        const weather = await getWeather(ctx, session, config, cityName);
        Weather_info = `调用天气工具获得的${cityName}天气为：\n` + weather;
    }

    if (Tools.Search) {
        const keywords = config.search_keywords;
        const dangerous_keywords = config.dangerous_search_keywords;
        const question = Tools.Search;
        //包涵keywords
        if (keywords.some(keyword => message.includes(keyword))) {
            //屏蔽词
            if (dangerous_keywords !== '' &&dangerous_keywords.some(keyword => question.includes(keyword))) {
                await session.send(`检索问题包含禁止项目，请重新考虑提问方式！搜索已禁用！`);
                Search_info = `检索问题包含禁止项目，请重新考虑提问方式！搜索已禁用！`;
            } else {
                const search = await searchWeb(ctx, session, config, question);
                Search_info = `调用搜索引擎检索："${question}"\n获得如下参考与相关链接：\n${search}`;
            }
        }
    }

    if (Tools.Set_Alarm_Clock) {
        const id = sessionId + '-' + Tools.Set_Alarm_Clock;
        setAlarm(id, Tools.Set_Alarm_Clock, () => {
            Alarmrecall(character, sessionId, speakerId, history, session, config, ctx, OldstateData, message, userName, summarize, characterName);
        });
        Alarm_Clock = `设定了${Tools.Set_Alarm_Clock}的闹钟`
    }

    if (Tools.Del_Alarm_Clock) {
        const id = sessionId + '-' + Tools.Del_Alarm_Clock;
        cancelAlarm(id)
        Alarm_Clock = `删除了${Tools.Set_Alarm_Clock}的闹钟`
    }

    if (Tools.Del_All_Alarm_Clock) {
        cancelUserAlarms(sessionId)
        Alarm_Clock = `删除了所有闹钟`
    }

    //组成prompt
    let combinedInfo = '';
    if (Weather_info !== '') {
        combinedInfo += Weather_info + '\n';
    }
    if (Search_info !== '') {
        combinedInfo += Search_info + '\n';
    }
    if (Alarm_Clock !== '') {
        combinedInfo += Alarm_Clock + '\n';
    }
    combinedInfo = combinedInfo.trim();
    if (combinedInfo.length === 0) {
        combinedInfo = "无";
    }

    if (config.UseTool_fullreply && combinedInfo !== "无") {
        await session.send(`工具返回消息:${combinedInfo}`);
    }
    return combinedInfo
}

//读取城市id
function loadCityIds(filePath) {
    const cityIdMap = {};
    const data = fs.readFileSync(filePath, 'utf-8');
    const lines = data.split('\n');

    lines.forEach(line => {
        const [id, city] = line.split('=');
        if (id && city) {
            cityIdMap[city.trim()] = id.trim();
        }
    });

    return cityIdMap;
}

//读取天气
async function getWeather(ctx, session, config, cityName) {
    const cityIdMap = loadCityIds(path.join(__dirname, 'Tools', 'cityid.txt'));
    const cityId = cityIdMap[cityName];

    if (!cityId) {
        await session.send(`未找到城市 ${cityName} 的ID`);
        return `无法查询到${cityName}对应的城市id，天气工具调用失败。`;
    }
    try {
        const response = await ctx.http.get(`http://t.weather.itboy.net/api/weather/city/${cityId}`);
        if (response.status === 200) {
            const data = response;
            //天气数据
            const todayWeather = data.data;
            const cityInfo = data.cityInfo;
            const shidu = todayWeather.shidu;
            const pm25 = todayWeather.pm25;
            const pm10 = todayWeather.pm10;
            const quality = todayWeather.quality;
            const wendu = todayWeather.wendu;
            const ganmao = todayWeather.ganmao;
            return `天气查询结果：城市：${cityInfo.city}\n湿度：${shidu}\nPM2.5：${pm25}\nPM10：${pm10}\n空气质量：${quality}\n温度：${wendu}\n温馨提示：${ganmao}`;
        } else {
            if (config.UseTool_reply) {
                await session.send('天气工具调用失败，数据请求失败');
            }
            console.log('天气工具调用失败，数据请求失败');
            return '天气工具调用失败';
        }
    } catch (error) {
        if (config.UseTool_reply) {
            await session.send('API请求出错:' + error);
        }
        console.log('API请求出错:' + error);
        return '天气工具调用失败';
    }
}

//网页截图
async function captureScreenshot(ctx, url, options = {}) {
    const { selector, full, viewport, maxSize, loadTimeout = 30000, idleTimeout = 30000, proxy } = options;
    const page = await ctx.puppeteer.page();
    let loaded = false;
    page.on('load', () => loaded = true);

    try {
        if (proxy) {
            const agent = new HttpsProxyAgent.HttpsProxyAgent(proxy);
            await page.setRequestInterception(true);
            page.on('request', request => {
                request.continue({
                    agent
                });
            });
        }

        if (viewport) {
            const [width, height] = viewport.split('x').map(Number);
            await page.setViewport({ width, height });
        }

        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                return loaded
                    ? resolve()
                    : reject(new Error('navigation timeout'));
            }, loadTimeout);

            page.goto(url, {
                waitUntil: 'networkidle0',
                timeout: idleTimeout,
            }).then(() => {
                clearTimeout(timer);
                resolve();
            }).catch((error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
        if (selector) {
            await page.waitForSelector(selector, { timeout: idleTimeout });
        }
        const shooter = selector ? await page.$(selector) : page;
        if (!shooter) {
            console.error('找不到满足该选择器的元素', selector);
            throw new Error('Element not found.');
        }
        let buffer = await shooter.screenshot({ fullPage: full });
        if (buffer.byteLength > maxSize) {
            const data = pngjs.PNG.sync.read(buffer);
            const width = data.width;
            const height = Math.round(data.height * maxSize / buffer.byteLength);
            const png = new pngjs.PNG({ width, height });
            data.bitblt(png, 0, 0, width, height, 0, 0);
            buffer = pngjs.PNG.sync.write(png);
        }
        await page.close();
        return buffer;
    } catch (error) {
        console.error('截图失败:', error);
        await page.close();
        throw error;
    }
}

//取前三条链接
function getTopThreeResults($, results, question) {
    const searchResults = [];
    let Search_Count = 0;
    results.each((i, result) => {
        if (Search_Count >= 3) return false;
        const titleTag = $(result).find('h3');
        const urlTag = $(result).find('a');

        if (titleTag.length && urlTag.length) {
            const title = titleTag.text();
            const url = urlTag.attr('href');
            searchResults.push(`标题：${title} URL：${url}`);
            Search_Count++;
        } else {
            console.log(`缺少标题或URL链接地址: ${$(result).html()}`);
        }
    });
    return searchResults.join('\n');
}

//搜索并读取网页URL
async function searchWeb(ctx, session, config, question) {
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.104 Safari/537.36"
    };
    // 设置代理，默认Clash
    const proxy = config.Google_Proxy;
    const agent = new HttpsProxyAgent.HttpsProxyAgent(proxy);
    try {
        const response = await axios.get(`https://www.google.com/search?hl=zh-CN&q=${question}`, {
            headers,
            httpsAgent: agent
        });
        if (response.status !== 200) {
            console.log(response)
            throw new Error("无法连接到google");
        }
        const $ = cheerio.load(response.data);
        // 获取所有搜索结果
        const searchResults = [];
        const results = $('.tF2Cxc');

        if (results.length === 0) {
            console.log(`没有检索到相关内容:${response}`);
            return `没有检索到相关内容，检索条目:${question}`;
        }
        //找维基百科链接
        let wikipediaURL = null;
        results.each((i, result) => {
            const urlTag = $(result).find('a');
            if (urlTag.length) {
                const url = urlTag.attr('href');
                if (url.includes('zh.wikipedia.org')) {
                    wikipediaURL = url;
                    return false; //第一个维基百科
                }
            }
        });

        if (wikipediaURL) {
            try {
                const wikiResponse = await axios.get(wikipediaURL, {
                    headers,
                    httpsAgent: agent
                });
                if (wikiResponse.status !== 200) {
                    throw new Error("无法连接到维基百科");
                }
                const $wiki = cheerio.load(wikiResponse.data);
                const contentDiv = $wiki('div.mw-content-ltr.mw-parser-output');
                let firstParagraph = contentDiv.find('> p').first().text(); // 获取主目录下的第一个<p>
                //移除引用
                firstParagraph = firstParagraph.replace(/\[\d+\]/g, '');

                if (config.UseTool_Picture) {
                    //截图
                    try {
                        const buffer = await captureScreenshot(ctx, wikipediaURL, {
                            full: false,
                            viewport: '1024x768',
                            maxSize: 5000000,// 5MB
                            proxy: config.Google_Proxy
                        });
                        await session.send(koishi_1.h.image(buffer, 'image/png'));
                    } catch (error) {
                        console.error('截图失败:', error);
                    }
                }
                //返回具体简介
                return `维基百科简介：${firstParagraph}  来源链接：${wikipediaURL}`;
            } catch (error) {
                console.error('维基百科检索出错Error:', error);
                //返回前三条搜索结果
                return getTopThreeResults($, results, question);
            }
        } else {
            //返回前三条搜索结果
            return getTopThreeResults($, results, question);
        }

    } catch (error) {
        console.error('检索出错Error:', error);
        return `检索出错，无法连接到Google，检索条目:${question}`;
    }
}


//长期记忆
async function archive(archives, NameA, NameB, sessionId, config, session) {
    //总结记忆
    let character = getCharacter('memory', 'buildincharacters');

    let dialogue = formatDialogue(archives, NameA, NameB);
    character.push({ "role": "user", "content": dialogue });

    // 准备request
    const customRequest = {
        "messages": character,
        "temperature": 0.4,
        "max_tokens": 200,
    };
    //post request
    let response = await createRequest(config, session, customRequest);
    let output = response.data.choices[0].message.content.replace(/\n/g, '');

    //打标
    let character2 = getCharacter('labeling', 'buildincharacters');
    character2.push({ "role": "user", "content": dialogue });

    // 准备request
    const customRequest2 = {
        "messages": character2,
        "temperature": 0.4,
        "max_tokens": 80,
    };
    //post request
    let response2 = await createRequest(config, session, customRequest2);
    let output2 = response2.data.choices[0].message.content.replace(/\n/g, '');;

    //向量化
    let emb_output = await EmbRequest(config, output);
    let emb_tags = await EmbRequest(config, output2)

    saveMemory(sessionId, output, output2, emb_tags, emb_output);
    if (config.archive) {
        session.send(output);
        session.send(output2);
    }
}

//处理人设背景库
async function processBackgroundFile(fileName, config, session) {
    const filePath = path.join(__dirname, 'background', fileName);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(fileContent);

    let pastCount = 1;// 初始化计数器

    for (let index = 0; index < jsonData.length; index++) {
        let item = jsonData[index];
        await new Promise(resolve => setTimeout(resolve, 200));
        let character = getCharacter('labeling', 'buildincharacters');
        character.push({ "role": "user", "content": `这里是你需要分析的内容：“${item}”` });

        const customRequest = {
            "messages": character,
            "temperature": 0.4,
            "max_tokens": 80,
        };
        try {
            let response = await createRequest(config, session, customRequest);

            if (response.status == 200) {
                let output = response.data.choices[0].message.content.replace(/\n/g, '');

                let emb_data = await EmbRequest(config, item);
                let emb_data2 = await EmbRequest(config, output);

                const backgroundFilePath = path.join(__dirname, 'background', `${fileName.split('.')[0]}-background.json`);
                if (!fs.existsSync(backgroundFilePath)) {
                    fs.writeFileSync(backgroundFilePath, JSON.stringify({}));
                }
                const Data = JSON.parse(fs.readFileSync(backgroundFilePath, 'utf8'));

                const pastKey = `PastTimeMemory${pastCount}`;
                pastCount++; // 计数器

                const archives = item;
                const archives_vector = emb_data;
                const tags = output;
                const tags_vector = emb_data2;
                Data[pastKey] = {
                    time: pastKey,
                    tags: tags,
                    tags_vector: tags_vector,
                    archives: archives,
                    archives_vector: archives_vector
                };
                fs.writeFileSync(backgroundFilePath, JSON.stringify(Data, null, 2));
            } else {
                console.log("API请求失败，请检查服务器状态。");
            }
        } catch (error) {
            console.error("API请求时出错：", error);
        }
    }
}

//用户输入分析打标
async function emb_user_input(archives, NameA, NameB, config, session) {
    //总结记忆
    let character = getCharacter('labeling', 'buildincharacters');

    let dialogue = formatDialogue(archives, NameA, NameB);
    character.push({ "role": "user", "content": `这里是你需要分析的内容：“${dialogue}”` });

    // 准备request
    const customRequest = {
        "messages": character,
        "temperature": 0.4,
        "max_tokens": 200,
    };
    //post request and get output
    let response = await createRequest(config, session, customRequest);
    let output = response.data.choices[0].message.content;
    if (config.emb_debug) {
        session.send('用户输入分析：' + output);
    }
    //打标
    let emb_data = await EmbRequest(config, output);
    return emb_data
}


// 对比数据库内的向量
async function TopSimilar(inputVector, messageVector, database, threshold, topN, input, userName, characterName, config) {
    const format_message = formatDialogue(input, userName, characterName, config);

    return Object.values(database)  // 遍历数据库中的每个时间节点的记录
        .map(item => {
            const inputSimilarity = cosineSimilarity(inputVector, item.archives_vector);
            const messageSimilarity = cosineSimilarity(messageVector, item.archives_vector);
            const tagsSimilarity = cosineSimilarity(inputVector, item.tags_vector);
            const tagsSimilarity2 = cosineSimilarity(messageVector, item.tags_vector);

            const tags = item.tags.split(/[,，]/);
            const maxTagWeight = 0.2; // 标签权重的最大值
            const tagWeightIncrement = 0.1; // 每个匹配的标签增加的权重
            let tagWeight = tags.reduce((acc, tag) => {
                if (format_message.includes(tag.trim())) {
                    return acc + tagWeightIncrement;
                }
                return acc;
            }, 0);

            tagWeight = Math.min(tagWeight, maxTagWeight);

            const weightedSimilarity = 0.2 * inputSimilarity + 0.3 * messageSimilarity + 0.1 * tagsSimilarity + 0.2 * tagsSimilarity2 + tagWeight;
            return {
                time: item.time,
                archive: item.archives,
                similarity: weightedSimilarity
            };
        })
        .filter(item => item.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .map(item => ({
            time: item.time,
            archive: item.archive
        }));
}


//分段回复与排序
class MessageQueue {
    constructor() {
        this.queue = [];
        this.sending = false;
    }

    async sendNext() {
        if (this.sending || this.queue.length === 0) return;

        this.sending = true;
        const { session, sentences, ctx, maxInterval } = this.queue.shift();

        for (let i = 0; i < sentences.length; i++) {
            if (sentences[i].trim() !== "") {
                let delay = i === 0 ? 0 : Math.min(sentences.slice(0, i).reduce((sum, sentence) => sum + sentence.length * 130, 0), maxInterval * i);
                await new Promise(resolve => ctx.setTimeout(() => {
                    session.send(sentences[i]);
                    resolve();
                }, delay));
            }
        }

        this.sending = false;
        this.sendNext();  // Send the next message in the queue
    }

    addToQueue(session, sentences, ctx, maxInterval) {
        this.queue.push({ session, sentences, ctx, maxInterval });
        this.sendNext();
    }
}
const messageQueue = new MessageQueue();

//拆分标点符号
function splitParagraph(paragraph) {
    const punctuationRegex = /([。.！!？?；;~]+)/g;
    const interferenceChars = /[：:“”‘’"\n\\]/g;
    //删除干扰
    paragraph = paragraph.replace(interferenceChars, '');
    // 切分段落，将标点和字符分开
    let parts = paragraph.split(punctuationRegex);

    let result = [];
    for (let i = 0; i < parts.length; i++) {
        if (punctuationRegex.test(parts[i])) {
            if (result.length > 0) {
                result[result.length - 1] += parts[i];
            } else {
                result.push(parts[i]);
            }
        } else {
            // 当前块是字符，直接加入结果
            result.push(parts[i]);
        }
    }

    return result;
}

//发送文本
async function sendText(session, output, config, ctx) {
    if (!config.send_separate) {
        session.send(output)
        return
    }
    let sentences = splitParagraph(output);
    const maxInterval = 2000; // 最大间隔时间

    messageQueue.addToQueue(session, sentences, ctx, maxInterval);
}

//发送音频
async function sendVoice(session, output, config, speakerId) {
    if (output.length > config.ttsmaxlength) {
        await session.send(`文本过长，tts生成失败`);
    } else {
        let url = config.bertorvits
            ? `${config.ttsurl}/voice/bert-vits2?text=${encodeURIComponent(output)}&id=${speakerId}&format=${config.ttsformat}&lang=${config.ttslanguage}&length=${config.ttsspeechlength}&emotion=${config.ttsemotion}`
            : `${config.ttsurl}/voice/vits?text=${encodeURIComponent(output)}&id=${speakerId}&format=${config.ttsformat}&lang=${config.ttslanguage}&length=${config.ttsspeechlength}`;

        const response = await axios.get(url, { responseType: 'arraybuffer' });
        await session.send(koishi_1.h.audio(response.data, 'audio/mpeg'));
    }
}

//处理output
async function handleOutput(session, output, config, ctx, speakerId) {
    if (output == '') {
        return
    }
    if (config.outputMode == 'text' || config.outputMode == 'both' || config.outputMode == 'extra') {
        await sendText(session, output, config, ctx);
    }

    if (config.outputMode == 'voice' || config.outputMode == 'both') {
        await session.execute(`${config.ttscommand} ${output}`);
    }

    if (config.outputMode == 'extra') {
       await sendVoice(session, output, config, speakerId);
    }
}



//主逻辑
async function apply(ctx, config) {
    const knj = ctx.command("knj <message...>", "与AI模型进行对话")
        .userFields(['name'])
        .action(async ({ session, options }, ...msg) => {
            //message处理
            let message = session.content.replace(/<img[^>]*>|<at[^>]*>/g, '').replace(/knj/g, '');
            config.nicknames.forEach(nickname => {
                const regex = new RegExp(nickname, 'g');
                message = message.replace(regex, '');
            });
            if (message.length === 0 && msg === '') {
                await session.send(`请至少输入一个字符`)
                await session.execute(`help knj`)
                return
            }
            if (message.length === 0 && !config.visual_module) {
                return
            }
            //各种参数
            let Time = getTime();
            let Tool = '无';
            let channelId = '';
            let userId = '';
            let characterName = '';
            let speakerId = config.ttsspeakerID;
            let autocharactername = config.auto_use_character_name;
            let userName = await getUsername(session, ctx);

            //检查session是否存在
            let file = await CheckSessionFile(session, config)
            if (file) {
                //解析session名称
                let sessionData = await getSessionData(session, config);
                channelId = sessionData.channelId;
                userId = sessionData.userId;
                characterName = sessionData.characterName;
                speakerId = sessionData.speakerId;

                //自动人设，声音加载
            } else if (!file && config.auto_use_character) {
                await selectCharacter(session, config, autocharactername);
                characterName = autocharactername;
                speakerId = config.ttsspeakerID;
            } else if (!file) {
                return `没有找到匹配的历史记录文件。当前id: ${session.channelId.toString().replace(/-/g, '')} , ${session.userId.toString()}`;
            }

            //读取图像url
            let image_urls = await extractImageSrc(config, session.content);
            if (session.quote) {
                let quote_image_urls = await extractImageSrc(config, session.quote.content);
                image_urls.push(...quote_image_urls);
            }
            //图像识别
            let ImgPrompt = ''
            if (config.visual_module && image_urls.length > 0) {
                ImgPrompt = await ImagesProcess(ctx, config, session, image_urls);
                message = message + `\n(系统消息：\n用户发送了${image_urls.length}张图片，图片信息为：\n` + ImgPrompt + ')';
            }

            //创建sessionId
            let sessionId = await buildSessionId(session, config, characterName, speakerId);

            //加载历史记录
            let history = getHistory(sessionId);
            // 加载人设文件
            let character = getCharacter(characterName, 'characters');
            //加载旧状态文件
            let OldstateData = getState(sessionId);
            let summarize = (getOriginStates(characterName)).summarize;

            //长期记忆
            let Memorys = [];
            if (config.emb_module) {
                if (history.length >= config.historyLimit + 10) {
                    let archives = history.slice(0, 10);
                    // 限制长度
                    history = history.slice(-10);
                    await archive(archives, userName, characterName, sessionId, config, session);
                }

                //计算用户输入文本向量+向量库读取回忆记录
                const safeId = encodeURIComponent(sessionId)
                const filePath = path.join(__dirname, 'longtermmemory', `${safeId}-memory.json`);
                if (fs.existsSync(filePath)) {
                    const historyinput = history.slice(config.emb_user_message_number);
                    let input = historyinput.concat({ "role": "user", "content": message })
                    let history_input_emb = await emb_user_input(input, userName, characterName, config, session);
                    let message_input_emb = await EmbRequest(config, message);
                    //读取所有向量库数据
                    let emb_data = await readMemory(sessionId);
                    //计算相似度读取
                    Memorys = await TopSimilar(history_input_emb, message_input_emb, emb_data, config.emb_similar, config.emb_recall_number, input, userName, characterName, config);
                };
            } else {
                if (history.length > config.historyLimit) {
                    history.shift();
                }
            }



            //意图分析
            let IntJudge = await IntentionJudge(config, session, message, history, userName, characterName);

            if (config.IntentionJudge) {
                await session.send(`意图分析:\n${IntJudge}`);
            }

            //内心思考
            let IntThink = await InternalThinking(character, history, message, IntJudge, session, config, OldstateData, summarize);

            //计算动作
            let Action = await action(character, history, message, IntJudge, IntThink, session, config, OldstateData, summarize, characterName);

            //计算状态变化
            let NewstateData = await status_bar(character, history, message, userName, IntJudge, IntThink, OldstateData, config, session, summarize,Action);

            //工具调用
            if (config.UseTool) {
                Tool = await ToolMessage(ctx, config, session, message, IntThink, Action, character, sessionId, speakerId, history, OldstateData, userName, summarize, characterName);
            }

            //准备input内容
            let usermessage = { "role": "user", "content": message };
            let AImessage = {
                "role": "assistant", "content": `${summarize}
当前时间：${Time}
当前穿着：${NewstateData.穿着}
当前位置：${NewstateData.位置}
当前心情：${NewstateData.心情}
当前好感度：${NewstateData.好感度}
与对话者的关系：${NewstateData.与对话者的关系}
对历史记录的分析：
${IntJudge}
以下是我看到消息后的内心思考：
${IntThink}
以下是我看到消息后做出的动作：
${Action}
工具调用：
${Tool}
以下是我看到消息后，综合考虑上下文分析和内心思考，做出的回答(如果上面已经回答过了，那就在这里重复一遍)：
`};
            let TimeHistory = getTimeHistory(sessionId);
            TimeHistory.push(usermessage);
            TimeHistory.push(AImessage);

            //判断是否读取长期记忆
            if (Memorys.length > 0) {
                let addMemorys = Memorys.map(item => `记忆时间：${item.time}\n记忆信息： ${item.archive}`).join('\n');
                character.push({ "role": "assistant", "content": `以下是我回忆起的更早之前的记忆：\n${addMemorys}` })
                if (config.emb_debug) {
                    session.send(`以下是我回忆起的更早之前的记忆：\n${addMemorys}`);
                }
            }

            //连接人设与历史记录与用户输入
            let fullinput = character.concat(TimeHistory);

            //准备request
            const customRequest = {
                "messages": fullinput,
                "continue_": true,
            };
            //post request
            let response = await createRequest(config, session, customRequest);

            //处理
            if (response.status == 200) {
                let fulloutput = response.data.choices[0].message.content.replace(/\n\s*\n/g, '\n');
                let output = fulloutput.split(`以下是我看到消息后，综合考虑上下文分析和内心思考，做出的回答(如果上面已经回答过了，那就在这里重复一遍)：\n`)[1];
                //删除干扰
                output = output.replace(/[「」：:“”‘’"\n\\]/g, '');
                //写入历史记录
                history.push({ "role": "user", "content": message });
                history.push({ "role": "assistant", "content": output });
                saveHistory(sessionId, history);
                saveState(sessionId, Time, NewstateData, IntJudge, IntThink,Action);

                //发送回复
                await handleOutput(session, output, config, ctx, speakerId);

                //表情包
                if (config.UseEmoji) {
                    await EmojiJudge(message, output, config, session, characterName);
                }

                if (userTimers.has(sessionId)) {
                    const { stopTimer } = userTimers.get(sessionId);
                    stopTimer();  // 停止之前的计时器
                }
                const stopTimer = await FiveRecall(ctx, config.Short_term_active, character, sessionId, speakerId, history, session, config, config.Short_term_active_times, OldstateData, message, userName, summarize, characterName);
                userTimers.set(sessionId, { stopTimer, recallCount: 0 });

            } else {
                console.log("API请求失败，请检查服务器状态。")
            }
        });

    //加载人设
    ctx.command('knj.load <character:text>', ':\n(别名：加载人设)\n加载人设并创建新的历史记录')
        .alias("加载人设")
        .action(async ({ session }, character) => {
            if (!character || character.trim() === "") {
                await session.send(`请至少输入一个人设名称`);
                await session.execute(`help knj.load`);
                return;
            }
            //检查历史记录是否已经存在
            const existingSession = await CheckSessionFile(session, config);
            if (existingSession) {
                return `已存在一个历史记录，编号:${decodeURIComponent(existingSession)}。请不要重复创建。`;
            }

            if (!checkCharacter(character,'characters')) {
                return `未找到人设 ${character}。`;
            }
            //创建sessionId，创建文件
            const speakerId = config.ttsspeakerID;
            const sessionId = buildSessionId(session, config, character, speakerId);
            createHistory(sessionId);
            createState(sessionId);
            createMemory(sessionId);
            const time = getTime();
            writeBaseState(sessionId, character, time);

            if (config.emb_pretreat) {
                //背景库
                let PreData = {};
                let safeId = encodeURIComponent(sessionId)
                const filePath = path.join(__dirname, 'longtermmemory', `${safeId}-memory.json`);
                const backgroundFile = path.join(__dirname, 'background', `${character}-background.json`);
                const jsonFile = path.join(__dirname, 'background', `${character}.json`);
                if (fs.existsSync(backgroundFile)) {
                    const data = fs.readFileSync(backgroundFile, 'utf-8');
                    PreData = JSON.parse(data);
                } else if (fs.existsSync(jsonFile)) {
                    await session.send("背景库信息录入中，请稍等")
                    await processBackgroundFile(`${character}.json`, config, session);
                    const data = await fs.readFileSync(backgroundFile, 'utf-8');
                    PreData = JSON.parse(data);
                    await session.send("录入成功！");
                } else {
                    await session.send("人设背景库不存在，请联系管理员创建");
                    PreData = {};
                }
                fs.writeFileSync(filePath, JSON.stringify(PreData));
            }

            if (config.select_character_notice) {
                return `人设 ${character} 已加载，新的历史记录已创建,语音角色已绑定为${config.ttsspeakerID}。`;
            }
        });

    //删除历史记录
    ctx.command('knj.del', ":\n(别名：删除人设)\n删除当前人设")
        .alias("删除人设")
        .action(async ({ session }) => {
            //创建sessionid
            let sessionData = await getSessionData(session, config);
            let characterName = sessionData.characterName;
            let speakerId = sessionData.speakerId;
            let sessionId = await buildSessionId(session, config, characterName, speakerId);
            let safeId = encodeURIComponent(sessionId);
            if (userTimers.has(sessionId)) {
                const { stopTimer } = userTimers.get(sessionId);
                stopTimer();  // 停止之前的计时器
            }
            cancelUserAlarms(sessionId)// 停止闹钟
            const fileToDelete = await CheckSessionFile(session, config);
            if (!fileToDelete) {
                return `没有找到匹配的历史记录文件。`
            }
            // 删除
            await fs.unlinkSync(`${__dirname}/sessionData/${fileToDelete}`);
            await fs.unlinkSync(`${__dirname}/sessionData/${safeId}-state.json`);
            await fs.unlinkSync(`${__dirname}/longtermmemory/${safeId}-memory.json`);
            await session.send(`已删除历史记录文件：${decodeURIComponent(fileToDelete)}`);
        });

    //检查人设文件是否存在
    ctx.command('knj.check', ":\n(别名：当前人设)\n检查历史记录文件是否存在")
        .alias("当前人设")
        .action(async ({ session }) => {
            const file = await CheckSessionFile(session, config);
            if (file) {
                return `文件存在：${decodeURIComponent(file)}`;
            } else {
                return `没有找到匹配的历史记录文件。\n 当前id:${session.channelId.toString().replace(/-/g, '')} \n userId:${session.userId.toString()}`;
            }
        });

    //重置人设
    ctx.command('knj.reset', ":\n(别名：重置人设)\n重置当前人设")
        .alias("重置人设")
        .action(async ({ session }) => {
            //创建sessionid
            let sessionData = await getSessionData(session, config);
            let characterName = sessionData.characterName;
            let speakerId = sessionData.speakerId;
            let sessionId = await buildSessionId(session, config, characterName, speakerId);
            let safeId = encodeURIComponent(sessionId);
            if (userTimers.has(sessionId)) {
                const { stopTimer } = userTimers.get(sessionId);
                stopTimer();  // 停止之前的计时器
            }
            cancelUserAlarms(sessionId)// 停止闹钟
            const file = await CheckSessionFile(session, config);
            if (file) {
                fs.writeFileSync(`${__dirname}/sessionData/${file}`, '[]');

                //向量库
                if (fs.existsSync(`${__dirname}/longtermmemory/${safeId}-memory.json`)) {
                    const filePath = `${__dirname}/longtermmemory/${safeId}-memory.json`;
                    let PreData = {};
                    if (config.emb_pretreat) {
                        const backgroundFile = path.join(__dirname, 'background', `${characterName}-background.json`);
                        const jsonFile = path.join(__dirname, 'background', `${characterName}.json`);
                        if (fs.existsSync(backgroundFile)) {
                            const data = fs.readFileSync(backgroundFile, 'utf-8');
                            PreData = JSON.parse(data);
                        } else if (fs.existsSync(jsonFile)) {
                            await session.send("背景库信息录入中，请稍等")
                            await processBackgroundFile(`${character}.json`, config, session);
                            const data = await fs.readFileSync(backgroundFile, 'utf-8');
                            PreData = JSON.parse(data);
                            await session.send("录入成功！");
                        } else {
                            await session.send("人设背景库不存在，请联系管理员创建");
                            PreData = {};
                        }
                    }
                    fs.writeFileSync(filePath, JSON.stringify(PreData));
                }

                const time = getTime()
                writeBaseState(sessionId, characterName, time);
                return `已重置历史记录文件：\n${decodeURIComponent(file)}`;
            } else {
                return `没有找到匹配的历史记录文件。\n 当前id:${session.channelId.toString().replace(/-/g, '')} \n ${session.userId.toString()}`;
            }
        });

    //撤回上一组对话
    ctx.command("knj.undo", ":\n(别名：撤回)\n撤回刚刚的发言，让Ai回到上一句发言之前")
        .alias("撤回")
        .action(async ({ session }) => {
            const file = await CheckSessionFile(session, config);
            if (file) {
                let safefile = decodeURIComponent(file.replace(/\.json$/, ''));
                let history = getHistory(safefile);
                if (history.length > 0) {
                    // 寻找最后一个role为user的位置
                    let lastUserIndex = history.map(item => item.role).lastIndexOf('user');
                    if (lastUserIndex !== -1) {
                        // 删除最后一个user以及之后的所有对话
                        history = history.slice(0, lastUserIndex);
                        saveHistory(safefile, history);
                        //删除状态数据
                        deleteLatestState(safefile)
                        return `已撤回最后一组对话，可以继续聊天哦。`;
                    } else {
                        return `历史记录中没有找到用户的发言，无法撤回对话。\n会话ID:${decodeURIComponent(file)}`;
                    }
                } else {
                    return `历史记录文件为空，无法撤回最后一组对话。\n会话ID:${decodeURIComponent(file)}`;
                }
            } else {
                return `没有找到匹配的历史记录文件。\n 当前id:${session.channelId.toString().replace(/-/g, '')} \n ${session.userId.toString()}`;
            }
        });

    //人设列表
    ctx.command("knj.list", ":\n(别名：人设列表)\n列出所有可用人设")
        .alias("人设列表")
        .action(async () => {
            let files = fs.readdirSync(`${__dirname}/characters/`);
            files = files.filter(file => !file.endsWith('state.json'));
            if (files.length === 0) {
                return '目前没有可用的人设文件。';
            } else {
                let characterNames = files.map(file => file.replace('.json', ''));
                return '可用的人设有：\n' + characterNames.join('\n');
            }
        });

    //档案列表
    ctx.command("knj.arclist", ":\n(别名：档案列表)\n列出所有你曾经存储的角色")
        .alias("档案列表")
        .action(async ({ session }) => {
            let archivePath = config.Archive_Path !== '' ? config.Archive_Path : `${__dirname}/Archive/`;
            let files = fs.readdirSync(archivePath);
            files = files
                .map(file => decodeURIComponent(file))
                .filter(file => !file.endsWith('state.json') && !file.endsWith('memory.json'))
                .filter(file => file.startsWith(`${session.channelId}-${session.userId}`));
            if (files.length === 0) {
                return '目前没有存储的角色。';
            } else {
                let characterNames = files.map(file => file.replace('.json', ''));
                return '你存储的角色有：\n' + characterNames.join('\n');
            }
        });

    //档案存储
    ctx.command("knj.arc", ":\n(别名：档案存储)\n将现在和你对话的角色存入档案")
        .alias("档案存储")
        .action(async ({ session }) => {
            let archivePath = config.Archive_Path !== '' ? config.Archive_Path : `${__dirname}/Archive/`;
            if (!fs.existsSync(archivePath)) {
                await session.send('外置档案存储目录不存在，请修改');
                return
            }
            //检查文件获取名称
            const file = await CheckSessionFile(session, config);
            if (file == "") {
                session.send(`当前没有人设加载，请首先进行人设加载：knj.load`);
                return
            }
            //检查archive内是否已经存在
            if (fs.existsSync(`${archivePath}${file}`)) {
                session.send(`在档案文件夹内找到了同名角色，请不要重复存储。`);
                return
            }

            //创建sessionid
            let sessionData = await getSessionData(session, config);
            let characterName = sessionData.characterName;
            let speakerId = sessionData.speakerId;
            let sessionId = await buildSessionId(session, config, characterName, speakerId);

            if (userTimers.has(sessionId)) {
                const { stopTimer } = userTimers.get(sessionId);
                stopTimer();  // 停止之前的计时器
            }
            cancelUserAlarms(sessionId)// 停止闹钟

            const rawfile = file.replace(/\.json$/, "");
            if (file) {
                fs.rename(`${__dirname}/sessionData/${file}`, `${archivePath}${file}`, (err) => { });
                fs.rename(`${__dirname}/sessionData/${rawfile}-state.json`, `${archivePath}${rawfile}-state.json`, (err) => { });
                fs.rename(`${__dirname}/longtermmemory/${rawfile}-memory.json`, `${archivePath}${rawfile}-memory.json`, (err) => { });
                session.send(`档案存储完毕：${sessionId}`)
            } else {
                return `没有找到匹配的历史记录文件。\n 当前id:${session.channelId.toString().replace(/-/g, '')} \n userId:${session.userId.toString()}`;
            }
        });

    //档案加载
    ctx.command("knj.arcload <character:text>", ":\n(别名：档案加载)\n将档案内的指定角色读取出来")
        .alias("档案加载")
        .action(async ({ session }, character) => {
            if (!character || character.trim() === "") {
                await session.send(`请至少输入一个人设名称`);
                await session.execute(`knj.arclist`);
                return;
            }
            const filenow = await CheckSessionFile(session, config);
            if (filenow !== "") {
                await session.send('你现在正在聊天中，无法直接加载档案，请首先进行档案存储或删除当前记录。\n档案存储：knj.arc\n删除当前记录：knj.del');
                return
            }
            let archivePath = config.Archive_Path !== '' ? config.Archive_Path : `${__dirname}/Archive/`;
            let files = fs.readdirSync(archivePath);
            files = files
                .map(file => decodeURIComponent(file))
                .filter(file => !file.endsWith('state.json') && !file.endsWith('memory.json'))
                .filter(file => file.startsWith(`${session.channelId}-${session.userId}`));
            if (files.length === 0) {
                return '目前没有存储的档案。';
            } else {
                let characterNames = files.map(file => file.replace('.json', ''));
                let rawfile = encodeURIComponent(character);
                if (characterNames.includes(character)) {
                    fs.rename(`${archivePath}${rawfile}.json`, `${__dirname}/sessionData/${rawfile}.json`, (err) => { });
                    fs.rename(`${archivePath}${rawfile}-state.json`, `${__dirname}/sessionData/${rawfile}-state.json`, (err) => { });
                    fs.rename(`${archivePath}${rawfile}-memory.json`, `${__dirname}/longtermmemory/${rawfile}-memory.json`, (err) => { });
                    session.send(`档案读取完成：${character}`);
                } else {
                    session.send(`没有找到输入的档案名字：${character}`);
                    await session.execute(`knj.arclist`);
                    return 
                }
            }
        });

    if (config.visual_module) {
        //视觉模块
        ctx.command('knj.vision <...msg>', ":\n视觉模块测试用指令")
            .option('mode', '-m <string>')
            .action(async ({ options, session }, ...msg) => {
                //读取图像url
                let image_urls = await extractImageSrc(config, session.content);
                if (session.quote) {
                    let quote_image_urls = await extractImageSrc(config, session.quote.content);
                    image_urls.push(...quote_image_urls);
                }
                if (image_urls.length === 0) {
                    session.send('未检测到图片')
                    return
                }
                if (image_urls.length > 1) {
                    return '一次只能一张图'
                }
                let task_type = "<MORE_DETAILED_CAPTION>"
                //切换模式
                if (options.mode) {
                    task_type = options.mode;
                }
                let imgSrc = image_urls[0]
                let output = await SingleImageProcess(ctx, config, session, imgSrc, task_type)
                await session.send(output)
            });
    }

    if (config.emb_pretreat) {
        //预处理人设背景库
        ctx.command('knj.pretreat', ':此指令为调试功能，用于批量预处理人设背景库')
            .action(async ({ session }) => {
                const directory = path.join(__dirname, 'background');
                const files = fs.readdirSync(directory);

                const originalFiles = files.filter(file => file.endsWith('.json') && !file.endsWith('-background.json'));

                // 遍历原始文件，检查是否已经处理过
                for (const originalFile of originalFiles) {
                    const backgroundFile = originalFile.replace('.json', '-background.json');
                    if (!files.includes(backgroundFile)) {
                        // 处理
                        session.send(`背景库处理中：${originalFile}`)
                        await processBackgroundFile(originalFile, config, session);
                        session.send(`背景库处理完成:${originalFile}`)
                    } else {
                        session.send(`已经存在背景库:${originalFile}`)
                    }
                }
            });
    }

    //回复触发
    RegExp.escape = s => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    let nicknameRegex = new RegExp("^(" + config.nicknames.map(RegExp.escape).join("|") + ")\\s");
    ctx.middleware(async (session, next) => {
        if (ctx.bots[session.uid])
            return;
        // @触发
        if (session.elements[0].type == "at" && session.elements[0].attrs.id === session.bot.selfId) {
            let msg = String(session.content);
            if (msg.indexOf(session.selfId)) {
                msg = msg.replace(/<at[^>]*>/g, '');
            }
            await session.execute(`knj ${msg}`);
        }
        // 昵称触发
        if (config.nicknames.length > 0) {
            let match = session.content.match(nicknameRegex);
            if (match) {
                let msg = String(session.content);
                msg = msg.slice(match[0].length).trim();
                await session.execute(`knj ${msg}`);
            }
        }
        // 私聊触发
        if (session.isDirect === true && config.if_private) {
            let msg = String(session.content);
            if (msg.startsWith("[自动回复]")) {
                return;
            }
            await session.execute(`knj ${msg}`);
            return;
        }
        // 引用回复
        if (session.quote && session.elements[0].type !== "at") {
            let msg = String(session.content);
            let reverse = session.bot.getMessage(session.channelId, session.quote.id);
            let quoteID = (await reverse).user.userId;
            if (session.selfId === quoteID) {
                await session.execute(`knj ${msg}`);
                return;
            }
        }
        await next();
    });
}

exports.apply = apply;
