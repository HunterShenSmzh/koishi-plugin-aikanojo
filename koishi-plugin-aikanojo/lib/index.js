"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const koishi_1 = require("koishi");
const axios = require("axios");
const path = require('path');
const fs = require('fs');
const util = require('util');
const { channel } = require("diagnostics_channel");
const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const HttpsProxyAgent = require('https-proxy-agent');
const { time } = require("console");
const { SlowBuffer } = require("buffer");
const userTimers = new Map();

exports.name = "aikanojo";
exports.usage = `
### 用前需知
### 当前为先行版0.1.0
### QQ讨论群：719518427
先行版bug很多，而且功能不全，遇到bug或者有想要的功能，都可以加qq群讨论<br>
tts部分现在只是摆设<br>
人设目前只有咕咕白可用<br>
建议使用dolphin 34b<br>

TGW后台需要自行部署<br>
github上有一键安装包，包含Windows，Linux，Mac。<br>
也可以直接使用我制作的一键懒人包：https://www.bilibili.com/video/BV1Te411U7me<br>

`;

exports.Config = koishi_1.Schema.intersect([
    koishi_1.Schema.object({
        apiURL: koishi_1.Schema.string()
            .description('API服务器地址')
            .default('http://127.0.0.1:5000/'),
        historyLimit: koishi_1.Schema.number()
            .description('历史记录上限(注意这里指的是句子数量，一组对话有两个句子。)')
            .default(10),
        IntentionJudge: koishi_1.Schema.boolean()
            .description('是否显示意图判断')
            .default(false),
        InternalThinking: koishi_1.Schema.boolean()
            .description('是否显示内心思想')
            .default(false),
        Short_term_active: koishi_1.Schema.number().description('短期活跃间隔(单位毫秒,ms)')
            .default(600000),
        Short_term_active_times: koishi_1.Schema.number().description('短期活跃次数(决定了自激活上限)')
            .default(3),
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
    koishi_1.Schema.object({
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
        stop: koishi_1.Schema.string().description('stop')
            .default("\n\n\n"),
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
    }).description('高阶设置，如果你不知道你在干什么，请不要修改，保持默认'),
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

//创建requestbody
function createRequestBody(config, customConfig = {}) {
    const defaultConfig = {
        "messages": [{}],
        "continue_": false,
        "instruction_template":config.instruction_template,
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

    return Object.assign({}, defaultConfig, customConfig);
}

//准备url
function prepareURL(config) {
    let url = '';
    if (config.apiURL.endsWith('/')) {
        url = config.apiURL + 'v1/chat/completions';
    } else {
        url = config.apiURL + '/v1/chat/completions';
    }
    return url;
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
            return file;
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

//保存历史记录
function saveHistory(id, history) {
    let safeId = encodeURIComponent(id);
    let filteredHistory = history.filter(message => message !== "");
    fs.writeFileSync(path.join(__dirname, 'sessionData', `${safeId}.json`), JSON.stringify(filteredHistory));
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

//读取时间
function getTime() {
    let now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;
    let date = now.getDate();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    month = month < 10 ? '0' + month : month;
    date = date < 10 ? '0' + date : date;
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return year + '年' + month + '月' + date + '日' + hours + ':' + minutes;
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
async function IntentionJudge(url, message, history, NameA, NameB,config) {
    let character = getCharacter('IntentionJudge', 'buildincharacters');
    //准备内容
    let Inthistory = history.concat({ "role": "user", "content": message });
    //去除时间轴
    var regex = /当前时间：\d{4}年\d{2}月\d{2}日\d{2}:\d{2}/g;
    for (var i = 0; i < Inthistory.length; i++) {
        Inthistory[i].content = Inthistory[i].content.replace(regex, "");
    }

    let dialogue = formatDialogue(Inthistory, NameA, NameB);
    character.push({ "role": "user", "content": dialogue })

    // 准备request
    const customRequest = {
        "messages": character,
        "temperature": 0.4,
        "max_tokens": 200,
    };
    const request = createRequestBody(config, customRequest)
    //post request
    let response = await axios.post(url, request);
    if (response.status == 200) {
        let output = response.data.choices[0].message.content
        return output
    } else {
        console.log("API请求失败，请检查服务器状态。")
    }
}

//内心思考
async function InternalThinking(url, character, history, message, IntJudge, session, config) {
    //获取相关参数
    const Time = getTime();

    //组合上下文
    const Inthistory = history.concat({ "role": "user", "content": message });
    let fullinput = character.concat(Inthistory);

    let Think = `我叫咕咕白，是一个女大学生，正在使用聊天软件聊天。
当前时间：${Time}
当前位置：自己的房间
当前穿着：白色连衣裙
对上下文的分析：
${IntJudge}
以下是我的内心思考：`;

    fullinput.push({ "role": "assistant", "content": Think })

    // 准备request
    const customRequest = {
        "messages": fullinput,
        "continue_": true,
        "stop": ["以下是"],
        "max_tokens": 200,
    };
    const request = createRequestBody(config, customRequest)
    //post request
    let response = await axios.post(url, request);
    if (response.status == 200) {
        let output = response.data.choices[0].message.content.replace(/\n\s*\n/g, '\n');

        let sendoutput = output.split(`以下是我的内心思考：`)[1];
        if (config.InternalThinking) {
            await session.send(`内心思想：${sendoutput}`)
        }

        return output
    } else {
        console.log("API请求失败，请检查服务器状态。")
    }
}

//闲置高活跃
async function recall(url, character, sessionId, history, session, config, ctx) {
    const Time = getTime();
    const pastminutes = millisecondsToMinutes(config.Short_term_active)
    let remind = `以下是系统消息，并非用户发出的信息：
当前时间：${Time}
距离上一次交流已经过去了${pastminutes}分钟。
用户并未发送任何信息
请你输出你的内心思考`
    let remind2 = `我叫咕咕白，是一个女大学生，正在使用聊天软件聊F天。
当前位置：自己的房间
当前穿着：白色连衣裙。
以下是我的内心思考：`
    let fullinput = character.concat(history);
    fullinput.push({ "role": "user", "content": remind })
    fullinput.push({ "role": "assistant", "content": remind2 })
    //准备request
    const customRequest = {
        "messages": fullinput,
        "continue_": true,
        "stop": ["以下是"],
        "max_tokens": 200,
    };
    const request = createRequestBody(config, customRequest)
    //post request
    let response = await axios.post(url, request);
    let output = response.data.choices[0].message.content.replace(/\n\s*\n/g, '\n');


    if (response.status == 200) {
        //检查
        let sendoutput = output.split(`以下是我的内心思考：`)[1];
        if (config.InternalThinking) {
            await session.send(`内心思想：${sendoutput}`);
        }


        let select = output + `\n是否需要主动开启对话(只需回答是或否)？
回答：`
        let fullinput2 = character.concat(history);
        fullinput2.push({ "role": "user", "content": remind })
        fullinput2.push({ "role": "assistant", "content": select })
        //准备request
        const customRequest2 = {
            "messages": fullinput2,
            "continue_": true,
            "stop": ["以下是"],
            "max_tokens": 20,
        };
        const request2 = createRequestBody(config, customRequest2)
        //post request
        let response2 = await axios.post(url, request2);
        let output2 = response2.data.choices[0].message.content.replace(/\n\s*\n/g, '\n');

        if (response2.status == 200) {
            //检查
            let sendoutput2 = output2.split(`是否需要主动开启对话(只需回答是或否)？`)[1];

            if (config.IntentionJudge) {
                await session.send(`是否主动？${sendoutput2}`);
            }

            if (sendoutput2.includes("是")) {
                let selectTrue = `我叫咕咕白，是一个女大学生，正在使用聊天软件聊F天。
当前位置：自己的房间
当前穿着：白色连衣裙。
以下是我的内心思考：
${sendoutput}
以下是我选择使用的开启对话的询问：`
                fullinput.pop();
                fullinput.push({ "role": "assistant", "content": selectTrue });
                //准备request
                const customRequest3 = {
                    "messages": fullinput,
                    "continue_": true,
                    "max_tokens": 200,
                };
                const request3 = createRequestBody(config, customRequest3)
                //post request
                let response3 = await axios.post(url, request3);
                let output3 = response3.data.choices[0].message.content.replace(/\n\s*\n/g, '\n');

                //发送开始对话
                let sendoutput3 = output3.split(`以下是我选择使用的开启对话的询问：`)[1];
                // 分开发送
                let sentences = sendoutput3.split(/(?<=。|！|……|？|~|～|\?|!)/);
                if (sentences.length === 1) {
                    session.send(sendoutput3);
                } else {
                    for (let i = 0; i < sentences.length; i++) {
                        if (sentences[i].trim() !== "") {
                            ctx.setTimeout(() => {
                                session.send(sentences[i]);
                            }, i * 1500); // 每隔1.5秒发送
                        }
                    }
                }

                //历史记录更新
                let Newhistory = getHistory(sessionId);
                Newhistory.push({ "role": "user", "content": `聊天记录时间：${Time},\n距离上一次交流已经过去了${pastminutes}分钟，用户并未发送任何信息。` });
                Newhistory.push({ "role": "assistant", "content": `以下是我的心里活动：` + sendoutput + `以下是我选择使用的开启对话的询问：` + sendoutput3 });
                saveHistory(sessionId, Newhistory);
            } else {
                if (userTimers.has(sessionId)) {
                    const { stopTimer } = userTimers.get(sessionId);
                    stopTimer();  // 停止之前的计时器
                }
                //历史记录更新
                let Newhistory = getHistory(sessionId);
                Newhistory.push({ "role": "user", "content": `以下是系统消息，并非用户发出的信息：\n聊天记录时间：${Time},\n距离上一次交流已经过去了${pastminutes}分钟，用户并未发送任何信息。` });
                Newhistory.push({ "role": "assistant", "content": `以下是我的心里活动：` + sendoutput + `我并没有发送消息来尝试开启对话。` });
                saveHistory(sessionId, Newhistory);
            }
        } else {
            console.log("API请求失败，请检查服务器状态。")
        }
    } else {
        console.log("API请求失败，请检查服务器状态。")
    }
}


//5分钟闲置高活跃
async function FiveRecall(ctx, delay, url, character, sessionId, history, session, config, maxCount) {
    let recallCount = 0;   // 重置计数器
    const interval = ctx.setInterval(() => {
        recallCount++;
        recall(url, character, sessionId, history, session, config, ctx);
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


//主逻辑
async function apply(ctx, config) {
    const knj = ctx.command("knj <message...>", "与AI模型进行对话")
        .userFields(['name'])
        .action(async ({ session, options }, ...msg) => {
            if (msg.length === 0) {
                await session.send(`请至少输入一个字符`)
                await session.execute(`help knj`)
                return
            }
            let message = msg.join(' ');
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

            //创建sessionId
            let sessionId = await buildSessionId(session, config, characterName, speakerId);

            //加载历史记录
            let history = getHistory(sessionId);
            // 加载人设文件
            let character = getCharacter(characterName, 'characters');

            // 更新历史记录
            if (history.length >= config.historyLimit) {
                history.shift();
            }

            //---------------------------------------思维链---------------------------------------------

            //准备url
            const url = prepareURL(config)

            //意图分析
            let IntJudge = await IntentionJudge(url, message, history, userName, characterName,config);

            if (config.IntentionJudge) {
                await session.send(`意图分析:\n${IntJudge}`);
            }

            //内心思考
            let IntThink = await InternalThinking(url, character, history, message, IntJudge,session,config);

            //准备input内容
            let usermessage = { "role": "user", "content": message };
            let AImessage = { "role": "assistant", "content": IntThink + `\n以下是我根据以上分析做出的回答：` };
            history.push(usermessage);
            history.push(AImessage);

            //连接人设与历史记录与用户输入
            let fullinput = character.concat(history);

            //准备request
            const customRequest = {
                "messages": fullinput,
                "continue_": true,
            };
            const request = createRequestBody(config, customRequest)
            //post request
            let response = await axios.post(url, request);

            //处理
            if (response.status == 200) {
                let fulloutput = response.data.choices[0].message.content.replace(/\n\s*\n/g, '\n');
                let output = fulloutput.split(`\n以下是我根据以上分析做出的回答：`)[1];
                const Time = getTime();
                //写入历史记录
                let Newhistory = getHistory(sessionId);
                Newhistory.push({ "role": "user", "content": message });
                Newhistory.push({ "role": "assistant", "content": '聊天记录时间：'+Time+output });
                saveHistory(sessionId, Newhistory);

                // 分开发送
                let sentences = output.split(/(?<=。|！|……|？|~|～|\?|!)/);
                if (sentences.length === 1) {
                    session.send(output);
                } else {
                    for (let i = 0; i < sentences.length; i++) {
                        if (sentences[i].trim() !== "") {
                            ctx.setTimeout(() => {
                                session.send(sentences[i]);
                            }, i * 1500); // 每隔1.5秒发送
                        }
                    }
                }

                //---------------------------------------五分钟recall---------------------------------------------
                if (userTimers.has(sessionId)) {
                    const { stopTimer } = userTimers.get(sessionId);
                    stopTimer();  // 停止之前的计时器
                }
                const stopTimer = await FiveRecall(ctx, config.Short_term_active, url, character, sessionId, history, session, config, config.Short_term_active_times);
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
            if (userTimers.has(sessionId)) {
                const { stopTimer } = userTimers.get(sessionId);
                stopTimer();  // 停止之前的计时器
            }
            const fileToDelete = await CheckSessionFile(session, config);
            if (!fileToDelete) {
                return `没有找到匹配的历史记录文件。`
            }
            // 删除
            fs.unlinkSync(`${__dirname}/sessionData/${fileToDelete}`);
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
            if (userTimers.has(sessionId)) {
                const { stopTimer } = userTimers.get(sessionId);
                stopTimer();  // 停止之前的计时器
            }
            const file = await CheckSessionFile(session, config);
            if (file) {
                fs.writeFileSync(`${__dirname}/sessionData/${file}`, '[]');
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
            if (files.length === 0) {
                return '目前没有可用的人设文件。';
            } else {
                let characterNames = files.map(file => file.replace('.json', ''));
                return '可用的人设有：\n' + characterNames.join('\n');
            }
        });


    //回复触发
    RegExp.escape = s => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    let nicknameRegex = new RegExp("^(" + config.nicknames.map(RegExp.escape).join("|") + ")\\s");
    ctx.middleware(async (session, next) => {
        if (ctx.bots[session.uid])
            return;
        // @触发
        if ((config.if_at && session.parsed.appel) && !session.quote) {
            let msg = String(session.content);
            msg = msg.replace(`<at id="${session.selfId}"/> `, '');
            msg = msg.replace(`<at id="${session.selfId}"/>`, '');
            if (msg.indexOf(session.selfId)) {
                msg = msg.replace(/<[^>]+>/g, '');
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
        if (session.channelId == "private:" + String(session.userId) && config.if_private) {
            let msg = String(session.content);
            if (msg.startsWith("[自动回复]")) {
                return;
            }
            await session.execute(`knj ${msg}`);
            return;
        }
        // 引用回复
        if (session.quote) {
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